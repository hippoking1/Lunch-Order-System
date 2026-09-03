import { useMemo } from 'react';
import classNames from 'classnames';
import { Lock, Unlock, Sparkles } from 'lucide-react';
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
        const aIsNew = !!(a.createdAt && (now - new Date(a.createdAt).getTime()) < msThreshold);
        const bIsNew = !!(b.createdAt && (now - new Date(b.createdAt).getTime()) < msThreshold);
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
    if (!selectedEmployee) {
      addToast('error', '請先在上方選擇「點餐人員」再進行鎖定');
      return;
    }
    lockCategoryRestaurant(selectedCategory, restaurantId)
      .then((res) => {
        if (res && !res.ok) {
          addToast('error', res.error || '鎖定失敗');
        } else {
          addToast('success', `已成功鎖定「${selectedCategory}」為指定餐廳！`);
        }
      });
  };

  const handleUnlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    unlockCategory(selectedCategory)
      .then((res) => {
        if (res && !res.ok) {
          addToast('error', res.error || '解鎖失敗');
        } else {
          addToast('success', `已成功解除「${selectedCategory}」的餐廳鎖定`);
        }
      });
  };

  return (
    <div className="animate-slide-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div className="h3" style={{ marginBottom: 0 }}>🏠 選擇餐廳</div>
        {isCategoryLocked && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--error)',
              fontWeight: '600',
              backgroundColor: 'var(--error-muted, #ffeef0)',
              padding: '4px 10px',
              borderRadius: '4px',
              border: '1.5px solid var(--error)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Lock size={12} />
            此分類已鎖定
          </div>
        )}
      </div>

      <div className="option-grid">
        {restaurants.map((r) => {
          const isThisRestLocked = isCategoryLocked && activeLock.restaurantId === r.id;
          const isDisabled = isCategoryLocked && activeLock.restaurantId !== r.id;
          const isSelected = selectedRestaurant === r.id;
          const isNewRestaurant = !!(r.createdAt && (Date.now() - new Date(r.createdAt).getTime()) < newItemDisplayDays * 86400000);


          return (
            <div
              key={r.id}
              className={classNames('option-card', {
                selected: isSelected,
              })}
              style={
                isDisabled
                  ? {
                      opacity: 0.4,
                      cursor: 'not-allowed',
                      pointerEvents: 'none',
                      borderStyle: 'dashed',
                      minHeight: '80px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }
                  : {
                      minHeight: '80px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }
              }
              onClick={() => {
                if (!isDisabled) {
                  setRestaurant(r.id);
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                <span className="option-name">
                  {r.name}
                  {isNewRestaurant && (
                    <span className="badge badge-new" style={{ marginLeft: 6 }}>
                      <Sparkles size={10} /> 新加入
                    </span>
                  )}
                </span>
                {isThisRestLocked && (
                  <span
                    className="badge badge-error"
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      backgroundColor: 'var(--error-muted, #ffeef0)',
                      color: 'var(--error, #f85149)',
                      border: '1px solid var(--error, #f85149)',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}
                  >
                    <Lock size={10} />
                    已鎖定
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%', marginTop: '8px' }}>
                {isThisRestLocked ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <button
                      className="btn btn-outline"
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        borderColor: 'var(--error)',
                        color: 'var(--error)',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      onClick={handleUnlock}
                    >
                      <Unlock size={10} />
                      解鎖
                    </button>
                    {activeLock.lockedBy && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted, #8b949e)' }}>
                        鎖定者: {activeLock.lockedBy}
                      </span>
                    )}
                  </div>
                ) : (
                  isSelected && !isCategoryLocked && (
                    <button
                      className="btn btn-outline"
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      onClick={(e) => handleLock(e, r.id)}
                    >
                      <Lock size={10} />
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
