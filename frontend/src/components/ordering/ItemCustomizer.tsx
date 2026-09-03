import { useMemo } from 'react';
import classNames from 'classnames';
import { Loader2, Plus, Minus, Send } from 'lucide-react';
import { useStore, getFreeExtrasCount } from '../../store';
import { SWEETNESS_OPTIONS, ICE_OPTIONS } from '../../constants';
import type { Extra } from '../../types';

export default function ItemCustomizer() {
  const store = useStore();

  const availableExtras = useMemo(() => {
    if (!store.menuPayload || !store.selectedRestaurant)
      return { single: {} as Record<string, Extra[]>, multiple: [] as Extra[] };
    const all = store.menuPayload.extras.filter(
      (e) => e.restaurantId === store.selectedRestaurant,
    );
    const result: { single: Record<string, Extra[]>; multiple: Extra[] } = {
      single: {},
      multiple: [],
    };
    all.forEach((e) => {
      if (e.type === 'single') {
        if (!result.single[e.group]) result.single[e.group] = [];
        result.single[e.group].push(e);
      } else {
        result.multiple.push(e);
      }
    });
    return result;
  }, [store.menuPayload, store.selectedRestaurant]);

  const freeExtrasCount = useMemo(() => {
    if (!store.selectedItem) return null;
    return getFreeExtrasCount(store.selectedItem.name);
  }, [store.selectedItem]);

  const calculatedPrice = useMemo(() => {
    if (!store.selectedItem) return 0;
    let base = store.selectedItem.price;
    if (store.selectedPortion) {
      const p = store.selectedItem.portions?.find(
        (x: { name: string; price: number }) => x.name === store.selectedPortion,
      );
      if (p) base = p.price;
    }
    let extrasTotal = 0;
    const allEx =
      store.menuPayload?.extras.filter(
        (e) => e.restaurantId === store.selectedRestaurant,
      ) || [];
    Object.values(store.selectedSingleExtras).forEach((eid) => {
      const e = allEx.find((x) => String(x.id) === String(eid));
      if (e) extrasTotal += e.price;
    });

    const multipleExtrasList: { id: string; price: number }[] = [];
    store.selectedExtras.forEach((eid) => {
      const e = allEx.find((x) => String(x.id) === String(eid));
      if (e) {
        multipleExtrasList.push({ id: String(e.id), price: e.price });
      }
    });

    if (freeExtrasCount !== null) {
      const sortedList = [...multipleExtrasList].sort((a, b) => b.price - a.price);
      const freeIds = new Set<string>();
      for (let i = 0; i < Math.min(freeExtrasCount, sortedList.length); i++) {
        freeIds.add(sortedList[i].id);
      }
      multipleExtrasList.forEach((e) => {
        if (!freeIds.has(e.id)) {
          extrasTotal += e.price;
        }
      });
    } else {
      multipleExtrasList.forEach((e) => {
        extrasTotal += e.price;
      });
    }

    return (base + extrasTotal) * store.quantity;
  }, [
    store.selectedItem,
    store.selectedPortion,
    store.selectedSingleExtras,
    store.selectedExtras,
    store.quantity,
    store.menuPayload,
    store.selectedRestaurant,
    freeExtrasCount,
  ]);

  const currentRest = useMemo(() => {
    return store.menuPayload?.restaurants.find((r) => r.id === store.selectedRestaurant);
  }, [store.menuPayload, store.selectedRestaurant]);

  const sweetnessOptions = currentRest?.sweetnessOptions && currentRest.sweetnessOptions.length > 0
    ? currentRest.sweetnessOptions
    : SWEETNESS_OPTIONS;

  const iceOptions = currentRest?.iceOptions && currentRest.iceOptions.length > 0
    ? currentRest.iceOptions
    : ICE_OPTIONS;

  const isDrink =
    store.selectedItem?.category === '飲料' ||
    store.selectedCategory === '飲料';

  const handleSubmit = async () => {
    await store.submitOrder();
  };

  if (!store.selectedItem) return null;

  return (
    <div className="card animate-slide-up flex flex-col gap-5">
      <h2 className="h2">{store.selectedItem.name}</h2>

      {/* Portions */}
      {store.selectedItem.portions?.length > 0 && (
        <div>
          <div className="caption font-semibold mb-2">份量選擇</div>
          <div className="flex gap-2 flex-wrap">
            {store.selectedItem.portions.map(
              (p: { name: string; price: number }) => (
                <div
                  key={p.name}
                  className={classNames('option-card', {
                    selected: store.selectedPortion === p.name,
                  })}
                  onClick={() => store.setPortion(p.name)}
                  style={{
                    padding: '8px 16px',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <span>{p.name}</span>
                  <span className="option-price">${p.price}</span>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {/* Flavors (single select) */}
      {store.selectedItem.flavors && (
        <div>
          <div className="caption font-semibold mb-2">口味</div>
          <div className="flex gap-2 flex-wrap">
            {store.selectedItem.flavors
              .split(',')
              .map((f: string) => f.trim())
              .filter(Boolean)
              .map((fn: string) => (
                <div
                  key={fn}
                  className={classNames('option-card', {
                    selected: store.selectedFlavors.includes(fn),
                  })}
                  onClick={() => store.toggleFlavor(fn)}
                  style={{ padding: '8px 16px', flexDirection: 'row' }}
                >
                  {fn}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Sweetness / Ice (drinks only) */}
      {isDrink && (
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="caption">甜度</label>
            <select
              value={store.sweetness}
              onChange={(e) => store.setOption('sweetness', e.target.value)}
            >
              {sweetnessOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="caption">冰塊</label>
            <select
              value={store.ice}
              onChange={(e) => store.setOption('ice', e.target.value)}
            >
              {iceOptions.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Single select extras */}
      {Object.keys(availableExtras.single).map((group) => (
        <div key={group}>
          <label className="caption">
            {group} (單選)
          </label>
          <select
            value={store.selectedSingleExtras[group] || ''}
            onChange={(e) => store.setSingleExtra(group, e.target.value)}
          >
            <option value="">不加{group}</option>
            {availableExtras.single[group].map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} (+${e.price})
              </option>
            ))}
          </select>
        </div>
      ))}

      {/* Multi select extras */}
      {availableExtras.multiple.length > 0 && (
        <div>
          <div className="caption font-semibold mb-2">
            加點 (可複選
            {freeExtrasCount !== null
              ? `，已選 ${store.selectedExtras.length} / ${freeExtrasCount} 項配料`
              : ''}
            )
          </div>
          <div className="flex gap-2 flex-wrap">
            {availableExtras.multiple.map((e) => {
              const isSelected = store.selectedExtras.includes(e.id);
              const disabled = freeExtrasCount !== null && store.selectedExtras.length >= freeExtrasCount && !isSelected;
              return (
                <div
                  key={e.id}
                  className={classNames('option-card', {
                    selected: isSelected,
                    disabled: disabled,
                  })}
                  onClick={() => {
                    if (disabled) return;
                    store.toggleExtra(e.id);
                  }}
                  style={{
                    padding: '8px 16px',
                    flexDirection: 'row',
                    alignItems: 'center',
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {e.name}{' '}
                  {freeExtrasCount !== null ? (
                    <span className="option-price" style={{ marginLeft: 6 }}>
                      {e.price > 0 ? (
                        <span>
                          <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>+${e.price}</span>
                          <span style={{ color: '#10B981', marginLeft: '4px' }}>免費</span>
                        </span>
                      ) : (
                        `+$${e.price}`
                      )}
                    </span>
                  ) : (
                    <span className="option-price" style={{ marginLeft: 6 }}>
                      +${e.price}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Note */}
      <div>
        <label className="caption">備註</label>
        <input
          type="text"
          placeholder="例如: 不要香菜"
          value={store.note}
          onChange={(e) => store.setOption('note', e.target.value)}
        />
      </div>

      <hr className="divider" />

      {/* Quantity + Price + Submit */}
      <div className="flex items-center justify-between">
        <div className="qty-control">
          <button
            className="qty-btn"
            onClick={() => store.setQuantity(store.quantity - 1)}
          >
            <Minus size={18} />
          </button>
          <div className="qty-value">{store.quantity}</div>
          <button
            className="qty-btn"
            onClick={() => store.setQuantity(store.quantity + 1)}
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div>
            <div className="caption text-right">總金額</div>
            <div className="price-display price-lg">${calculatedPrice}</div>
          </div>
          <button
            className="btn btn-primary"
            disabled={store.loading}
            onClick={handleSubmit}
          >
            {store.loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Send size={20} />
            )}
            確認送出
          </button>
        </div>
      </div>
    </div>
  );
}
