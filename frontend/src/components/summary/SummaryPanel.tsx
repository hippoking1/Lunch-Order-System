import { useMemo } from 'react';
import { useStore } from '../../store';
import type { OrderRecord } from '../../types';
import RestaurantOrderCard from './RestaurantOrderCard';
import EmployeeReconCard from './EmployeeReconCard';

export default function SummaryPanel() {
  const store = useStore();

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

  const totalQty = useMemo(
    () => store.summary.reduce((a: number, b: OrderRecord) => a + b.quantity, 0),
    [store.summary],
  );

  const getRestaurantName = (rid: string) => {
    if (!store.menuPayload) return rid;
    const r = store.menuPayload.restaurants.find((x) => x.id === rid);
    return r ? r.name : rid;
  };

  return (
    <div className="card flex flex-col" style={{ height: '100%' }}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="display-title" style={{ fontSize: '36px' }}>
          Summary.
        </h2>
        <div className="flex items-center gap-2">
          <span className="caption">今日日期：</span>
          <input
            type="date"
            value={store.date}
            onChange={(e) => {
              store.setLoading(true);
              store.init(e.target.value);
            }}
            className="badge badge-accent"
            style={{
              border: '1px solid var(--accent)',
              fontSize: '14px',
              padding: '4px 12px',
              cursor: 'pointer',
            }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6" style={{ overflowY: 'auto' }}>
        {store.summary.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">尚未有訂單記錄</div>
          </div>
        ) : (
          <>
            {/* Summary overview */}
            <div>
              <div className="h3 mb-4" style={{ borderBottom: '2px solid var(--divider)', paddingBottom: '8px' }}>
                總覽資訊
              </div>
              <div className="caption mb-4">今日共 {totalQty} 份餐點</div>

              {Object.keys(groupedOrders).map((cat) => (
                <div key={cat} className="mb-4">
                  <div className="badge badge-accent mb-3">{cat}</div>
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

            {/* Reconciliation */}
            <div>
              <div
                className="h3 mb-4"
                style={{
                  borderBottom: '2px solid var(--divider)',
                  paddingBottom: '8px',
                  color: 'var(--primary)',
                }}
              >
                對帳管理 (所有人)
              </div>
              {Object.keys(empOrdersAll).map((emp) => (
                <EmployeeReconCard
                  key={emp}
                  employee={emp}
                  orders={empOrdersAll[emp]}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
