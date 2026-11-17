import { useMemo } from 'react';
import classNames from 'classnames';
import { Lock, Unlock, Store } from 'lucide-react';
import { useStore } from '../../store';
import { useToast } from '../../hooks/useToast';

export default function RestaurantGrid() {
  const menuPayload = useStore((s) => s.menuPayload);
  const selectedCategory = useStore((s) => s.selectedCategory);
  const selectedRestaurant = useStore((s) => s.selectedRestaurant);
  const setRestaurant = useStore((s) => s.setRestaurant);

  const locks = useStore((s) => s.locks) || {};
  const selectedEmployee = useStore((s) => s.selectedEmployee);
  const lockCategoryRestaurant = useStore((s) => s.lockCategoryRestaurant);
  const unlockCategory = useStore((s) => s.unlockCategory);
  const addToast = useToast((s) => s.addToast);
  const newItemDisplayDays = useStore((s) => s.newItemDisplayDays);

  const restaurants = useMemo(() => {
    if (!menuPayload || !selectedCategory) return [];
    const now = Date.now();
    const msThreshold = newItemDisplayDays * 86400000;
    return menuPayload.restaurants
      .filter((r) => r.category === selectedCategory)
      .sort((a, b) => {
        const aIsNew = !!(a.createdAt && now - new Date(a.createdAt).getTime() < msThreshold);
        const bIsNew = !!(b.createdAt && now - new Date(b.createdAt).getTime() < msThreshold);
        if (aIsNew && !bIsNew) return -1;
        if (!aIsNew && bIsNew) return 1;
        return 0;
      });
  }, [menuPayload, selectedCategory, newItemDisplayDays]);

  if (!selectedCategory || restaurants.length === 0) return null;

  const activeLock = locks[selectedCategory];
  const isCategoryLocked = !!activeLock;

  const handleLock = (e: React.MouseEvent, restaurantId: string) => {
    e.stopPropagation();
    if (!selectedEmployee.trim()) {
      addToast('error', '請先在上方選擇訂餐人再進行鎖定');
      return;
    }
    lockCategoryRestaurant(selectedCategory, restaurantId).then((res) => {
      if (res && !res.ok) {
        addToast('error', res.error || '鎖定失敗');
      } else {
        addToast('success', `已鎖定「${selectedCategory}」為指定餐廳`);
      }
    });
  };

  const handleUnlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    unlockCategory(selectedCategory).then((res) => {
      if (res && !res.ok) {
        addToast('error', res.error || '解鎖失敗');
      } else {
        addToast('success', `已解除「${selectedCategory}」的餐廳鎖定`);
      }
    });
  };

  return (
    <div className="animate-slide-up">
      <div className="flex justify-between items-center mb-3">
        <div className="h3">
          <Store size={16} strokeWidth={1.5} />
          選擇餐廳
        </div>
        {isCategoryLocked && (
          <div className="badge badge-error">
            <span className="status-dot status-dot-error" />
            此分類已鎖定
          </div>
        )}
      </div>

      <div className="option-grid">
        {restaurants.map((r) => {
          const isThisRestLocked = isCategoryLocked && activeLock.restaurantId === r.id;
          const isDisabled = isCategoryLocked && activeLock.restaurantId !== r.id;
          const isSelected = selectedRestaurant === r.id;
          const isNewRestaurant = !!(
            r.createdAt &&
            Date.now() - new Date(r.createdAt).getTime() < newItemDisplayDays * 86400000
          );

          return (
            <div
              key={r.id}
              className={classNames('option-card', {
                selected: isSelected,
              })}
              style={{
                minHeight: '76px',
                justifyContent: 'space-between',
                ...(isDisabled
                  ? {
                      opacity: 0.4,
                      cursor: 'not-allowed',
                      pointerEvents: 'none',
                      borderStyle: 'dashed',
                    }
                  : {}),
              }}
              onClick={() => {
                if (!isDisabled) {
                  setRestaurant(r.id);
                }
              }}
            >
              <div className="flex justify-between items-start gap-2" style={{ width: '100%' }}>
                <span className="option-name">
                  {r.name}
                  {isNewRestaurant && (
                    <span className="badge-new" style={{ marginLeft: 6 }}>
                      新加入
                    </span>
                  )}
                </span>
                {isThisRestLocked && (
                  <span className="badge badge-error">
                    <Lock size={11} strokeWidth={1.5} />
                    已鎖定
                  </span>
                )}
              </div>

              <div className="flex justify-end items-center mt-2" style={{ width: '100%' }}>
                {isThisRestLocked ? (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      className="chip-btn"
                      style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
                      onClick={handleUnlock}
                    >
                      <Unlock size={11} strokeWidth={1.5} />
                      解鎖
                    </button>
                    {activeLock.lockedBy && (
                      <span className="label">鎖定者：{activeLock.lockedBy}</span>
                    )}
                  </div>
                ) : (
                  isSelected &&
                  !isCategoryLocked && (
                    <button
                      type="button"
                      className="chip-btn"
                      onClick={(e) => handleLock(e, r.id)}
                    >
                      <Lock size={11} strokeWidth={1.5} />
                      鎖定此餐廳
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
