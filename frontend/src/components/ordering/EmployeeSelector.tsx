import { useState, useCallback } from 'react';
import classNames from 'classnames';
import { User, Plus, X } from 'lucide-react';
import { useStore } from '../../store';
import { useToast } from '../../hooks/useToast';

export default function EmployeeSelector() {
  const store = useStore();
  const addToast = useToast((s) => s.addToast);
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

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-3">
        <div className="h3">
          <User size={16} strokeWidth={1.5} />
          訂餐人
        </div>
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

      {store.selectedEmployee && (
        <>
          {showDeposit && (
            <div className="flex items-center gap-2 mt-3 card-section">
              <input
                type="number"
                placeholder="儲值金額"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleDeposit();
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
    </div>
  );
}
