import { useEffect, useId, useMemo, useRef } from 'react';
import classNames from 'classnames';
import { Loader2, Plus, Minus, Send, X, AlertTriangle } from 'lucide-react';
import {
  useStore,
  getFreeExtrasCount,
  isDrinkItem,
  calculateItemPricing,
} from '../../store';
import { useToast } from '../../hooks/useToast';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { SWEETNESS_OPTIONS, ICE_OPTIONS } from '../../constants';
import { dedupePortions } from '../../utils/normalize';
import type { Extra } from '../../types';

export default function ItemCustomizer() {
  const store = useStore();
  const addToast = useToast((s) => s.addToast);
  const isDesktop = useIsDesktop();
  const sheetRef = useRef<HTMLDialogElement>(null);
  const sheetTitleId = useId();

  const portions = useMemo(
    () => dedupePortions(store.selectedItem?.portions),
    [store.selectedItem],
  );

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
      item: { ...store.selectedItem, portions },
      selectedPortion: store.selectedPortion,
      selectedSingleExtras: store.selectedSingleExtras,
      selectedExtras: store.selectedExtras,
      quantity: store.quantity,
      restaurantExtras,
      specialPrices: store.menuPayload?.specialPrices,
    });
  }, [
    store.selectedItem,
    portions,
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

  // Sync mobile bottom-sheet <dialog> open/close state
  useEffect(() => {
    const dialog = sheetRef.current;
    if (!dialog) return;
    if (!isDesktop && store.selectedItem) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isDesktop, store.selectedItem]);

  // Safari fallback for closedby="any" on bottom-sheet dialog
  useEffect(() => {
    const dialog = sheetRef.current;
    if (!dialog || isDesktop || !store.selectedItem) return;
    if ('closedBy' in HTMLDialogElement.prototype) return;

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };
    let pressedOutside = false;
    const onDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) dialog.close();
      pressedOutside = false;
    };
    dialog.addEventListener('pointerdown', onDown);
    dialog.addEventListener('pointerup', onUp);
    return () => {
      dialog.removeEventListener('pointerdown', onDown);
      dialog.removeEventListener('pointerup', onUp);
    };
  }, [isDesktop, store.selectedItem]);

  const handleClose = () => {
    store.setItem(null);
  };

  const handleSubmit = async () => {
    if (!store.selectedEmployee.trim()) {
      handleClose();
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
      if (res.balanceInsufficient) {
        addToast(
          'info',
          `已送出：${itemName} × ${qty} ($${total})，因餘額不足改列現金對帳`,
        );
      } else {
        addToast('success', `已送出：${itemName} × ${qty} ($${total})`);
      }
    } else {
      addToast('error', res.error || '送出訂單失敗');
    }
  };

  if (!store.selectedItem) return null;

  const trimmedEmp = store.selectedEmployee.trim();
  const hasSpecial = pricing.unitPrice < pricing.originalPrice;
  const isBalanceShort =
    store.balanceEnabled &&
    store.useBalance &&
    store.balance !== null &&
    store.balance < pricing.totalPrice;

  const content = (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <h2 id={sheetTitleId} className="h2">
          {store.selectedItem.name}
        </h2>
        <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
          {hasSpecial && (
            <>
              <span className="badge badge-error">
                {pricing.specialLabel || '特價'}
              </span>
              <s className="mono caption text-muted">
                ${pricing.originalPrice}
              </s>
            </>
          )}
          <span
            className="mono font-semibold"
            style={{ color: 'var(--primary)' }}
          >
            ${pricing.unitPrice}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label="關閉客製面板"
            onClick={handleClose}
            style={{ width: 28, height: 28 }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Portions */}
      {portions.length > 0 && (
        <div>
          <div className="caption mb-2">份量選擇</div>
          <div className="flex gap-2 flex-wrap">
            {portions.map((p) => (
              <button
                type="button"
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
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <span>{p.name}</span>
                <span className="option-price">${p.price}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Flavors (single select) */}
      {store.selectedItem.flavors && (
        <div>
          <div className="caption mb-2">口味</div>
          <div className="spec-pill-group">
            {store.selectedItem.flavors
              .split(',')
              .map((f: string) => f.trim())
              .filter(Boolean)
              .map((fn: string) => (
                <button
                  type="button"
                  key={fn}
                  className={classNames('spec-pill', {
                    selected: store.selectedFlavors.includes(fn),
                  })}
                  onClick={() => store.toggleFlavor(fn)}
                >
                  {fn}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Sweetness / Ice (drinks only — 1-tap pill chips with personal preference memory) */}
      {isDrink && (
        <div className="flex flex-col gap-3">
          <div>
            <div className="caption mb-2">甜度</div>
            <div className="spec-pill-group">
              {sweetnessOptions.map((s) => (
                <button
                  type="button"
                  key={s}
                  className={classNames('spec-pill', {
                    selected: store.sweetness === s,
                  })}
                  onClick={() => store.setOption('sweetness', s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="caption mb-2">冰塊</div>
            <div className="spec-pill-group">
              {iceOptions.map((i) => (
                <button
                  type="button"
                  key={i}
                  className={classNames('spec-pill', {
                    selected: store.ice === i,
                  })}
                  onClick={() => store.setOption('ice', i)}
                >
                  {i}
                </button>
              ))}
            </div>
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
                <button
                  type="button"
                  key={e.id}
                  disabled={disabled}
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
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {e.name}{' '}
                  {freeExtrasCount !== null ? (
                    <span className="option-price" style={{ marginLeft: 6 }}>
                      {e.price > 0 ? (
                        <span>
                          <span
                            style={{
                              textDecoration: 'line-through',
                              opacity: 0.6,
                            }}
                          >
                            +${e.price}
                          </span>
                          <span
                            style={{
                              color: 'var(--success)',
                              marginLeft: '4px',
                            }}
                          >
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
                </button>
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
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.nativeEvent.isComposing &&
              e.keyCode !== 229
            ) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
        />
      </div>

      {/* Balance insufficient warning (only when balance feature is enabled & checked) */}
      {isBalanceShort && (
        <div
          className="flex items-center gap-2 caption"
          style={{
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--warning-muted)',
            color: 'var(--warning)',
          }}
        >
          <AlertTriangle size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
          <span>
            目前帳戶餘額 <b className="mono">${store.balance}</b> 不足（差{' '}
            <b className="mono">${pricing.totalPrice - (store.balance || 0)}</b>
            ），送出後將改為現金對帳。
          </span>
        </div>
      )}

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
              aria-label="減少數量"
              onClick={() => store.setQuantity(store.quantity - 1)}
            >
              <Minus size={16} strokeWidth={1.5} />
            </button>
            <div className="qty-value">{store.quantity}</div>
            <button
              type="button"
              className="qty-btn"
              aria-label="增加數量"
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

  if (!isDesktop) {
    return (
      <dialog
        ref={sheetRef}
        aria-labelledby={sheetTitleId}
        className="bottom-sheet-dialog"
        onClose={handleClose}
        {...({ closedby: 'any' } as Record<string, string>)}
      >
        <div className="bottom-sheet-body">
          <div className="bottom-sheet-handle" aria-hidden="true" />
          {content}
        </div>
      </dialog>
    );
  }

  return <div className="card animate-slide-up">{content}</div>;
}
