import { useState, useEffect } from 'react';
import { Pencil, Check } from 'lucide-react';
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
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              e.preventDefault();
              handleSave();
            }
            if (e.key === 'Escape') {
              setNote(initialNote);
              setIsEditing(false);
            }
          }}
          autoFocus
        />
        <button
          type="button"
          className="chip-btn active"
          onClick={handleSave}
        >
          儲存
        </button>
        <button
          type="button"
          className="chip-btn"
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
      className="label flex items-center gap-1 cursor-pointer"
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
      <Pencil size={11} strokeWidth={1.5} style={{ opacity: 0.6 }} />
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

  const isSettled = orders.every((o) => o.isChangeGiven || o.isPaidByBalance);
  const isBalanceSettled = orders.every((o) => o.isPaidByBalance);

  const handleCalc = async () => {
    const p = Number(paid) || 0;
    const c = p - subtotal;
    setChange(String(c));
    await store.savePayment(employee, p, c);
    addToast('success', `已為 ${employee} 計算找零 $${c}`);
  };

  const handleQuickPay = async (cashAmount: number, markGiven = false) => {
    const c = cashAmount - subtotal;
    setPaid(String(cashAmount));
    setChange(String(c));
    await store.savePayment(employee, cashAmount, c);
    if (markGiven) {
      await store.setChangeGiven(employee, true);
      addToast('success', `${employee} 已剛好結清 $${cashAmount}`);
    } else {
      addToast('success', `${employee} 收 $${cashAmount}，應找 $${c}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteTarget(null);
    const res = await store.deleteOrder(deleteTarget.rowNumber);
    addToast('success', `訂單已刪除${res.message || ''}`);
  };

  return (
    <>
      <div
        className="card mb-3"
        style={{
          borderColor: isSettled ? 'var(--success)' : undefined,
        }}
      >
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`status-dot ${isSettled ? 'status-dot-success' : 'status-dot-warning'}`}
            />
            <h4 className="font-semibold" style={{ fontSize: '16px' }}>
              {employee}
            </h4>
            {isSettled && (
              <span className="badge badge-success">
                {isBalanceSettled ? '餘額結清' : '已結清'}
              </span>
            )}
          </div>
          <span className="price-display price-md">${subtotal}</span>
        </div>

        {/* Order items */}
        <div className="flex flex-col mb-3">
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
                className="flex justify-between items-center gap-2"
                style={{
                  padding: '8px 0',
                  borderBottom:
                    idx === orders.length - 1
                      ? 'none'
                      : '1px dashed var(--divider)',
                }}
              >
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <span className="font-semibold">
                    {o.item}{' '}
                    <span className="mono badge badge-default">
                      x{o.quantity}
                    </span>
                  </span>
                  {isDrink && (o.sweetness || o.ice) && (
                    <div className="label mt-1">
                      {o.sweetness} {o.ice}
                    </div>
                  )}
                  <EditableNote
                    initialNote={o.note || ''}
                    rowNumber={o.rowNumber}
                  />
                </div>
                <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                  <span className="mono font-semibold">${o.totalPrice}</span>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
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
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                className="chip-btn"
                onClick={() => handleQuickPay(subtotal, true)}
              >
                <Check size={12} strokeWidth={1.5} />
                剛好結清
              </button>
              {[100, 500, 1000].map((bill) => (
                <button
                  key={bill}
                  type="button"
                  className="chip-btn"
                  onClick={() => handleQuickPay(bill, false)}
                >
                  ${bill}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 items-end mb-3">
            <div className="flex-1">
              <label className="label">已繳</label>
              <input
                type="number"
                className="mono"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="label">應找</label>
              <input
                type="number"
                className="mono"
                value={change}
                onChange={(e) => setChange(e.target.value)}
              />
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleCalc}>
              計算
            </button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer caption">
            <input
              type="checkbox"
              className="checkbox-styled"
              checked={orders[0]?.isChangeGiven || false}
              onChange={(e) =>
                store.setChangeGiven(employee, e.target.checked)
              }
            />
            已找零 / 已結清
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
