import { useMemo, useState } from 'react';
import classNames from 'classnames';
import { ClipboardList } from 'lucide-react';
import { useStore } from '../../store';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import type { OrderRecord } from '../../types';
import RestaurantOrderCard from './RestaurantOrderCard';
import EmployeeReconCard from './EmployeeReconCard';

type DesktopViewMode = 'all' | 'orders' | 'recon';

export default function SummaryPanel() {
  const store = useStore();
  const isDesktop = useIsDesktop();
  const [viewMode, setViewMode] = useState<DesktopViewMode>('all');
  const [onlyUnsettled, setOnlyUnsettled] = useState(false);

  const groupedOrders = useMemo(() => {
    const res: Record<string, Record<string, OrderRecord[]>> = {};
    store.summary.forEach((o: OrderRecord) => {
      const rest = store.menuPayload?.restaurants.find(
        (x) => String(x.id) === String(o.restaurantId),
      );
      const cat = rest?.category || o.category || '其他';
      if (!res[cat]) res[cat] = {};
      if (!res[cat][o.restaurantId]) res[cat][o.restaurantId] = [];
      res[cat][o.restaurantId].push(o);
    });
    return res;
  }, [store.summary, store.menuPayload]);

  const empOrdersAll = useMemo(() => {
    const map: Record<string, OrderRecord[]> = {};
    store.summary.forEach((o: OrderRecord) => {
      if (!map[o.employee]) map[o.employee] = [];
      map[o.employee].push(o);
    });
    return map;
  }, [store.summary]);

  const stats = useMemo(() => {
    let totalQty = 0;
    let totalAmount = 0;
    store.summary.forEach((o) => {
      totalQty += o.quantity;
      totalAmount += o.totalPrice;
    });
    const empKeys = Object.keys(empOrdersAll);
    const settledCount = empKeys.filter((emp) => {
      const list = empOrdersAll[emp];
      return list.every((o) => o.isChangeGiven || o.isPaidByBalance);
    }).length;

    return {
      totalQty,
      totalAmount,
      empCount: empKeys.length,
      settledCount,
      settledRatio: empKeys.length > 0 ? (settledCount / empKeys.length) * 100 : 0,
    };
  }, [store.summary, empOrdersAll]);

  const visibleEmployees = useMemo(() => {
    const keys = Object.keys(empOrdersAll);
    if (!onlyUnsettled) return keys;
    return keys.filter((emp) => {
      const list = empOrdersAll[emp];
      return !list.every((o) => o.isChangeGiven || o.isPaidByBalance);
    });
  }, [empOrdersAll, onlyUnsettled]);

  const getRestaurantName = (rid: string) => {
    if (!store.menuPayload) return rid;
    const r = store.menuPayload.restaurants.find((x) => x.id === rid);
    return r ? r.name : rid;
  };

  // 手機版依 BottomNav 分開顯示「總覽」或「帳務」；桌面版依切換控制
  const showOrdersSection = isDesktop
    ? viewMode === 'all' || viewMode === 'orders'
    : store.activeTab === 'summary';
  const showReconSection = isDesktop
    ? viewMode === 'all' || viewMode === 'recon'
    : store.activeTab === 'recon';

  return (
    <div className="card flex flex-col gap-4" style={{ height: '100%' }}>
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="display-title">
          {!isDesktop && store.activeTab === 'recon' ? '員工對帳' : '今日訂單總覽'}
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={store.date}
            onChange={(e) => {
              store.setLoading(true);
              store.init(e.target.value);
            }}
            className="mono"
            style={{
              width: 'auto',
              fontSize: '13px',
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          />
        </div>
      </div>

      {/* Moment: Recon & Summary Strip */}
      {store.summary.length > 0 && (
        <div>
          <div className="recon-strip">
            <div className="recon-stat">
              <span className="recon-stat-label">總份數</span>
              <span className="recon-stat-val">{stats.totalQty} 份</span>
            </div>
            <div className="recon-stat">
              <span className="recon-stat-label">今日總額</span>
              <span className="recon-stat-val" style={{ color: 'var(--primary)' }}>
                ${stats.totalAmount}
              </span>
            </div>
            <div className="recon-stat">
              <span className="recon-stat-label">已結清</span>
              <span className="recon-stat-val">
                {stats.settledCount}/{stats.empCount} 人
              </span>
            </div>
          </div>
          <div className="recon-progress-bar">
            <div
              className="recon-progress-fill"
              style={{ width: `${stats.settledRatio}%` }}
            />
          </div>
        </div>
      )}

      {/* Desktop View Filter */}
      {isDesktop && store.summary.length > 0 && (
        <div className="segmented-control">
          {(
            [
              { key: 'all', label: '全部顯示' },
              { key: 'orders', label: '叫餐彙整' },
              { key: 'recon', label: '員工對帳' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={classNames('segmented-item', {
                active: viewMode === tab.key,
              })}
              onClick={() => setViewMode(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col gap-5" style={{ overflowY: 'auto' }}>
        {store.summary.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={36} strokeWidth={1.5} className="empty-state-icon" />
            <div className="empty-state-title">尚未有訂單記錄</div>
          </div>
        ) : (
          <>
            {/* 叫餐彙整 (依分類與餐廳) */}
            {showOrdersSection && (
              <div>
                <div
                  className="h3 mb-3"
                  style={{
                    borderBottom: '1px solid var(--divider)',
                    paddingBottom: '8px',
                    width: '100%',
                  }}
                >
                  叫餐彙整
                </div>

                {Object.keys(groupedOrders).map((cat) => (
                  <div key={cat} className="mb-4">
                    <div className="badge badge-primary mb-2">{cat}</div>
                    {Object.keys(groupedOrders[cat]).map((rid) => (
                      <RestaurantOrderCard
                        key={rid}
                        restaurantId={rid}
                        restaurantName={getRestaurantName(rid)}
                        orders={groupedOrders[cat][rid]}
                        categoryName={cat}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* 員工對帳 */}
            {showReconSection && (
              <div>
                <div
                  className="flex justify-between items-center mb-3"
                  style={{
                    borderBottom: '1px solid var(--divider)',
                    paddingBottom: '8px',
                  }}
                >
                  <div className="h3">對帳管理</div>
                  <button
                    type="button"
                    className={classNames('chip-btn', { active: onlyUnsettled })}
                    onClick={() => setOnlyUnsettled((v) => !v)}
                  >
                    {onlyUnsettled ? '顯示全部' : '僅看未結清'}
                  </button>
                </div>

                {visibleEmployees.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 16px' }}>
                    <div className="empty-state-title">所有員工皆已結清</div>
                  </div>
                ) : (
                  visibleEmployees.map((emp) => (
                    <EmployeeReconCard
                      key={emp}
                      employee={emp}
                      orders={empOrdersAll[emp]}
                    />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
