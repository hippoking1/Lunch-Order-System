import { useState, useCallback, useMemo } from 'react';
import classNames from 'classnames';
import { User, Plus, X, CheckCircle2, ChevronRight } from 'lucide-react';
import { useStore } from '../../store';
import { useToast } from '../../hooks/useToast';
import { useIsDesktop } from '../../hooks/useMediaQuery';

export default function EmployeeSelector() {
  const store = useStore();
  const addToast = useToast((s) => s.addToast);
  const isDesktop = useIsDesktop();
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');

  const handleDeposit = useCallback(async () => {
    const amt = Number(depositAmount);
    if (amt > 0) {
      const res = await store.depositBalance(amt);
      if (res.ok) {
        addToast('success', `已儲值 $${amt}`);
        setDepositAmount('');
        setShowDeposit(false);
      } else {
        addToast('error', res.error || '儲值失敗');
      }
    }
  }, [depositAmount, store, addToast]);

  const myTodayOrders = useMemo(() => {
    const emp = store.selectedEmployee.trim();
    if (!emp) return [];
    return store.summary.filter((o) => o.employee === emp);
  }, [store.selectedEmployee, store.summary]);

  const myTodayStats = useMemo(() => {
    let qty = 0;
    let total = 0;
    myTodayOrders.forEach((o) => {
      qty += o.quantity;
      total += o.totalPrice;
    });
    return { qty, total };
  }, [myTodayOrders]);

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-3">
        <div className="h3">
          <User size={16} strokeWidth={1.5} />
          訂餐人
        </div>
        {store.balanceEnabled && (
          <div className="flex items-center gap-2">
            {store.balance !== null && (
              <div
                className={classNames(
                  'badge mono',
                  store.balance >= 0 ? 'badge-success' : 'badge-error',
                )}
              >
                餘額 ${store.balance}
              </div>
            )}
            {store.selectedEmployee.trim() && (
              <button
                type="button"
                className={classNames('chip-btn', { active: showDeposit })}
                onClick={() => setShowDeposit((v) => !v)}
              >
                <Plus size={12} strokeWidth={1.5} />
                儲值
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <input
          id="employee-input"
          type="text"
          list="employee-list"
          placeholder="選擇或輸入姓名"
          value={store.selectedEmployee}
          onChange={(e) => store.setEmployee(e.target.value)}
          style={{ paddingRight: store.selectedEmployee ? '36px' : undefined }}
        />
        {store.selectedEmployee && (
          <button
            type="button"
            aria-label="清除訂餐人"
            onClick={() => {
              store.setEmployee('');
              setShowDeposit(false);
            }}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>
      <datalist id="employee-list">
        {store.employees.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>

      {store.balanceEnabled && store.selectedEmployee && (
        <>
          {showDeposit && (
            <div className="flex items-center gap-2 mt-3 card-section">
              <input
                type="number"
                placeholder="儲值金額"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    !e.nativeEvent.isComposing &&
                    e.keyCode !== 229
                  ) {
                    e.preventDefault();
                    void handleDeposit();
                  }
                }}
                className="flex-1"
                autoFocus
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleDeposit}
                disabled={!(Number(depositAmount) > 0)}
              >
                確認儲值
              </button>
            </div>
          )}

          {/* useBalance toggle — 預設不勾選，由使用者手動開啟 */}
          <div className="flex items-center justify-between mt-3">
            <span className="caption">使用餘額扣款</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={store.useBalance}
                onChange={(e) => store.setOption('useBalance', e.target.checked)}
              />
              <span className="toggle-track" />
            </label>
          </div>
        </>
      )}

      {/* 今日已點明細條（防重複點餐與即時安心回饋） */}
      {myTodayOrders.length > 0 && (
        <div
          className="card-section mt-3 flex flex-col gap-2"
          style={{ padding: '10px 12px' }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 caption">
              <CheckCircle2
                size={14}
                strokeWidth={1.5}
                style={{ color: 'var(--success)', flexShrink: 0 }}
              />
              <span>
                今日已點 <b className="mono">{myTodayStats.qty}</b> 份 ·{' '}
                <b className="mono" style={{ color: 'var(--primary)' }}>
                  ${myTodayStats.total}
                </b>
              </span>
            </div>
            {!isDesktop && (
              <button
                type="button"
                className="chip-btn"
                onClick={() => store.setOption('activeTab', 'summary')}
              >
                查看明細
                <ChevronRight size={12} strokeWidth={1.5} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {myTodayOrders.map((o) => (
              <span
                key={o.id}
                className="badge badge-default"
                style={{ fontSize: 11 }}
              >
                {o.item} ×{o.quantity}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
