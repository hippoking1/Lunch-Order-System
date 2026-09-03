import { useState, useCallback } from 'react';
import classNames from 'classnames';
import { useStore } from '../../store';

export default function EmployeeSelector() {
  const store = useStore();
  const [depositAmount, setDepositAmount] = useState('');

  const handleDeposit = useCallback(async () => {
    const amt = Number(depositAmount);
    if (amt > 0) {
      await store.depositBalance(amt);
      setDepositAmount('');
    }
  }, [depositAmount, store]);

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-3">
        <div className="h3">👤 訂餐人</div>
        {store.balance !== null && (
          <div
            className={classNames(
              'badge',
              store.balance >= 0 ? 'badge-success' : 'badge-error',
            )}
          >
            餘額 ${store.balance}
          </div>
        )}
      </div>

      <input
        type="text"
        list="employee-list"
        placeholder="請點擊選擇或直接輸入姓名..."
        value={store.selectedEmployee}
        onChange={(e) => store.setEmployee(e.target.value)}
      />
      <datalist id="employee-list">
        {store.employees.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>

      {store.selectedEmployee && (
        <>
          {/* Deposit widget */}
          <div className="flex items-center gap-2 mt-4 card-section">
            <input
              type="number"
              placeholder="儲值金額"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="flex-1"
            />
            <button className="btn btn-outline" onClick={handleDeposit}>
              儲值
            </button>
          </div>

          {/* useBalance toggle */}
          <div className="flex items-center justify-between mt-3">
            <span className="caption font-semibold">使用餘額扣款</span>
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

