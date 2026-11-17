import { useMemo, useState } from 'react';
import { Phone, Copy, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store';
import { useToast } from '../../hooks/useToast';
import type { OrderRecord } from '../../types';
import Modal from '../common/Modal';

function getOrderDetailsInfo(o: OrderRecord, isDrink = false): string {
  let d = o.note || '';
  if (o.category === '飲料' || isDrink) {
    if (o.sweetness) d = `${o.sweetness} ` + d;
    if (o.ice) d = `${o.ice} ` + d;
  }
  return d.trim();
}

interface Props {
  restaurantId: string;
  restaurantName: string;
  orders: OrderRecord[];
  categoryName: string;
}

export default function RestaurantOrderCard({
  restaurantId,
  restaurantName,
  orders,
  categoryName,
}: Props) {
  const store = useStore();
  const addToast = useToast((s) => s.addToast);
  const [confirmModal, setConfirmModal] = useState<'confirm' | 'cancel' | null>(
    null,
  );

  const confirmObj = store.confirmations?.[restaurantId];
  const isConfirmed = !!confirmObj;
  const confirmedByName = confirmObj?.confirmedBy || '系統';

  const hasNew = useMemo(() => {
    if (!isConfirmed || !confirmObj?.confirmedAt) return false;
    const cTime = new Date(confirmObj.confirmedAt).getTime();
    return orders.some(
      (o) => o.createdAt && new Date(o.createdAt).getTime() > cTime,
    );
  }, [isConfirmed, confirmObj, orders]);

  const totalQty = orders.reduce((a, b) => a + b.quantity, 0);
  const totalPrice = orders.reduce((a, b) => a + b.totalPrice, 0);
  const telephone = store.telephones?.[restaurantId]?.telephone || '';

  const isDrink = categoryName === '飲料';

  const aggregatedItems = useMemo(() => {
    const aggMap: Record<
      string,
      { qty: number; totalPrice: number; name: string; detail: string }
    > = {};
    orders.forEach((o) => {
      const normalizedDetail = getOrderDetailsInfo(o, isDrink)
        .replace(/加點:\s*/g, '')
        .trim();
      const key = `${o.item}||${normalizedDetail}`;
      if (!aggMap[key]) {
        aggMap[key] = { qty: 0, totalPrice: 0, name: o.item, detail: normalizedDetail };
      }
      aggMap[key].qty += o.quantity;
      aggMap[key].totalPrice += o.totalPrice;
    });
    return Object.values(aggMap);
  }, [orders, isDrink]);

  const borderStyle = isConfirmed
    ? hasNew
      ? '1px solid var(--error)'
      : '1px solid var(--success)'
    : '1px solid var(--glass-border)';

  const handleConfirm = async () => {
    setConfirmModal(null);
    await store.confirmRestaurant(restaurantId);
  };

  const handleCancelConfirm = async () => {
    setConfirmModal(null);
    await store.cancelConfirm(restaurantId);
  };

  const handleCopySummary = async () => {
    const lines = [
      `【${restaurantName}】共 ${totalQty} 份 / $${totalPrice}`,
      ...aggregatedItems.map((it) =>
        `- ${it.name} x${it.qty}${it.detail ? ` (${it.detail})` : ''}`,
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      addToast('success', `已複製「${restaurantName}」叫餐明細`);
    } catch {
      addToast('error', '複製失敗，請手動選取');
    }
  };

  return (
    <>
      <div className="card mb-3" style={{ border: borderStyle }}>
        {/* Header */}
        <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold" style={{ fontSize: '16px' }}>
                {restaurantName}
              </h4>
              <span className="mono font-semibold" style={{ color: 'var(--primary)' }}>
                {totalQty} 份 · ${totalPrice}
              </span>
            </div>
            {telephone ? (
              <a
                href={`tel:${telephone}`}
                className="label mono flex items-center gap-1"
                style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
              >
                <Phone size={12} strokeWidth={1.5} />
                {telephone}
              </a>
            ) : (
              <span className="label">暫無電話</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="chip-btn"
              onClick={handleCopySummary}
              title="複製叫餐明細"
            >
              <Copy size={12} strokeWidth={1.5} />
              複製明細
            </button>
            {!isConfirmed ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setConfirmModal('confirm')}
              >
                確認下單
              </button>
            ) : hasNew ? (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => setConfirmModal('confirm')}
              >
                <AlertTriangle size={14} strokeWidth={1.5} />
                有新增，重新確認
              </button>
            ) : (
              <button
                type="button"
                className="badge badge-success cursor-pointer"
                style={{ border: 'none', padding: '4px 10px' }}
                onClick={() => setConfirmModal('cancel')}
              >
                <CheckCircle2 size={13} strokeWidth={1.5} />
                已確認 ({confirmedByName})
              </button>
            )}
          </div>
        </div>

        {/* Aggregated items (for phone ordering) */}
        <div className="card-section mb-3">
          <div className="label mb-2">餐點細項展開（叫餐用）</div>
          {aggregatedItems.map((item, idx) => (
            <div key={idx} style={{ padding: '4px 0' }}>
              <div className="receipt-row" style={{ padding: 0 }}>
                <span className="font-semibold">
                  {item.name}{' '}
                  <span className="mono badge badge-default">x{item.qty}</span>
                </span>
                <span className="receipt-leader" />
                <span className="mono font-semibold">${item.totalPrice}</span>
              </div>
              {item.detail && (
                <div className="label" style={{ marginTop: 2 }}>
                  備註：{item.detail}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Employee detail table (for distribution) */}
        <div className="label mb-2">員工清單明細（發餐用）</div>
        <table className="data-table">
          <tbody>
            {orders.map((o, idx) => (
              <tr key={idx}>
                <td style={{ minWidth: '72px' }}>
                  <div className="font-semibold">{o.employee}</div>
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>
                    {o.item} <span className="mono">x{o.quantity}</span>
                  </div>
                  {getOrderDetailsInfo(o, isDrink) && (
                    <div className="label">
                      備註：{getOrderDetailsInfo(o, isDrink)}
                    </div>
                  )}
                </td>
                <td className="mono font-semibold text-right">${o.totalPrice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirm modal */}
      {confirmModal === 'confirm' && (
        <Modal
          title="確認下單"
          onClose={() => setConfirmModal(null)}
          onConfirm={handleConfirm}
        >
          確定要為「{restaurantName}」確認下單嗎？
        </Modal>
      )}
      {confirmModal === 'cancel' && (
        <Modal
          title="取消確認"
          onClose={() => setConfirmModal(null)}
          onConfirm={handleCancelConfirm}
          confirmLabel="取消確認"
          variant="danger"
        >
          確定要取消「{restaurantName}」的確認狀態嗎？
        </Modal>
      )}
    </>
  );
}
