import { useMemo, useState } from 'react';
import { Search, Plus, Pencil, Trash2, Save, X, Calendar, Store } from 'lucide-react';
import classNames from 'classnames';
import { useStore } from '../../store';
import { useToast } from '../../hooks/useToast';
import Modal from '../common/Modal';

interface EditingItem {
  restaurantId: string;
  itemId: string;
  itemName: string;
  price: number;
  category: string;
  subCategory: string;
  flavors: string;
}

export default function MenuItemTable({ initialRestaurantId }: { initialRestaurantId?: string } = {}) {
  const menuPayload = useStore((s) => s.menuPayload);
  const adminAddItem = useStore((s) => s.adminAddItem);
  const adminUpdateItem = useStore((s) => s.adminUpdateItem);
  const adminDeactivateItem = useStore((s) => s.adminDeactivateItem);
  const addToast = useToast((s) => s.addToast);
  const newItemDisplayDays = useStore((s) => s.newItemDisplayDays);
  const adminUpdateNewItemDisplayDays = useStore((s) => s.adminUpdateNewItemDisplayDays);
  const adminAddRestaurant = useStore((s) => s.adminAddRestaurant);
  const adminAddExtra = useStore((s) => s.adminAddExtra);
  const adminUpdateExtra = useStore((s) => s.adminUpdateExtra);
  const adminDeleteExtra = useStore((s) => s.adminDeleteExtra);
  const [displayDaysInput, setDisplayDaysInput] = useState(String(newItemDisplayDays));
  const [addingRest, setAddingRest] = useState(false);
  const [newRest, setNewRest] = useState({ name: '', category: '正餐' as string, telephone: '' });

  const [search, setSearch] = useState('');
  const [selectedRest, setSelectedRest] = useState(initialRestaurantId || '__ALL__');
  const [itemSection, setItemSection] = useState<'items' | 'extras'>('items');
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({
    itemName: '',
    price: '',
    category: '',
    subCategory: '',
    flavors: '',
  });

  const [addingExtra, setAddingExtra] = useState(false);
  const [newExtra, setNewExtra] = useState({
    name: '',
    price: '',
    group: '加料',
    type: 'extra' as 'extra' | 'single',
  });
  const [editingExtra, setEditingExtra] = useState<{
    id: string;
    name: string;
    price: number;
    group: string;
    type: 'extra' | 'single';
  } | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{
    restaurantId: string;
    itemId: string;
    name: string;
  } | null>(null);

  const restaurants = useMemo(
    () => menuPayload?.restaurants || [],
    [menuPayload],
  );
  const items = useMemo(() => {
    if (!menuPayload) return [];
    let list = menuPayload.items;
    if (selectedRest !== '__ALL__')
      list = list.filter((i) => i.restaurantId === selectedRest);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    return list;
  }, [menuPayload, selectedRest, search]);

  const allExtras = menuPayload?.extras || [];
  const extras = useMemo(() => {
    let list = allExtras;
    if (selectedRest !== '__ALL__') {
      list = list.filter((e) => e.restaurantId === selectedRest);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.group && e.group.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [allExtras, selectedRest, search]);

  const handleAddExtra = async () => {
    if (selectedRest === '__ALL__' || !newExtra.name.trim() || !newExtra.price) return;
    const res = await adminAddExtra({
      restaurantId: selectedRest,
      name: newExtra.name.trim(),
      price: Number(newExtra.price),
      group: newExtra.group.trim() || '加料',
      type: newExtra.type,
    });
    if (res.ok) {
      addToast('success', `已新增加點「${newExtra.name.trim()}」`);
      setAddingExtra(false);
      setNewExtra({ name: '', price: '', group: '加料', type: 'extra' });
    } else {
      addToast('error', res.error || '新增加點失敗');
    }
  };

  const handleSaveEditExtra = async () => {
    if (!editingExtra || !editingExtra.name.trim()) return;
    const res = await adminUpdateExtra({
      id: editingExtra.id,
      name: editingExtra.name.trim(),
      price: Number(editingExtra.price),
      group: editingExtra.group.trim(),
      type: editingExtra.type,
    });
    if (res.ok) {
      addToast('success', '加點項目已更新');
      setEditingExtra(null);
    } else {
      addToast('error', res.error || '更新失敗');
    }
  };

  const handleDeleteExtra = async (id: string, name: string) => {
    const res = await adminDeleteExtra(id);
    if (res.ok) {
      addToast('success', `已刪除加點「${name}」`);
    } else {
      addToast('error', res.error || '刪除失敗');
    }
  };

  const getRestName = (id: string) =>
    restaurants.find((r) => r.id === id)?.name || id;

  const handleSaveEdit = async () => {
    if (!editing) return;
    const result = await adminUpdateItem({
      restaurantId: editing.restaurantId,
      itemId: editing.itemId,
      itemName: editing.itemName,
      price: editing.price,
      category: editing.category,
      subCategory: editing.subCategory,
      flavors: editing.flavors,
    });
    if (result.ok) {
      addToast('success', '品項已更新');
      setEditing(null);
    } else {
      addToast('error', result.error || '更新失敗');
    }
  };

  const handleAdd = async () => {
    if (selectedRest === '__ALL__' || !newItem.itemName.trim() || !newItem.price) return;
    const result = await adminAddItem({
      restaurantId: selectedRest,
      itemName: newItem.itemName.trim(),
      price: Number(newItem.price),
      category: newItem.category,
      subCategory: newItem.subCategory,
      flavors: newItem.flavors,
    });
    if (result.ok) {
      addToast('success', '品項已新增');
      setAdding(false);
      setNewItem({
        itemName: '',
        price: '',
        category: '',
        subCategory: '',
        flavors: '',
      });
    } else {
      addToast('error', result.error || '新增失敗');
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
      {/* Toolbar */}
      <div className="card">
        <div
          className="flex gap-3 items-center"
          style={{ flexWrap: 'wrap' }}
        >
          <select
            value={selectedRest}
            onChange={(e) => setSelectedRest(e.target.value)}
            style={{ maxWidth: 240 }}
          >
            <option value="__ALL__">全部餐廳</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <div className="search-bar flex-1" style={{ minWidth: 200 }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="搜尋品項..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {itemSection === 'items' ? (
            <button
              className="btn btn-primary"
              onClick={() => setAdding(true)}
              disabled={selectedRest === '__ALL__'}
            >
              <Plus size={16} /> 新增品項
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => setAddingExtra(true)}
              disabled={selectedRest === '__ALL__'}
            >
              <Plus size={16} /> 新增加點配料
            </button>
          )}
          <button
            className="btn btn-outline"
            onClick={() => setAddingRest(true)}
          >
            <Store size={16} /> 新增餐廳
          </button>
        </div>
        <div
          className="flex gap-2 items-center mt-3"
          style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 12 }}
        >
          <Calendar size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>新品展示天數</span>
          <input
            type="number"
            min="0"
            max="90"
            value={displayDaysInput}
            onChange={(e) => setDisplayDaysInput(e.target.value)}
            style={{ width: 70 }}
          />
          <button
            className="btn btn-outline btn-sm"
            onClick={async () => {
              const days = Number(displayDaysInput);
              if (isNaN(days) || days < 0) return;
              const result = await adminUpdateNewItemDisplayDays(days);
              if (result.ok) {
                addToast('success', `新品展示天數已更新為 ${days} 天`);
              } else {
                addToast('error', result.error || '更新失敗');
              }
            }}
          >
            <Save size={12} /> 儲存
          </button>
        </div>
      </div>

      {/* Add restaurant form */}
      {addingRest && (
        <div className="card card-section animate-slide-up">
          <div className="h3 mb-3">
            <Store size={18} style={{ display: 'inline', verticalAlign: -3, marginRight: 6 }} />
            新增餐廳
          </div>
          <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
            <input
              placeholder="餐廳名稱"
              value={newRest.name}
              onChange={(e) => setNewRest({ ...newRest, name: e.target.value })}
              style={{ flex: 2, minWidth: 150 }}
            />
            <select
              value={newRest.category}
              onChange={(e) => setNewRest({ ...newRest, category: e.target.value })}
              style={{ width: 120 }}
            >
              <option value="正餐">正餐</option>
              <option value="飲料">飲料</option>
              <option value="甜點">甜點</option>
            </select>
            <input
              placeholder="電話（選填）"
              value={newRest.telephone}
              onChange={(e) => setNewRest({ ...newRest, telephone: e.target.value })}
              style={{ width: 140 }}
            />
          </div>
          <div className="flex gap-3 mt-3 justify-end">
            <button className="btn btn-ghost" onClick={() => setAddingRest(false)}>
              取消
            </button>
            <button
              className="btn btn-primary"
              disabled={!newRest.name.trim()}
              onClick={async () => {
                const result = await adminAddRestaurant({
                  name: newRest.name.trim(),
                  category: newRest.category,
                  telephone: newRest.telephone.trim(),
                });
                if (result.ok) {
                  addToast('success', `已新增餐廳「${newRest.name.trim()}」`);
                  setAddingRest(false);
                  if (result.restaurantId) {
                    setSelectedRest(result.restaurantId);
                    setAdding(true);
                    setNewItem({
                      itemName: '',
                      price: '',
                      category: newRest.category,
                      subCategory: '',
                      flavors: '',
                    });
                  }
                  setNewRest({ name: '', category: '正餐', telephone: '' });
                } else {
                  addToast('error', result.error || '新增失敗');
                }
              }}
            >
              <Save size={16} /> 儲存
            </button>
          </div>
        </div>
      )}

      {/* Add form */}
      {adding && selectedRest !== '__ALL__' && (
        <div className="card card-section animate-slide-up">
          <div className="h3 mb-3">
            新增品項至 {getRestName(selectedRest)}
          </div>
          <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
            <input
              placeholder="品項名稱"
              value={newItem.itemName}
              onChange={(e) =>
                setNewItem({ ...newItem, itemName: e.target.value })
              }
              style={{ flex: 2, minWidth: 150 }}
            />
            <input
              type="number"
              placeholder="價格"
              value={newItem.price}
              onChange={(e) =>
                setNewItem({ ...newItem, price: e.target.value })
              }
              style={{ width: 100 }}
            />
            <input
              placeholder="分類"
              value={newItem.category}
              onChange={(e) =>
                setNewItem({ ...newItem, category: e.target.value })
              }
              style={{ width: 120 }}
            />
            <input
              placeholder="子分類"
              value={newItem.subCategory}
              onChange={(e) =>
                setNewItem({ ...newItem, subCategory: e.target.value })
              }
              style={{ width: 120 }}
            />
          </div>
          <div className="flex gap-3 mt-3 justify-end">
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAdd}
              disabled={!newItem.itemName.trim() || !newItem.price}
            >
              <Save size={16} /> 儲存
            </button>
          </div>
        </div>
      )}

      {/* Add Extra form */}
      {addingExtra && selectedRest !== '__ALL__' && (
        <div className="card card-section animate-slide-up" style={{ border: '1.5px solid var(--accent)' }}>
          <div className="h3 mb-3 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
            <Plus size={18} /> 新增加點 / 配料項目
          </div>
          <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
            <input
              placeholder="加點名稱 (例：加珍珠、加蛋、微辣)"
              value={newExtra.name}
              onChange={(e) => setNewExtra({ ...newExtra, name: e.target.value })}
              style={{ flex: 2, minWidth: 150 }}
              autoFocus
            />
            <input
              type="number"
              placeholder="加購價 (元)"
              value={newExtra.price}
              onChange={(e) => setNewExtra({ ...newExtra, price: e.target.value })}
              style={{ width: 100 }}
            />
            <input
              placeholder="群組 (例：加料、辣度、升級)"
              value={newExtra.group}
              onChange={(e) => setNewExtra({ ...newExtra, group: e.target.value })}
              style={{ width: 140 }}
            />
            <select
              value={newExtra.type}
              onChange={(e) => setNewExtra({ ...newExtra, type: e.target.value as 'extra' | 'single' })}
              style={{ width: 140 }}
            >
              <option value="extra">可複選 (加料)</option>
              <option value="single">單選互斥 (規格)</option>
            </select>
          </div>
          <div className="flex gap-3 mt-3 justify-end">
            <button className="btn btn-ghost" onClick={() => setAddingExtra(false)}>
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAddExtra}
              disabled={!newExtra.name.trim() || !newExtra.price}
            >
              <Save size={16} /> 儲存加點
            </button>
          </div>
        </div>
      )}

      {/* Section switcher */}
      <div className="flex gap-2 mb-1">
        <button
          type="button"
          className={classNames('btn btn-sm', {
            'btn-primary': itemSection === 'items',
            'btn-ghost': itemSection !== 'items',
          })}
          onClick={() => setItemSection('items')}
          style={{ fontSize: 13, padding: '6px 14px' }}
        >
          📋 正式菜單品項 ({items.length})
        </button>
        <button
          type="button"
          className={classNames('btn btn-sm', {
            'btn-primary': itemSection === 'extras',
            'btn-ghost': itemSection !== 'extras',
          })}
          onClick={() => setItemSection('extras')}
          style={{ fontSize: 13, padding: '6px 14px' }}
        >
          ➕ 加點 / 配料項目 ({extras.length})
        </button>
      </div>

      {/* Main List Section */}
      {itemSection === 'extras' ? (
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <div className="h3">加點配料清單</div>
            <span className="caption">{extras.length} 項</span>
          </div>

          {extras.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">➕</div>
              <div className="empty-state-title">尚未有加點項目</div>
              <div className="empty-state-desc">
                {selectedRest === '__ALL__' ? '請先選擇指定餐廳再新增加點項目' : '點擊上方按鈕為此餐廳新增加點項目'}
              </div>
            </div>
          ) : (
            <div className="admin-items-list">
              {extras.map((extra) => (
                <div
                  key={extra.id}
                  className="admin-item-row flex items-center justify-between"
                >
                  {editingExtra?.id === extra.id ? (
                    /* Editing extra */
                    <div className="flex gap-2 items-center flex-1" style={{ flexWrap: 'wrap' }}>
                      <input
                        value={editingExtra.name}
                        onChange={(e) => setEditingExtra({ ...editingExtra, name: e.target.value })}
                        style={{ flex: 2, minWidth: 120 }}
                      />
                      <input
                        type="number"
                        value={editingExtra.price}
                        onChange={(e) => setEditingExtra({ ...editingExtra, price: Number(e.target.value) })}
                        style={{ width: 80 }}
                      />
                      <input
                        value={editingExtra.group}
                        onChange={(e) => setEditingExtra({ ...editingExtra, group: e.target.value })}
                        placeholder="群組"
                        style={{ width: 100 }}
                      />
                      <select
                        value={editingExtra.type}
                        onChange={(e) => setEditingExtra({ ...editingExtra, type: e.target.value as 'extra' | 'single' })}
                        style={{ width: 110 }}
                      >
                        <option value="extra">可複選</option>
                        <option value="single">單選互斥</option>
                      </select>
                      <button className="btn btn-ghost" onClick={() => setEditingExtra(null)}>
                        <X size={14} />
                      </button>
                      <button className="btn btn-primary" onClick={handleSaveEditExtra} style={{ padding: '8px 16px' }}>
                        <Save size={14} />
                      </button>
                    </div>
                  ) : (
                    /* Display extra */
                    <>
                      <div className="flex flex-col flex-1" style={{ minWidth: 0 }}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base">{extra.name}</span>
                          <span className="badge badge-accent" style={{ fontSize: 11 }}>
                            {extra.group || '加點'}
                          </span>
                          <span className="badge badge-default" style={{ fontSize: 11 }}>
                            {extra.type === 'single' ? '單選互斥' : '可複選'}
                          </span>
                          {selectedRest === '__ALL__' && (
                            <span className="badge badge-default" style={{ fontSize: 11 }}>
                              {getRestName(extra.restaurantId)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="price-display price-sm font-semibold" style={{ color: 'var(--primary)', marginRight: 12 }}>
                        +${extra.price}
                      </span>
                      <div className="flex gap-1">
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => setEditingExtra({
                            id: extra.id,
                            name: extra.name,
                            price: extra.price,
                            group: extra.group,
                            type: extra.type,
                          })}
                          title="編輯"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => handleDeleteExtra(extra.id, extra.name)}
                          title="刪除"
                          style={{ color: 'var(--error)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Items list */
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <div className="h3">品項列表</div>
            <span className="caption">{items.length} 項</span>
          </div>

          {items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">沒有品項</div>
              <div className="empty-state-desc">選擇餐廳並新增品項</div>
            </div>
          ) : (
            <div className="admin-items-list">
            {items.map((item, idx) => (
              <div
                key={`${item.restaurantId}-${item.id}-${item.name}-${idx}`}
                className="admin-item-row"
              >
                {editing?.itemId === item.id &&
                editing?.restaurantId === item.restaurantId ? (
                  /* Editing mode */
                  <div
                    className="flex gap-2 items-center flex-1"
                    style={{ flexWrap: 'wrap' }}
                  >
                    <input
                      value={editing.itemName}
                      onChange={(e) =>
                        setEditing({ ...editing, itemName: e.target.value })
                      }
                      style={{ flex: 2, minWidth: 120 }}
                    />
                    <input
                      type="number"
                      value={editing.price}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          price: Number(e.target.value),
                        })
                      }
                      style={{ width: 80 }}
                    />
                    <input
                      value={editing.subCategory}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          subCategory: e.target.value,
                        })
                      }
                      placeholder="子分類"
                      style={{ width: 100 }}
                    />
                    <button
                      className="btn btn-ghost"
                      onClick={() => setEditing(null)}
                    >
                      <X size={14} />
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveEdit}
                      style={{ padding: '8px 16px' }}
                    >
                      <Save size={14} />
                    </button>
                  </div>
                ) : (
                  /* Display mode */
                  <>
                    <div
                      className="flex flex-col flex-1"
                      style={{ minWidth: 0 }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">
                          {item.name}
                          {!!(item.createdAt && (Date.now() - new Date(item.createdAt).getTime()) < newItemDisplayDays * 86400000) && (
                            <span className="badge badge-new" style={{ fontSize: 9, marginLeft: 6, verticalAlign: 'middle' }}>🆕</span>
                          )}
                        </span>
                        {selectedRest === '__ALL__' && (
                          <span
                            className={classNames('badge', 'badge-default')}
                            style={{ fontSize: 11 }}
                          >
                            {getRestName(item.restaurantId)}
                          </span>
                        )}
                      </div>
                      {item.subCategory && (
                        <span className="caption">{item.subCategory}</span>
                      )}
                      <div className="flex items-center gap-1 mt-1" style={{ flexWrap: 'wrap' }}>
                        {(['期間限定', '新品上市', '店長推薦'] as const).map((tag) => {
                          const isActive = item.limitedType === tag;
                          const icons = { '期間限定': '🌸', '新品上市': '🆕', '店長推薦': '⭐' };
                          return (
                            <button
                              key={tag}
                              type="button"
                              className={classNames('btn btn-xs', {
                                'btn-primary': isActive,
                                'btn-ghost': !isActive,
                              })}
                              style={{
                                fontSize: 11,
                                padding: '2px 6px',
                                height: 22,
                                borderRadius: 12,
                                opacity: isActive ? 1 : 0.6,
                                border: isActive ? 'none' : '1px dashed var(--glass-border)',
                              }}
                              onClick={async () => {
                                const newTag = isActive ? '' : tag;
                                const res = await adminUpdateItem({
                                  restaurantId: item.restaurantId,
                                  itemId: item.id,
                                  itemName: item.name,
                                  price: item.price,
                                  category: item.category,
                                  subCategory: item.subCategory,
                                  flavors: item.flavors,
                                  limitedType: newTag,
                                });
                                if (res.ok) {
                                  addToast('success', newTag ? `「${item.name}」已標示為 ${tag} (優先排序)` : `已取消 ${item.name} 的標示`);
                                } else {
                                  addToast('error', res.error || '更新標籤失敗');
                                }
                              }}
                              title={isActive ? `點擊取消 ${tag}` : `標示為 ${tag} 並設為優先排序`}
                            >
                              {icons[tag]} {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <span className="price-display price-sm">
                      ${item.price}
                    </span>
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
                            flavors: item.flavors,
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
            ))}
          </div>
        )}
      </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <Modal
          title="確認停用品項"
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
