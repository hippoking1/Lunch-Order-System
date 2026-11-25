import { useMemo } from 'react';
import classNames from 'classnames';
import { UtensilsCrossed, ClipboardList, Wallet, Settings } from 'lucide-react';
import { useStore } from '../../store';
import type { AppTab } from '../../types';

const BASE_TABS: { key: AppTab; label: string; icon: typeof UtensilsCrossed }[] = [
  { key: 'order', label: '點餐', icon: UtensilsCrossed },
  { key: 'summary', label: '總覽', icon: ClipboardList },
  { key: 'recon', label: '帳務', icon: Wallet },
];

const ADMIN_TAB = { key: 'admin' as AppTab, label: '管理', icon: Settings };

export default function BottomNav() {
  const activeTab = useStore((s) => s.activeTab);
  const setOption = useStore((s) => s.setOption);
  const userRole = useStore((s) => s.userRole);
  const summary = useStore((s) => s.summary);

  const badges = useMemo(() => {
    let totalQty = 0;
    const empMap = new Map<string, boolean>();
    summary.forEach((o) => {
      totalQty += o.quantity;
      const settled = Boolean(o.isChangeGiven || o.isPaidByBalance);
      const prev = empMap.get(o.employee);
      empMap.set(o.employee, prev === undefined ? settled : prev && settled);
    });
    let unsettledEmp = 0;
    empMap.forEach((isSettled) => {
      if (!isSettled) unsettledEmp++;
    });
    return { totalQty, unsettledEmp };
  }, [summary]);

  const tabs = userRole === 'admin' ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  return (
    <nav className="bottom-nav" aria-label="主要導覽">
      {tabs.map(({ key, label, icon: Icon }) => {
        const badgeCount =
          key === 'summary'
            ? badges.totalQty
            : key === 'recon'
              ? badges.unsettledEmp
              : 0;
        return (
          <button
            key={key}
            type="button"
            className={classNames('bottom-nav-item', {
              active: activeTab === key,
            })}
            aria-current={activeTab === key ? 'page' : undefined}
            onClick={() => setOption('activeTab', key)}
          >
            <Icon size={20} strokeWidth={1.5} />
            {label}
            {badgeCount > 0 && (
              <span className="nav-badge" aria-label={`${badgeCount} 項`}>
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
