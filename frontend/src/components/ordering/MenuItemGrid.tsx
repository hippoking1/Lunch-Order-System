import { useMemo, useState, useCallback } from 'react';
import classNames from 'classnames';
import { Search, Sparkles, Zap, Loader2 } from 'lucide-react';
import { useStore, isDrinkItem } from '../../store';
import type { MenuItem, FrequentOrderEntry } from '../../types';

export default function MenuItemGrid() {
  const menuPayload = useStore((s) => s.menuPayload);
  const selectedRestaurant = useStore((s) => s.selectedRestaurant);
  const selectedCategory = useStore((s) => s.selectedCategory);
  const selectedItem = useStore((s) => s.selectedItem);
  const setItem = useStore((s) => s.setItem);
  const customItemName = useStore((s) => s.customItemName);
  const customItemPrice = useStore((s) => s.customItemPrice);
  const setCustomItemName = useStore((s) => s.setCustomItemName);
  const setCustomItemPrice = useStore((s) => s.setCustomItemPrice);
  const frequentOrders = useStore((s) => s.frequentOrders);
  const frequentOrdersLoading = useStore((s) => s.frequentOrdersLoading);
  const applyFrequentOrder = useStore((s) => s.applyFrequentOrder);
  const newItemDisplayDays = useStore((s) => s.newItemDisplayDays);

  const [search, setSearch] = useState('');

  const handleFrequentOrder = useCallback(
    (fo: FrequentOrderEntry) => {
      applyFrequentOrder(fo);
    },
    [applyFrequentOrder],
  );

  const menuItems = useMemo(() => {
    if (!menuPayload || !selectedRestaurant) return [];
    let items = menuPayload.items.filter(
      (i) => i.restaurantId === selectedRestaurant,
    );
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(q));
    }
    return items;
  }, [menuPayload, selectedRestaurant, search]);

  const specialPrices = useMemo(() => {
    if (!menuPayload?.specialPrices) return new Map<string, { specialPrice: number; label: string; originalPrice: number }>();
    const map = new Map<string, { specialPrice: number; label: string; originalPrice: number }>();
    menuPayload.specialPrices.forEach((sp) => {
      map.set(`${sp.restaurantId}-${sp.itemId}`, {
        specialPrice: sp.specialPrice,
        label: sp.label,
        originalPrice: sp.originalPrice,
      });
    });
    return map;
  }, [menuPayload]);

  const groupedItems = useMemo(() => {
    const map: Record<string, MenuItem[]> = {};
    const specialOrLimited: MenuItem[] = [];
    const now = Date.now();
    const msThreshold = newItemDisplayDays * 86400000;

    menuItems.forEach((m) => {
      const isSpecial = specialPrices.has(`${m.restaurantId}-${m.id}`);
      const isLimited = !!m.limitedType;
      const isNew = !!(m.createdAt && (now - new Date(m.createdAt).getTime()) < msThreshold);

      if (isSpecial || isLimited || isNew) {
        specialOrLimited.push(m);
      }

      const sub = m.subCategory || '其他';
      if (!map[sub]) map[sub] = [];
      map[sub].push(m);
    });

    const finalMap: Record<string, MenuItem[]> = {};
    if (specialOrLimited.length > 0) {
      // Remove duplicates if any
      const uniqueFeatured = Array.from(new Map(specialOrLimited.map((item) => [item.id, item])).values());
      finalMap['🔥 優先推薦 & 期間限定'] = uniqueFeatured;
    }

    // Sort each original group so that specially marked items (期間限定, 新品上市, 店長推薦) appear first
    Object.keys(map).forEach((sub) => {
      const items = [...map[sub]];
      items.sort((a, b) => {
        const aIsSpecial = specialPrices.has(`${a.restaurantId}-${a.id}`);
        const aIsLimited = !!a.limitedType;
        const aIsNew = !!(a.createdAt && (now - new Date(a.createdAt).getTime()) < msThreshold);
        const aPriority = (aIsLimited || aIsSpecial || aIsNew) ? 0 : 1;

        const bIsSpecial = specialPrices.has(`${b.restaurantId}-${b.id}`);
        const bIsLimited = !!b.limitedType;
        const bIsNew = !!(b.createdAt && (now - new Date(b.createdAt).getTime()) < msThreshold);
        const bPriority = (bIsLimited || bIsSpecial || bIsNew) ? 0 : 1;

        return aPriority - bPriority;
      });
      finalMap[sub] = items;
    });

    return finalMap;
  }, [menuItems, specialPrices, newItemDisplayDays]);

  const handleCustomItem = () => {
    const price = Number(customItemPrice);
    if (customItemName.trim() && !isNaN(price) && customItemPrice !== '') {
      setItem({
        id: 'custom_item_' + Date.now(),
        name: customItemName.trim(),
        price,
        restaurantId: selectedRestaurant,
        isCustom: true,
        customName: customItemName.trim(),
        customPrice: price,
        category: '',
        image: '',
        subCategory: '',
        flavors: '',
        portions: [],
      } satisfies MenuItem);
    }
  };

  if (!selectedRestaurant) return null;

  const subKeys = Object.keys(groupedItems);

  return (
    <div className="animate-slide-up">
      <div className="h3 mb-3">🍽️ 選擇餐點</div>

      {/* Frequent orders */}
      {(frequentOrders.length > 0 || frequentOrdersLoading) && (
        <div className="mb-4">
          <div className="caption font-semibold mb-2 flex items-center gap-1">
            <Zap size={14} /> 常用點餐
            {frequentOrdersLoading && <Loader2 size={12} className="animate-spin" style={{ marginLeft: 4 }} />}
          </div>
          <div className="flex flex-col gap-2">
            {frequentOrders.map((fo, idx) => {
              const currentRest = menuPayload?.restaurants.find((r) => r.id === selectedRestaurant);
              const matchedItem = menuItems.find(
                (i) => String(i.id) === String(fo.itemId) || i.name === fo.itemName,
              );
              const isDrink = isDrinkItem(matchedItem, currentRest, selectedCategory);
              const detailParts = isDrink
                ? [fo.sweetness, fo.ice, fo.note].filter(Boolean)
                : [fo.note].filter(Boolean);
              return (
                <div
                  key={`${fo.itemId}-${idx}`}
                  className="quick-order-card"
                  onClick={() => handleFrequentOrder(fo)}
                >
                  <div className="flex-1">
                    <div className="option-name truncate">{fo.itemName}</div>
                    {detailParts.length > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {detailParts.join(' · ')}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span className="option-price mono">${fo.unitPrice}</span>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>×{fo.count}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="search-bar mb-3">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="搜尋餐點..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grouped items */}
      {subKeys.map((sub) => (
        <div key={sub} className="mb-4">
          {(sub !== '其他' || subKeys.length > 1) && (
            <div className="caption font-semibold mb-2">{sub}</div>
          )}
          <div className="option-grid">
            {groupedItems[sub].map((m, idx) =>
              m.image ? (
                <div
                  key={`${m.id}-${m.name}-${idx}`}
                  className={classNames('option-card menu-card', {
                    selected: selectedItem?.id === m.id,
                  })}
                  onClick={() => setItem(m)}
                >
                  <img
                    src={m.image}
                    alt={m.name}
                    className="menu-card-img"
                    loading="lazy"
                  />
                  <div className="menu-card-body">
                    <span className="option-name">
                      {m.name}
                      {!!(m.createdAt && (Date.now() - new Date(m.createdAt).getTime()) < newItemDisplayDays * 86400000) && (
                        <span className="badge badge-new" style={{ fontSize: 10, marginLeft: 4 }}>🆕 新品</span>
                      )}
                      {m.limitedType && <span className="badge badge-limited" style={{ fontSize: 10, marginLeft: 4 }}><Sparkles size={10} style={{ display: 'inline', verticalAlign: -1, marginRight: 2 }} />{m.limitedType}</span>}
                    </span>
                    {(() => {
                      const sp = specialPrices.get(`${m.restaurantId}-${m.id}`);
                      if (sp) {
                        return (
                          <span className="option-price">
                            <s style={{ color: 'var(--text-muted)', fontSize: 12 }}>${sp.originalPrice}</s>
                            {' '}
                            <span style={{ color: 'var(--error)' }}>${sp.specialPrice}</span>
                            {sp.label && <span className="badge badge-error" style={{ fontSize: 10, marginLeft: 4 }}>{sp.label}</span>}
                          </span>
                        );
                      }
                      return <span className="option-price">${m.price}</span>;
                    })()}
                  </div>
                </div>
              ) : (
                <div
                  key={`${m.id}-${m.name}-${idx}`}
                  className={classNames('option-card', {
                    selected: selectedItem?.id === m.id,
                  })}
                  onClick={() => setItem(m)}
                >
                  <span className="option-name">
                    {m.name}
                    {!!(m.createdAt && (Date.now() - new Date(m.createdAt).getTime()) < newItemDisplayDays * 86400000) && (
                      <span className="badge badge-new" style={{ fontSize: 10, marginLeft: 4 }}>🆕 新品</span>
                    )}
                    {m.limitedType && <span className="badge badge-limited" style={{ fontSize: 10, marginLeft: 4 }}><Sparkles size={10} style={{ display: 'inline', verticalAlign: -1, marginRight: 2 }} />{m.limitedType}</span>}
                  </span>
                  {(() => {
                    const sp = specialPrices.get(`${m.restaurantId}-${m.id}`);
                    if (sp) {
                      return (
                        <span className="option-price">
                          <s style={{ color: 'var(--text-muted)', fontSize: 12 }}>${sp.originalPrice}</s>
                          {' '}
                          <span style={{ color: 'var(--error)' }}>${sp.specialPrice}</span>
                          {sp.label && <span className="badge badge-error" style={{ fontSize: 10, marginLeft: 4 }}>{sp.label}</span>}
                        </span>
                      );
                    }
                    return <span className="option-price">${m.price}</span>;
                  })()}
                </div>
              ),
            )}
          </div>
        </div>
      ))}

      {/* Custom item input */}
      <hr className="divider" />
      <div className="caption font-semibold mb-2">自行輸入餐點</div>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="餐點名稱"
          className="flex-1"
          value={customItemName}
          onChange={(e) => setCustomItemName(e.target.value)}
        />
        <input
          type="number"
          placeholder="單價($)"
          style={{ width: '120px', flexShrink: 0 }}
          value={customItemPrice}
          onChange={(e) => setCustomItemPrice(e.target.value)}
        />
        <button className="btn btn-outline" style={{ flexShrink: 0 }} onClick={handleCustomItem}>
          確認並選擇
        </button>
      </div>
    </div>
  );
}
