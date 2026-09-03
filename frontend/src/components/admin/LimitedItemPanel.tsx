import { useState, useMemo } from 'react';
import { Plus, Save, X, Pencil, Trash2, Clock, CalendarDays, Sparkles } from 'lucide-react';
import classNames from 'classnames';
import { useStore } from '../../store';
import { useToast } from '../../hooks/useToast';
import Modal from '../common/Modal';
import type { MenuItem } from '../../types';

const LIMITED_TYPE_OPTIONS = ['當季限定', '期間限定', '節日限定'];

interface EditingLimited {
  restaurantId: string;
  itemId: string;
  itemName: string;
  price: number;
  category: string;
  subCategory: string;
  limitedType: string;
  hasDateRange: boolean;
  startDate: string;
  endDate: string;
}

export default function LimitedItemPanel() {
  const menuPayload = useStore((s) => s.menuPayload);
  const adminData = useStore((s) => s.adminData);
  const adminAddItem = useStore((s) => s.adminAddItem);
  const adminUpdateItem = useStore((s) => s.adminUpdateItem);
  const adminDeactivateItem = useStore((s) => s.adminDeactivateItem);
  const addToast = useToast((s) => s.addToast);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EditingLimited | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    restaurantId: string;
    itemId: string;
    name: string;
  } | null>(null);

  // New item form
  const [selectedRest, setSelectedRest] = useState('__NONE__');
  const [newItem, setNewItem] = useState({
    itemName: '',
    price: '',
    category: '',
    subCategory: '',
    limitedType: '當季限定',
    customType: '',
    hasDateRange: false,
    startDate: '',
    endDate: '',
  });

  const restaurants = useMemo(
    () => menuPayload?.restaurants || [],
    [menuPayload],
  );

  // Collect all limited items from adminData menuPayload (includes inactive)
  const limitedItems = useMemo(() => {
    const items = adminData?.menuPayload?.items || menuPayload?.items || [];
    return items.filter((i) => i.limitedType && i.limitedType.trim() !== '');
  }, [adminData, menuPayload]);

  const getRestName = (id: string) =>
    restaurants.find((r) => r.id === id)?.name || id;

  const getItemStatus = (item: MenuItem): { label: string; className: string } => {
    const today = new Date().toISOString().slice(0, 10);
    if (item.startDate && today < item.startDate) {
      return { label: '未開始', className: 'badge-warning' };
    }
    if (item.endDate && today > item.endDate) {
      return { label: '已結束', className: 'badge-muted' };
    }
    return { label: '販賣中', className: 'badge-success' };
  };

  const handleAdd = async () => {
    if (selectedRest === '__NONE__' || !newItem.itemName.trim() || !newItem.price) return;
    const limitedType = newItem.limitedType === '__CUSTOM__'
      ? newItem.customType.trim()
      : newItem.limitedType;
    if (!limitedType) return;

    const result = await adminAddItem({
      restaurantId: selectedRest,
      itemName: newItem.itemName.trim(),
      price: Number(newItem.price),
      category: newItem.category,
      subCategory: newItem.subCategory,
      limitedType,
      startDate: newItem.hasDateRange ? newItem.startDate : '',
      endDate: newItem.hasDateRange ? newItem.endDate : '',
    });

    if (result.ok) {
      addToast('success', '限定商品已新增');
      setAdding(false);
      setNewItem({
        itemName: '', price: '', category: '', subCategory: '',
        limitedType: '當季限定', customType: '',
        hasDateRange: false, startDate: '', endDate: '',
      });
    } else {
      addToast('error', result.error || '新增失敗');
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const result = await adminUpdateItem({
      restaurantId: editing.restaurantId,
      itemId: editing.itemId,
      itemName: editing.itemName,
      price: editing.price,
      category: editing.category,
      subCategory: editing.subCategory,
      limitedType: editing.limitedType,
      startDate: editing.hasDateRange ? editing.startDate : '',
      endDate: editing.hasDateRange ? editing.endDate : '',
    });
    if (result.ok) {
      addToast('success', '限定商品已更新');
      setEditing(null);
    } else {
      addToast('error', result.error || '更新失敗');
    }
  };

  const handleDeactivate = async () => {
    if (!confirmDelete) return;
    const result = await adminDeactivateItem(
      confirmDelete.restaurantId,
      confirmDelete.itemId,
    );
    if (result.ok) {
      addToast('success', `已停用「${confirmDelete.name}」`);
    } else {
      addToast('error', result.error || '停用失敗');
    }
    setConfirmDelete(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Add limited item */}
      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <div className="h3">🌸 新增限定商品</div>
          {!adding && (
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              <Plus size={16} /> 新增
            </button>
          )}
        </div>

        {adding && (
          <div className="limited-add-form animate-slide-up">
            {/* Row 1: Restaurant + Name + Price */}
            <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
              <div className="flex flex-col gap-1">
                <label className="label">餐廳</label>
                <select
                  value={selectedRest}
                  onChange={(e) => setSelectedRest(e.target.value)}
                  style={{ minWidth: 160 }}
                >
                  <option value="__NONE__">選擇餐廳...</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 flex-1" style={{ minWidth: 150 }}>
                <label className="label">商品名稱</label>
                <input
                  placeholder="例：芒果冰沙"
                  value={newItem.itemName}
                  onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1" style={{ width: 100 }}>
                <label className="label">價格</label>
                <input
                  type="number"
                  placeholder="$"
                  value={newItem.price}
                  onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                />
              </div>
            </div>

            {/* Row 2: Category + SubCategory */}
            <div className="flex gap-3 mt-3" style={{ flexWrap: 'wrap' }}>
              <div className="flex flex-col gap-1" style={{ width: 120 }}>
                <label className="label">分類</label>
                <input
                  placeholder="分類"
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1" style={{ width: 120 }}>
                <label className="label">子分類</label>
                <input
                  placeholder="子分類"
                  value={newItem.subCategory}
                  onChange={(e) => setNewItem({ ...newItem, subCategory: e.target.value })}
                />
              </div>
            </div>

            {/* Row 3: Limited type */}
            <div className="mt-3">
              <label className="label mb-2">限定類型</label>
              <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                {LIMITED_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    className={classNames('btn btn-sm', {
                      'btn-limited-active': newItem.limitedType === opt,
                      'btn-outline': newItem.limitedType !== opt,
                    })}
                    onClick={() => setNewItem({ ...newItem, limitedType: opt })}
                  >
                    {opt}
                  </button>
                ))}
                <button
                  className={classNames('btn btn-sm', {
                    'btn-limited-active': newItem.limitedType === '__CUSTOM__',
                    'btn-outline': newItem.limitedType !== '__CUSTOM__',
                  })}
                  onClick={() => setNewItem({ ...newItem, limitedType: '__CUSTOM__' })}
                >
                  自訂
                </button>
              </div>
              {newItem.limitedType === '__CUSTOM__' && (
                <input
                  className="mt-2"
                  placeholder="輸入自訂限定類型..."
                  value={newItem.customType}
                  onChange={(e) => setNewItem({ ...newItem, customType: e.target.value })}
                  style={{ maxWidth: 200 }}
                />
              )}
            </div>

            {/* Row 4: Date range toggle */}
            <div className="mt-3">
              <label className="limited-toggle" onClick={() => setNewItem({ ...newItem, hasDateRange: !newItem.hasDateRange })}>
                <div className={classNames('toggle-switch', { active: newItem.hasDateRange })}>
                  <div className="toggle-thumb" />
                </div>
                <span>設定販賣區間</span>
              </label>
            </div>

            {newItem.hasDateRange && (
              <div className="flex gap-3 mt-3 animate-slide-up" style={{ flexWrap: 'wrap' }}>
                <div className="flex flex-col gap-1">
                  <label className="label">
                    <CalendarDays size={14} style={{ display: 'inline', verticalAlign: -2 }} /> 開始日
                  </label>
                  <input
                    type="date"
                    value={newItem.startDate}
                    onChange={(e) => setNewItem({ ...newItem, startDate: e.target.value })}
                    style={{ width: 160 }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="label">
                    <CalendarDays size={14} style={{ display: 'inline', verticalAlign: -2 }} /> 結束日
                  </label>
                  <input
                    type="date"
                    value={newItem.endDate}
                    onChange={(e) => setNewItem({ ...newItem, endDate: e.target.value })}
                    style={{ width: 160 }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-4 justify-end">
              <button className="btn btn-ghost" onClick={() => setAdding(false)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAdd}
                disabled={
                  selectedRest === '__NONE__' ||
                  !newItem.itemName.trim() ||
                  !newItem.price ||
                  (newItem.limitedType === '__CUSTOM__' && !newItem.customType.trim())
                }
              >
                <Save size={16} /> 儲存
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Limited items list */}
      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <div className="h3">📋 限定商品列表</div>
          <span className="caption">{limitedItems.length} 項</span>
        </div>

        {limitedItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🌸</div>
            <div className="empty-state-title">尚無限定商品</div>
            <div className="empty-state-desc">點擊上方「新增」來新增當季或期間限定商品</div>
          </div>
        ) : (
          <div className="admin-items-list">
            {limitedItems.map((item, idx) => {
              const status = getItemStatus(item);
              const isEditing = editing?.itemId === item.id && editing?.restaurantId === item.restaurantId;

              return (
                <div
                  key={`${item.restaurantId}-${item.id}-${idx}`}
                  className="admin-item-row"
                >
                  {isEditing ? (
                    <div className="flex flex-col gap-3 flex-1">
                      <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
                        <input
                          value={editing.itemName}
                          onChange={(e) => setEditing({ ...editing, itemName: e.target.value })}
                          style={{ flex: 2, minWidth: 120 }}
                          placeholder="商品名稱"
                        />
                        <input
                          type="number"
                          value={editing.price}
                          onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                          style={{ width: 80 }}
                          placeholder="價格"
                        />
                        <input
                          value={editing.subCategory}
                          onChange={(e) => setEditing({ ...editing, subCategory: e.target.value })}
                          placeholder="子分類"
                          style={{ width: 100 }}
                        />
                      </div>
                      <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                        <select
                          value={editing.limitedType}
                          onChange={(e) => setEditing({ ...editing, limitedType: e.target.value })}
                          style={{ width: 140 }}
                        >
                          {LIMITED_TYPE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <label
                          className="limited-toggle"
                          onClick={() => setEditing({ ...editing, hasDateRange: !editing.hasDateRange })}
                        >
                          <div className={classNames('toggle-switch', { active: editing.hasDateRange })}>
                            <div className="toggle-thumb" />
                          </div>
                          <span style={{ fontSize: 13 }}>販賣區間</span>
                        </label>
                        {editing.hasDateRange && (
                          <>
                            <input
                              type="date"
                              value={editing.startDate}
                              onChange={(e) => setEditing({ ...editing, startDate: e.target.value })}
                              style={{ width: 140 }}
                            />
                            <span style={{ alignSelf: 'center' }}>~</span>
                            <input
                              type="date"
                              value={editing.endDate}
                              onChange={(e) => setEditing({ ...editing, endDate: e.target.value })}
                              style={{ width: 140 }}
                            />
                          </>
                        )}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                          <X size={14} /> 取消
                        </button>
                        <button className="btn btn-primary" onClick={handleSaveEdit}>
                          <Save size={14} /> 儲存
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Sparkles
                        size={16}
                        style={{ color: 'var(--limited-accent)', flexShrink: 0 }}
                      />
                      <div className="flex flex-col flex-1" style={{ minWidth: 0 }}>
                        <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                          <span className="font-semibold truncate">{item.name}</span>
                          <span className="badge badge-default" style={{ fontSize: 11 }}>
                            {getRestName(item.restaurantId)}
                          </span>
                          <span className="badge badge-limited">{item.limitedType}</span>
                          <span className={classNames('badge', status.className)} style={{ fontSize: 11 }}>
                            {status.label}
                          </span>
                        </div>
                        <span className="caption">
                          {item.startDate || item.endDate ? (
                            <>
                              <Clock size={12} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
                              {item.startDate || '即日起'} ~ {item.endDate || '無期限'}
                            </>
                          ) : (
                            '無販賣區間（手動管理）'
                          )}
                        </span>
                      </div>
                      <span className="price-display price-sm">${item.price}</span>
                      <div className="flex gap-1">
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() =>
                            setEditing({
                              restaurantId: item.restaurantId,
                              itemId: item.id,
                              itemName: item.name,
                              price: item.price,
                              category: item.category,
                              subCategory: item.subCategory,
                              limitedType: item.limitedType || '當季限定',
                              hasDateRange: !!(item.startDate || item.endDate),
                              startDate: item.startDate || '',
                              endDate: item.endDate || '',
                            })
                          }
                          title="編輯"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() =>
                            setConfirmDelete({
                              restaurantId: item.restaurantId,
                              itemId: item.id,
                              name: item.name,
                            })
                          }
                          title="停用"
                          style={{ color: 'var(--error)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <Modal
          title="確認停用限定商品"
          onClose={() => setConfirmDelete(null)}
          onConfirm={handleDeactivate}
          confirmLabel="停用"
          variant="danger"
        >
          <p>
            確定要停用「<strong>{confirmDelete.name}</strong>」嗎？
          </p>
          <p className="caption mt-2">
            停用後品項不會在點餐介面顯示，但歷史訂單不受影響。可隨時重新啟用。
          </p>
        </Modal>
      )}
    </div>
  );
}
