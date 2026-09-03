import { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { useToast } from '../../hooks/useToast';
import type { OrderRecord } from '../../types';
import Modal from '../common/Modal';

function EditableNote({
  initialNote,
  rowNumber,
}: {
  initialNote: string;
  rowNumber: string | number;
}) {
  const updateNote = useStore((s) => s.updateNote);
  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState(initialNote);

  const handleSave = () => {
    if (note !== initialNote) {
      updateNote(rowNumber, note);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <input
          type="text"
          className="caption"
          style={{
            padding: '2px 6px',
            border: '1px solid var(--primary)',
            borderRadius: '4px',
            width: '150px',
          }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') {
              setNote(initialNote);
              setIsEditing(false);
            }
          }}
          autoFocus
        />
        <button
          className="badge badge-accent"
          style={{ border: 'none', cursor: 'pointer', padding: '2px 6px' }}
          onClick={handleSave}
        >
          儲存
        </button>
        <button
          className="badge badge-default"
          style={{ border: 'none', cursor: 'pointer', padding: '2px 6px' }}
          onClick={() => {
            setNote(initialNote);
            setIsEditing(false);
          }}
        >
          取消
        </button>
      </div>
    );
  }

  return (
    <div
      className="caption text-muted flex items-center gap-2 cursor-pointer"
      style={{ marginTop: '2px' }}
      onClick={() => {
        setNote(initialNote);
        setIsEditing(true);
      }}
      title="點擊修改備註"
    >
      <span>
        備註：{initialNote || <span style={{ opacity: 0.5 }}>無</span>}
      </span>
      <span style={{ fontSize: '11px', opacity: 0.6 }}>✏️</span>
    </div>
  );
}

interface Props {
  employee: string;
  orders: OrderRecord[];
}

export default function EmployeeReconCard({ employee, orders }: Props) {
  const store = useStore();
  const addToast = useToast((s) => s.addToast);
  const subtotal = orders.reduce((a, b) => a + b.totalPrice, 0);

  const [paid, setPaid] = useState<string>(
    orders[0]?.paidAmount !== '' ? String(orders[0]?.paidAmount ?? '') : '',
  );
  const [change, setChange] = useState<string>(
    orders[0]?.changeAmount !== '' ? String(orders[0]?.changeAmount ?? '') : '',
  );
  const [deleteTarget, setDeleteTarget] = useState<OrderRecord | null>(null);

  useEffect(() => {
    setPaid(
      orders[0]?.paidAmount !== '' ? String(orders[0]?.paidAmount ?? '') : '',
    );
    setChange(
      orders[0]?.changeAmount !== '' ? String(orders[0]?.changeAmount ?? '') : '',
    );
  }, [orders]);

  const handleCalc = () => {
    const p = Number(paid) || 0;
    const c = p - subtotal;
    setChange(String(c));
    store.savePayment(employee, p, c);
    addToast('success', `已為 ${employee} 計算找零 $${c}`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteTarget(null);
    await store.deleteOrder(deleteTarget.rowNumber);
    addToast('success', '訂單已刪除');
  };

  return (
    <>
      <div className="card mb-4">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold" style={{ fontSize: '18px' }}>
            {employee}
          </h4>
          <span className="price-display price-md">${subtotal}</span>
        </div>

        {/* Order items */}
        <div className="flex flex-col mb-4">
          {orders.map((o, idx) => {
            let isDrink = false;
            if (store.menuPayload) {
              const rest = store.menuPayload.restaurants.find(
                (r) => String(r.id) === String(o.restaurantId),
              );
              if (rest?.category === '飲料') isDrink = true;
            }
            return (
              <div
                key={idx}
                className="flex justify-between items-center"
                style={{
                  padding: '8px 0',
                  borderBottom:
                    idx === orders.length - 1
                      ? 'none'
                      : '1px dashed var(--divider)',
                }}
              >
                <div>
                  <span className="font-semibold">
                    {o.item}{' '}
                    <span className="mono caption badge badge-default">
                      x{o.quantity}
                    </span>
                  </span>
                  {isDrink && (o.sweetness || o.ice) && (
                    <div className="caption text-muted mt-1">
                      {o.sweetness} {o.ice}
                    </div>
                  )}
                  <EditableNote
                    initialNote={o.note || ''}
                    rowNumber={o.rowNumber}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="mono font-semibold">${o.totalPrice}</span>
                  <button
                    className="btn btn-danger"
                    onClick={() => setDeleteTarget(o)}
                  >
                    刪除
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Payment section */}
        <div className="card-section">
          <div className="flex gap-4 items-end mb-3">
            <div className="flex-1">
              <label className="caption">已繳</label>
              <input
                type="number"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="caption">應找</label>
              <input
                type="number"
                value={change}
                onChange={(e) => setChange(e.target.value)}
              />
            </div>
            <button className="btn btn-outline" onClick={handleCalc}>
              計算
            </button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer font-semibold">
            <input
              type="checkbox"
              className="checkbox-styled"
              checked={orders[0]?.isChangeGiven || false}
              onChange={(e) =>
                store.setChangeGiven(employee, e.target.checked)
              }
            />
            已找 (打勾即時記錄)
          </label>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <Modal
          title="確認刪除"
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          confirmLabel="確認刪除"
          variant="danger"
        >
          確定要刪除「{deleteTarget.item}」嗎？此操作無法復原。
        </Modal>
      )}
    </>
  );
}
