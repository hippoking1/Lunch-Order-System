import { useMemo } from 'react';
import classNames from 'classnames';
import { Loader2, Plus, Minus, Send } from 'lucide-react';
import {
  useStore,
  getFreeExtrasCount,
  isDrinkItem,
  calculateItemPricing,
} from '../../store';
import { useToast } from '../../hooks/useToast';
import { SWEETNESS_OPTIONS, ICE_OPTIONS } from '../../constants';
import type { Extra } from '../../types';

export default function ItemCustomizer() {
  const store = useStore();
  const addToast = useToast((s) => s.addToast);

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

  const pricing = useMemo(() => {
    if (!store.selectedItem) {
      return {
        unitPrice: 0,
        originalPrice: 0,
        specialLabel: undefined,
        extrasTotal: 0,
        extrasNames: [],
        totalPrice: 0,
      };
    }
    const restaurantExtras =
      store.menuPayload?.extras.filter(
        (e) => e.restaurantId === store.selectedRestaurant,
      ) || [];
    return calculateItemPricing({
      item: store.selectedItem,
      selectedPortion: store.selectedPortion,
      selectedSingleExtras: store.selectedSingleExtras,
      selectedExtras: store.selectedExtras,
      quantity: store.quantity,
      restaurantExtras,
      specialPrices: store.menuPayload?.specialPrices,
    });
  }, [
    store.selectedItem,
    store.selectedPortion,
    store.selectedSingleExtras,
    store.selectedExtras,
    store.quantity,
    store.menuPayload,
    store.selectedRestaurant,
  ]);

  const currentRest = useMemo(() => {
    return store.menuPayload?.restaurants.find(
      (r) => r.id === store.selectedRestaurant,
    );
  }, [store.menuPayload, store.selectedRestaurant]);

  const sweetnessOptions =
    currentRest?.sweetnessOptions && currentRest.sweetnessOptions.length > 0
      ? currentRest.sweetnessOptions
      : SWEETNESS_OPTIONS;

  const iceOptions =
    currentRest?.iceOptions && currentRest.iceOptions.length > 0
      ? currentRest.iceOptions
      : ICE_OPTIONS;

  const isDrink = isDrinkItem(
    store.selectedItem,
    currentRest,
    store.selectedCategory,
  );

  const handleSubmit = async () => {
    if (!store.selectedEmployee.trim()) {
      addToast('error', '請先在上方選擇訂餐人姓名');
      const input = document.getElementById('employee-input');
      if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus();
      }
      return;
    }

    const itemName = store.selectedItem?.name || '';
    const qty = store.quantity;
    const total = pricing.totalPrice;

    const res = await store.submitOrder();
    if (res.ok) {
      addToast('success', `已送出：${itemName} × ${qty} ($${total})`);
    } else {
      addToast('error', res.error || '送出訂單失敗');
    }
  };

  if (!store.selectedItem) return null;

  const trimmedEmp = store.selectedEmployee.trim();
  const hasSpecial = pricing.unitPrice < pricing.originalPrice;

  return (
    <div className="card animate-slide-up flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="h2">{store.selectedItem.name}</h2>
        <div className="flex items-center gap-2">
          {hasSpecial && (
            <>
              <span className="badge badge-error">
                {pricing.specialLabel || '特價'}
              </span>
              <s className="mono caption text-muted">${pricing.originalPrice}</s>
            </>
          )}
          <span className="mono font-semibold" style={{ color: 'var(--primary)' }}>
            ${pricing.unitPrice}
          </span>
        </div>
      </div>

      {/* Portions */}
      {store.selectedItem.portions?.length > 0 && (
        <div>
          <div className="caption mb-2">份量選擇</div>
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
                    padding: '8px 14px',
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
          <div className="caption mb-2">口味</div>
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
                  style={{ padding: '8px 14px', flexDirection: 'row' }}
                >
                  {fn}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Sweetness / Ice (drinks only) */}
      {isDrink && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="caption mb-1" style={{ display: 'block' }}>
              甜度
            </label>
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
            <label className="caption mb-1" style={{ display: 'block' }}>
              冰塊
            </label>
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
          <label className="caption mb-1" style={{ display: 'block' }}>
            {group}（單選）
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
          <div className="caption mb-2">
            加點（可複選
            {freeExtrasCount !== null
              ? `，已選 ${store.selectedExtras.length} / ${freeExtrasCount} 項配料`
              : ''}
            ）
          </div>
          <div className="flex gap-2 flex-wrap">
            {availableExtras.multiple.map((e) => {
              const isSelected = store.selectedExtras.includes(e.id);
              const disabled =
                freeExtrasCount !== null &&
                store.selectedExtras.length >= freeExtrasCount &&
                !isSelected;
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
                    padding: '8px 14px',
                    flexDirection: 'row',
                    alignItems: 'center',
                    opacity: disabled ? 0.45 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {e.name}{' '}
                  {freeExtrasCount !== null ? (
                    <span className="option-price" style={{ marginLeft: 6 }}>
                      {e.price > 0 ? (
                        <span>
                          <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>
                            +${e.price}
                          </span>
                          <span style={{ color: 'var(--success)', marginLeft: '4px' }}>
                            免費
                          </span>
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
        <label className="caption mb-1" style={{ display: 'block' }}>
          備註
        </label>
        <input
          type="text"
          placeholder="例如：不要香菜"
          value={store.note}
          onChange={(e) => store.setOption('note', e.target.value)}
        />
      </div>

      {/* Receipt Footer Moment */}
      <div className="card-section flex flex-col gap-3">
        <div className="receipt-row">
          <span className="caption">
            {store.selectedItem.name} × {store.quantity}
          </span>
          <span className="receipt-leader" />
          <span className="price-display price-lg">${pricing.totalPrice}</span>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="qty-control">
            <button
              type="button"
              className="qty-btn"
              onClick={() => store.setQuantity(store.quantity - 1)}
            >
              <Minus size={16} strokeWidth={1.5} />
            </button>
            <div className="qty-value">{store.quantity}</div>
            <button
              type="button"
              className="qty-btn"
              onClick={() => store.setQuantity(store.quantity + 1)}
            >
              <Plus size={16} strokeWidth={1.5} />
            </button>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            disabled={store.loading}
            onClick={handleSubmit}
          >
            {store.loading ? (
              <Loader2 className="animate-spin" size={16} strokeWidth={1.5} />
            ) : (
              <Send size={16} strokeWidth={1.5} />
            )}
            {trimmedEmp ? `以 ${trimmedEmp} 送出` : '確認送出'}
          </button>
        </div>
      </div>
    </div>
  );
}
