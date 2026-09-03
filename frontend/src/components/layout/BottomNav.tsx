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

  const tabs = userRole === 'admin' ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  return (
    <nav className="bottom-nav">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          className={classNames('bottom-nav-item', {
            active: activeTab === key,
          })}
          onClick={() => setOption('activeTab', key)}
        >
          <Icon size={22} />
          {label}
        </button>
      ))}
    </nav>
  );
}
