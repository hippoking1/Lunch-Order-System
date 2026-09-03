import { useMemo, useState } from 'react';
import { useStore } from '../../store';
import type { OrderRecord } from '../../types';
import Modal from '../common/Modal';

function getOrderDetailsInfo(o: OrderRecord, isDrink: boolean = false): string {
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
  const telephone = store.telephones?.[restaurantId]?.telephone || '暫無電話';

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
      ? '2px solid var(--error)'
      : '2px solid var(--success)'
    : '1px solid var(--divider)';

  const handleConfirm = async () => {
    setConfirmModal(null);
    await store.confirmRestaurant(restaurantId);
  };

  const handleCancelConfirm = async () => {
    setConfirmModal(null);
    await store.cancelConfirm(restaurantId);
  };

  return (
    <>
      <div className="card mb-4" style={{ border: borderStyle }}>
        {/* Header */}
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <div className="flex gap-4 items-center flex-wrap">
            <h4 className="font-bold" style={{ fontSize: '18px' }}>
              {restaurantName}
            </h4>
            <span className="badge badge-accent">📞 {telephone}</span>
            <span className="mono font-semibold" style={{ color: 'var(--primary)' }}>
              共 {totalQty} 份 / ${totalPrice}
            </span>
          </div>
          <div className="flex gap-2">
            {!isConfirmed ? (
              <button
                className="btn btn-outline"
                style={{ padding: '6px 12px', fontSize: '13px' }}
                onClick={() => setConfirmModal('confirm')}
              >
                確認下單
              </button>
            ) : hasNew ? (
              <button
                className="btn btn-danger"
                onClick={() => setConfirmModal('confirm')}
              >
                ⚠️ 有新增 (重新確認)
              </button>
            ) : (
              <button
                className="badge badge-success cursor-pointer"
                style={{ border: 'none' }}
                onClick={() => setConfirmModal('cancel')}
              >
                ✅ 已確認 ({confirmedByName})
              </button>
            )}
          </div>
        </div>

        {/* Aggregated items (for phone ordering) */}
        <div className="card-section mb-4">
          <div className="caption font-bold mb-3">
            餐點細項展開 (打電叫餐用)
          </div>
          {aggregatedItems.map((item, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center"
              style={{
                borderBottom:
                  idx === aggregatedItems.length - 1
                    ? 'none'
                    : '1px dashed var(--divider)',
                padding: '6px 0',
              }}
            >
              <div>
                <span className="font-semibold">{item.name}</span>{' '}
                <span className="mono caption badge badge-default">
                  x{item.qty}
                </span>
                {item.detail && (
                  <div className="caption text-muted mt-1">
                    備註：{item.detail}
                  </div>
                )}
              </div>
              <div className="mono font-semibold">${item.totalPrice}</div>
            </div>
          ))}
        </div>

        {/* Employee detail table (for distribution) */}
        <div className="caption font-semibold mb-2">
          員工清單明細 (發餐用)
        </div>
        <table className="data-table">
          <tbody>
            {orders.map((o, idx) => (
              <tr key={idx}>
                <td style={{ minWidth: '80px' }}>
                  <div className="font-semibold">{o.employee}</div>
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>
                    {o.item}{' '}
                    <span className="mono">x{o.quantity}</span>
                  </div>
                  {getOrderDetailsInfo(o, isDrink) && (
                    <div className="caption text-muted">
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
