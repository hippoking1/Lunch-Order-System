import { useEffect, useRef } from 'react';
import classNames from 'classnames';
import { Loader2 } from 'lucide-react';
import { useStore } from './store';
import { useIsDesktop } from './hooks/useMediaQuery';
import './index.css';

// Layout
import BottomNav from './components/layout/BottomNav';

// Common
import Toast from './components/common/Toast';
import ThemeToggle from './components/common/ThemeToggle';
import { OrderingSkeleton, SummarySkeleton } from './components/common/Skeleton';

// Ordering
import EmployeeSelector from './components/ordering/EmployeeSelector';
import CategoryTabs from './components/ordering/CategoryTabs';
import RestaurantGrid from './components/ordering/RestaurantGrid';
import MenuItemGrid from './components/ordering/MenuItemGrid';
import ItemCustomizer from './components/ordering/ItemCustomizer';

// Summary
import SummaryPanel from './components/summary/SummaryPanel';

// Admin
import AdminPanel from './components/admin/AdminPanel';

function App() {
  const store = useStore();
  const isDesktop = useIsDesktop();

  const restaurantRef = useRef<HTMLDivElement>(null);
  const menuItemRef = useRef<HTMLDivElement>(null);
  const customizerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    store.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to components on selection changes
  useEffect(() => {
    if (store.selectedCategory && restaurantRef.current) {
      restaurantRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [store.selectedCategory]);

  useEffect(() => {
    if (store.selectedRestaurant && menuItemRef.current) {
      menuItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [store.selectedRestaurant]);

  useEffect(() => {
    if (store.selectedItem && customizerRef.current) {
      customizerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [store.selectedItem]);

  // Mobile: determine which panel to show
  const showOrderPanel = isDesktop ? store.activeTab !== 'admin' : store.activeTab === 'order';
  const showSummaryPanel = isDesktop ? store.activeTab !== 'admin' : store.activeTab === 'summary' || store.activeTab === 'recon';
  const showAdminPanel = store.activeTab === 'admin';

  // Initial loading
  if (!store.initialized) {
    return (
      <div className="app-layout animate-fade-in">
        <div className="panel-left" style={{ display: 'flex' }}>
          <OrderingSkeleton />
        </div>
        {isDesktop && (
          <div className="panel-right" style={{ display: 'flex' }}>
            <SummarySkeleton />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="app-layout">
        {/* ═══ Left Panel: Ordering ═══ */}
        <div
          className={classNames('panel-left', { active: showOrderPanel })}
        >
          {/* Header */}
          <div className="app-header">
            <div className="app-header-left">
              <div className="app-brand">Lifestyle Premium Dining</div>
              <h1 className="display-title">Lunch Order.</h1>
            </div>
            <div className="app-header-right flex items-center gap-3">
              {store.userRole === 'admin' && (
                <button
                  className="btn btn-primary btn-sm flex items-center gap-1"
                  onClick={() => store.setOption('activeTab', 'admin')}
                >
                  ⚙️ 後台管理
                </button>
              )}
              <ThemeToggle />
            </div>
          </div>

          {/* Employee Selector + Balance + Deposit + Quick Orders */}
          <EmployeeSelector />

          {/* Category → Restaurant → Menu → Customizer */}
          <div className="card flex flex-col gap-5">
            <CategoryTabs />
            {store.selectedCategory && (
              <div ref={restaurantRef}>
                <RestaurantGrid />
              </div>
            )}
            {store.selectedRestaurant && (
              <div ref={menuItemRef}>
                <MenuItemGrid />
              </div>
            )}
          </div>

          {/* Item Customizer (slides up when item selected) */}
          {store.selectedItem && (
            <div ref={customizerRef}>
              <ItemCustomizer />
            </div>
          )}
        </div>

        {/* ═══ Right Panel: Summary & Reconciliation ═══ */}
        <div
          className={classNames('panel-right', { active: showSummaryPanel })}
        >
          <SummaryPanel />
        </div>

        {/* ═══ Admin Panel ═══ */}
        {store.userRole === 'admin' && showAdminPanel && (
          <div
            className={classNames('panel-admin', { active: showAdminPanel })}
            style={
              isDesktop
                ? {
                    position: 'fixed',
                    inset: 0,
                    zIndex: 200,
                    background: 'var(--bg-primary)',
                    overflow: 'auto',
                    padding: '32px 40px',
                  }
                : {}
            }
          >
            <AdminPanel />
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Toast Notifications */}
      <Toast />

      {/* Global Loading Overlay */}
      {store.loading && (
        <div className="loading-overlay">
          <Loader2 size={48} className="animate-spin" style={{ color: 'var(--primary)' }} />
        </div>
      )}
    </div>
  );
}

export default App;
