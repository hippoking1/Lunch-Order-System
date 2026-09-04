import { useMemo, useState } from 'react';
import { Search, Plus, Pencil, Trash2, Save, X, Calendar, Store, Layers, FileText, Loader2 } from 'lucide-react';
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
  const allRestaurants = useStore((s) => s.allRestaurants);
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
  const [itemSection, setItemSection] = useState<'items' | 'combos' | 'extras'>('items');
  const [editing, setEditing] = useState<EditingItem | null>(null);

  // 批量新增品項狀態
  const [adding, setAdding] = useState(false);
  const [itemsBatch, setItemsBatch] = useState<Array<{
    id: string;
    itemName: string;
    price: string;
    category: string;
    subCategory: string;
    flavors: string;
  }>>([{ id: '1', itemName: '', price: '', category: '', subCategory: '', flavors: '' }]);
  const [itemsPasteMode, setItemsPasteMode] = useState(false);
  const [itemsPasteText, setItemsPasteText] = useState('');
  const [savingBatch, setSavingBatch] = useState(false);

  // 批量新增加點狀態
  const [addingExtra, setAddingExtra] = useState(false);
  const [extrasBatch, setExtrasBatch] = useState<Array<{
    id: string;
    name: string;
    price: string;
    group: string;
    type: 'extra' | 'single';
  }>>([{ id: '1', name: '', price: '', group: '加料', type: 'extra' }]);
  const [savingExtrasBatch, setSavingExtrasBatch] = useState(false);

  // 批量新增套餐狀態
  const [addingCombo, setAddingCombo] = useState(false);
  const [combosBatch, setCombosBatch] = useState<Array<{
    id: string;
    name: string;
    price: string;
    group: string;
  }>>([{ id: '1', name: '', price: '', group: '套餐' }]);
  const [combosPasteMode, setCombosPasteMode] = useState(false);
  const [combosPasteText, setCombosPasteText] = useState('');
  const [savingCombosBatch, setSavingCombosBatch] = useState(false);

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
    () => (allRestaurants && allRestaurants.length > 0 ? allRestaurants : (menuPayload?.restaurants || [])),
    [allRestaurants, menuPayload],
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

  // 分離出套餐與常規加料
  const comboExtras = useMemo(() => {
    return extras.filter((e) => e.group === '套餐' || e.type === 'single');
  }, [extras]);

  const regularExtras = useMemo(() => {
    return extras.filter((e) => e.group !== '套餐' && e.type !== 'single');
  }, [extras]);

  // 批量儲存品項
  const handleBatchAddItems = async () => {
    if (selectedRest === '__ALL__') return;
    const validRows = itemsBatch.filter((r) => r.itemName.trim() && r.price.trim());
    if (validRows.length === 0) {
      addToast('error', '請至少填寫一個品項名稱與價格');
      return;
    }
    setSavingBatch(true);
    let successCount = 0;
    for (const r of validRows) {
      const res = await adminAddItem({
        restaurantId: selectedRest,
        itemName: r.itemName.trim(),
        price: Number(r.price),
        category: r.category.trim(),
        subCategory: r.subCategory.trim(),
        flavors: r.flavors.trim(),
      });
      if (res.ok) successCount++;
    }
    setSavingBatch(false);
    if (successCount > 0) {
      addToast('success', `成功新增 ${successCount} 筆餐點品項！`);
      setAdding(false);
      setItemsBatch([{ id: Date.now().toString(), itemName: '', price: '', category: '', subCategory: '', flavors: '' }]);
      setItemsPasteText('');
      setItemsPasteMode(false);
    } else {
      addToast('error', '新增品項失敗');
    }
  };

  // 快速文字貼上解析品項
  const handleParseItemsPaste = () => {
    if (!itemsPasteText.trim()) return;
    const lines = itemsPasteText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsedRows: Array<{ id: string; itemName: string; price: string; category: string; subCategory: string; flavors: string }> = [];
    for (const line of lines) {
      const parts = line.split(/[,\t]+/).map((s) => s.trim());
      if (parts.length >= 2) {
        parsedRows.push({
          id: Math.random().toString(36).slice(2, 9),
          itemName: parts[0] || '',
          price: parts[1] || '',
          category: parts[2] || '',
          subCategory: parts[3] || '',
          flavors: parts[4] || '',
        });
      } else {
        const spaceParts = line.split(/\s+/);
        if (spaceParts.length >= 2) {
          parsedRows.push({
            id: Math.random().toString(36).slice(2, 9),
            itemName: spaceParts[0] || '',
            price: spaceParts[1] || '',
            category: spaceParts[2] || '',
            subCategory: spaceParts[3] || '',
            flavors: spaceParts[4] || '',
          });
        }
      }
    }
    if (parsedRows.length > 0) {
      setItemsBatch(parsedRows);
      setItemsPasteMode(false);
      addToast('info', `已成功解析並填入 ${parsedRows.length} 筆品項！`);
    } else {
      addToast('error', '未能解析出有效品項，格式範例：牛肉麵 120 或 排骨飯,110,正餐');
    }
  };

  // 批量儲存加點
  const handleBatchAddExtras = async () => {
    if (selectedRest === '__ALL__') return;
    const validRows = extrasBatch.filter((r) => r.name.trim() && r.price.trim());
    if (validRows.length === 0) {
      addToast('error', '請至少填寫一個加點名稱與價格');
      return;
    }
    setSavingExtrasBatch(true);
    let successCount = 0;
    for (const r of validRows) {
      const res = await adminAddExtra({
        restaurantId: selectedRest,
        name: r.name.trim(),
        price: Number(r.price),
        group: r.group.trim() || '加料',
        type: r.type,
      });
      if (res.ok) successCount++;
    }
    setSavingExtrasBatch(false);
    if (successCount > 0) {
      addToast('success', `成功新增 ${successCount} 項加點配料！`);
      setAddingExtra(false);
      setExtrasBatch([{ id: Date.now().toString(), name: '', price: '', group: '加料', type: 'extra' }]);
    } else {
      addToast('error', '新增加點失敗');
    }
  };

  // 批量儲存套餐
  const handleBatchAddCombos = async () => {
    if (selectedRest === '__ALL__') return;
    const validRows = combosBatch.filter((r) => r.name.trim() && r.price.trim());
    if (validRows.length === 0) {
      addToast('error', '請至少填寫一個套餐名稱與價格');
      return;
    }
    setSavingCombosBatch(true);
    let successCount = 0;
    for (const r of validRows) {
      const res = await adminAddExtra({
        restaurantId: selectedRest,
        name: r.name.trim(),
        price: Number(r.price),
        group: r.group.trim() || '套餐',
        type: 'single',
      });
      if (res.ok) successCount++;
    }
    setSavingCombosBatch(false);
    if (successCount > 0) {
      addToast('success', `成功新增 ${successCount} 種套餐選擇！`);
      setAddingCombo(false);
      setCombosBatch([{ id: Date.now().toString(), name: '', price: '', group: '套餐' }]);
      setCombosPasteText('');
      setCombosPasteMode(false);
    } else {
      addToast('error', '新增套餐失敗');
    }
  };

  // 快速文字貼上解析套餐
  const handleParseCombosPaste = () => {
    if (!combosPasteText.trim()) return;
    const lines = combosPasteText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsedRows: Array<{ id: string; name: string; price: string; group: string }> = [];
    for (const line of lines) {
      const parts = line.split(/[,\t]+/).map((s) => s.trim());
      if (parts.length >= 2) {
        parsedRows.push({
          id: Math.random().toString(36).slice(2, 9),
          name: parts[0],
          price: parts[1],
          group: parts[2] || '套餐',
        });
      } else {
        const spaceParts = line.split(/\s+/);
        if (spaceParts.length >= 2) {
          parsedRows.push({
            id: Math.random().toString(36).slice(2, 9),
            name: spaceParts[0],
            price: spaceParts[1],
            group: spaceParts[2] || '套餐',
          });
        }
      }
    }
    if (parsedRows.length > 0) {
      setCombosBatch(parsedRows);
      setCombosPasteMode(false);
      addToast('info', `已解析並填入 ${parsedRows.length} 種套餐！`);
    } else {
      addToast('error', '未能解析出有效套餐，格式範例：A套餐(附紅茶與薯條) 49');
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
          <button
            className="btn btn-primary btn-sm flex items-center gap-1"
            onClick={() => {
              setAdding(true);
              setAddingCombo(false);
              setAddingExtra(false);
            }}
            disabled={selectedRest === '__ALL__'}
          >
            <Plus size={15} /> 新增品項
          </button>
          <button
            className="btn btn-sm flex items-center gap-1"
            onClick={() => {
              setAddingCombo(true);
              setAdding(false);
              setAddingExtra(false);
            }}
            disabled={selectedRest === '__ALL__'}
            style={{ background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }}
          >
            🍱 新增套餐
          </button>
          <button
            className="btn btn-outline btn-sm flex items-center gap-1"
            onClick={() => {
              setAddingExtra(true);
              setAdding(false);
              setAddingCombo(false);
            }}
            disabled={selectedRest === '__ALL__'}
          >
            ➕ 新增加點
          </button>
          <button
            className="btn btn-outline btn-sm flex items-center gap-1"
            onClick={() => setAddingRest(true)}
          >
            <Store size={15} /> 新增餐廳
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

      {/* 1. 批量新增品項表單 */}
      {adding && selectedRest !== '__ALL__' && (
        <div className="card card-section animate-slide-up" style={{ border: '1.5px solid var(--primary)' }}>
          <div className="flex justify-between items-center mb-3">
            <div className="h3 flex items-center gap-2" style={{ color: 'var(--primary)' }}>
              <Layers size={18} /> 新增品項至 {getRestName(selectedRest)}（支援一次新增多品項）
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-xs flex items-center gap-1"
                onClick={() => setItemsPasteMode(!itemsPasteMode)}
                style={{ fontSize: 12 }}
              >
                <FileText size={13} /> {itemsPasteMode ? '切換表格輸入' : '📝 文字貼上解析'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>
                <X size={16} />
              </button>
            </div>
          </div>

          {itemsPasteMode ? (
            <div className="flex flex-col gap-2 mb-3">
              <p className="caption" style={{ color: 'var(--text-secondary)' }}>
                每行填寫一個品項，格式支援空格、逗號或 Tab 分隔（例如：<code>招牌排骨飯 110 正餐 便當系列</code>）
              </p>
              <textarea
                rows={5}
                placeholder={`牛肉麵 120 正餐 麵食\n排骨飯 110 正餐 便當\n貢丸湯 40 湯品`}
                value={itemsPasteText}
                onChange={(e) => setItemsPasteText(e.target.value)}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, padding: 10 }}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleParseItemsPaste}
                  disabled={!itemsPasteText.trim()}
                >
                  解析並填入多列表格
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex gap-2 font-semibold caption px-1" style={{ color: 'var(--text-muted)' }}>
                <div style={{ flex: 2, minWidth: 140 }}>品項名稱 *</div>
                <div style={{ width: 90 }}>價格 *</div>
                <div style={{ width: 110 }}>分類</div>
                <div style={{ width: 110 }}>子分類</div>
                <div style={{ width: 110 }}>口味 (選填)</div>
                <div style={{ width: 36 }}></div>
              </div>
              {itemsBatch.map((row, idx) => (
                <div key={row.id} className="flex gap-2 items-center">
                  <input
                    placeholder="品項名稱"
                    value={row.itemName}
                    onChange={(e) => {
                      const next = [...itemsBatch];
                      next[idx].itemName = e.target.value;
                      setItemsBatch(next);
                    }}
                    style={{ flex: 2, minWidth: 140 }}
                  />
                  <input
                    type="number"
                    placeholder="價格"
                    value={row.price}
                    onChange={(e) => {
                      const next = [...itemsBatch];
                      next[idx].price = e.target.value;
                      setItemsBatch(next);
                    }}
                    style={{ width: 90 }}
                  />
                  <input
                    placeholder="分類 (例: 正餐)"
                    value={row.category}
                    onChange={(e) => {
                      const next = [...itemsBatch];
                      next[idx].category = e.target.value;
                      setItemsBatch(next);
                    }}
                    style={{ width: 110 }}
                  />
                  <input
                    placeholder="子分類"
                    value={row.subCategory}
                    onChange={(e) => {
                      const next = [...itemsBatch];
                      next[idx].subCategory = e.target.value;
                      setItemsBatch(next);
                    }}
                    style={{ width: 110 }}
                  />
                  <input
                    placeholder="口味 (辣,不辣)"
                    value={row.flavors}
                    onChange={(e) => {
                      const next = [...itemsBatch];
                      next[idx].flavors = e.target.value;
                      setItemsBatch(next);
                    }}
                    style={{ width: 110 }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    disabled={itemsBatch.length === 1}
                    onClick={() => {
                      if (itemsBatch.length > 1) {
                        setItemsBatch(itemsBatch.filter((_, i) => i !== idx));
                      }
                    }}
                    style={{ width: 36, opacity: itemsBatch.length === 1 ? 0.3 : 1 }}
                    title="刪除此行"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
              <div className="flex justify-start mt-1">
                <button
                  type="button"
                  className="btn btn-outline btn-xs flex items-center gap-1"
                  onClick={() =>
                    setItemsBatch([
                      ...itemsBatch,
                      {
                        id: Math.random().toString(36).slice(2, 9),
                        itemName: '',
                        price: '',
                        category: itemsBatch[itemsBatch.length - 1]?.category || '',
                        subCategory: itemsBatch[itemsBatch.length - 1]?.subCategory || '',
                        flavors: '',
                      },
                    ])
                  }
                >
                  <Plus size={13} /> 再增一行
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-4 justify-end" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 12 }}>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>
              取消
            </button>
            <button
              className="btn btn-primary flex items-center gap-2"
              onClick={handleBatchAddItems}
              disabled={savingBatch || itemsBatch.every((r) => !r.itemName.trim() || !r.price.trim())}
            >
              {savingBatch ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              批次儲存全部品項 ({itemsBatch.filter((r) => r.itemName.trim() && r.price.trim()).length} 項)
            </button>
          </div>
        </div>
      )}

      {/* 2. 批量新增套餐表單 */}
      {addingCombo && selectedRest !== '__ALL__' && (
        <div className="card card-section animate-slide-up" style={{ border: '1.5px solid var(--accent)' }}>
          <div className="flex justify-between items-center mb-3">
            <div className="h3 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
              🍱 新增套餐選項至 {getRestName(selectedRest)}（支援一次新增多種套餐）
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-xs flex items-center gap-1"
                onClick={() => setCombosPasteMode(!combosPasteMode)}
                style={{ fontSize: 12 }}
              >
                <FileText size={13} /> {combosPasteMode ? '切換表格輸入' : '📝 文字貼上解析'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAddingCombo(false)}>
                <X size={16} />
              </button>
            </div>
          </div>

          {combosPasteMode ? (
            <div className="flex flex-col gap-2 mb-3">
              <p className="caption" style={{ color: 'var(--text-secondary)' }}>
                每行填寫一種套餐，格式支援空格、逗號（例如：<code>A套餐(附紅茶與薯條) 49</code> 或 <code>超值特餐,69,升級套餐</code>）
              </p>
              <textarea
                rows={5}
                placeholder={`A套餐 (薯條+紅茶) 49\nB套餐 (雞塊+奶茶) 69\nC套餐 (沙拉+濃湯) 59`}
                value={combosPasteText}
                onChange={(e) => setCombosPasteText(e.target.value)}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, padding: 10 }}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleParseCombosPaste}
                  disabled={!combosPasteText.trim()}
                >
                  解析並填入多列表格
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex gap-2 font-semibold caption px-1" style={{ color: 'var(--text-muted)' }}>
                <div style={{ flex: 3, minWidth: 160 }}>套餐名稱 (例：A套餐 薯條+大可) *</div>
                <div style={{ width: 120 }}>加購價 (元) *</div>
                <div style={{ flex: 2, minWidth: 120 }}>群組名稱 (預設: 套餐)</div>
                <div style={{ width: 36 }}></div>
              </div>
              {combosBatch.map((row, idx) => (
                <div key={row.id} className="flex gap-2 items-center">
                  <input
                    placeholder="套餐名稱 (例：A套餐: 薯條+紅茶)"
                    value={row.name}
                    onChange={(e) => {
                      const next = [...combosBatch];
                      next[idx].name = e.target.value;
                      setCombosBatch(next);
                    }}
                    style={{ flex: 3, minWidth: 160 }}
                  />
                  <input
                    type="number"
                    placeholder="加價 (元)"
                    value={row.price}
                    onChange={(e) => {
                      const next = [...combosBatch];
                      next[idx].price = e.target.value;
                      setCombosBatch(next);
                    }}
                    style={{ width: 120 }}
                  />
                  <input
                    placeholder="群組 (例: 套餐)"
                    value={row.group}
                    onChange={(e) => {
                      const next = [...combosBatch];
                      next[idx].group = e.target.value;
                      setCombosBatch(next);
                    }}
                    style={{ flex: 2, minWidth: 120 }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    disabled={combosBatch.length === 1}
                    onClick={() => {
                      if (combosBatch.length > 1) {
                        setCombosBatch(combosBatch.filter((_, i) => i !== idx));
                      }
                    }}
                    style={{ width: 36, opacity: combosBatch.length === 1 ? 0.3 : 1 }}
                    title="刪除此行"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
              <div className="flex justify-start mt-1">
                <button
                  type="button"
                  className="btn btn-outline btn-xs flex items-center gap-1"
                  onClick={() =>
                    setCombosBatch([
                      ...combosBatch,
                      {
                        id: Math.random().toString(36).slice(2, 9),
                        name: '',
                        price: '',
                        group: combosBatch[combosBatch.length - 1]?.group || '套餐',
                      },
                    ])
                  }
                >
                  <Plus size={13} /> 再增一種套餐
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-4 justify-end" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 12 }}>
            <button className="btn btn-ghost" onClick={() => setAddingCombo(false)}>
              取消
            </button>
            <button
              className="btn flex items-center gap-2"
              onClick={handleBatchAddCombos}
              disabled={savingCombosBatch || combosBatch.every((r) => !r.name.trim() || !r.price.trim())}
              style={{ background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }}
            >
              {savingCombosBatch ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              批次儲存全部套餐 ({combosBatch.filter((r) => r.name.trim() && r.price.trim()).length} 種)
            </button>
          </div>
        </div>
      )}

      {/* 3. 批量新增加點配料表單 */}
      {addingExtra && selectedRest !== '__ALL__' && (
        <div className="card card-section animate-slide-up" style={{ border: '1.5px solid var(--success)' }}>
          <div className="flex justify-between items-center mb-3">
            <div className="h3 flex items-center gap-2" style={{ color: 'var(--success)' }}>
              ➕ 新增加點 / 配料至 {getRestName(selectedRest)}（支援一次新增多項）
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setAddingExtra(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-col gap-2 mb-3">
            <div className="flex gap-2 font-semibold caption px-1" style={{ color: 'var(--text-muted)' }}>
              <div style={{ flex: 3, minWidth: 150 }}>加點名稱 (例：加珍珠、加蛋) *</div>
              <div style={{ width: 100 }}>加購價 (元) *</div>
              <div style={{ width: 120 }}>群組 (例: 加料)</div>
              <div style={{ width: 120 }}>類型</div>
              <div style={{ width: 36 }}></div>
            </div>
            {extrasBatch.map((row, idx) => (
              <div key={row.id} className="flex gap-2 items-center">
                <input
                  placeholder="加點名稱 (例：加珍珠、加蛋)"
                  value={row.name}
                  onChange={(e) => {
                    const next = [...extrasBatch];
                    next[idx].name = e.target.value;
                    setExtrasBatch(next);
                  }}
                  style={{ flex: 3, minWidth: 150 }}
                />
                <input
                  type="number"
                  placeholder="加購價"
                  value={row.price}
                  onChange={(e) => {
                    const next = [...extrasBatch];
                    next[idx].price = e.target.value;
                    setExtrasBatch(next);
                  }}
                  style={{ width: 100 }}
                />
                <input
                  placeholder="群組"
                  value={row.group}
                  onChange={(e) => {
                    const next = [...extrasBatch];
                    next[idx].group = e.target.value;
                    setExtrasBatch(next);
                  }}
                  style={{ width: 120 }}
                />
                <select
                  value={row.type}
                  onChange={(e) => {
                    const next = [...extrasBatch];
                    next[idx].type = e.target.value as 'extra' | 'single';
                    setExtrasBatch(next);
                  }}
                  style={{ width: 120 }}
                >
                  <option value="extra">可複選 (加料)</option>
                  <option value="single">單選互斥 (規格)</option>
                </select>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  disabled={extrasBatch.length === 1}
                  onClick={() => {
                    if (extrasBatch.length > 1) {
                      setExtrasBatch(extrasBatch.filter((_, i) => i !== idx));
                    }
                  }}
                  style={{ width: 36, opacity: extrasBatch.length === 1 ? 0.3 : 1 }}
                  title="刪除此行"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
            <div className="flex justify-start mt-1">
              <button
                type="button"
                className="btn btn-outline btn-xs flex items-center gap-1"
                onClick={() =>
                  setExtrasBatch([
                    ...extrasBatch,
                    {
                      id: Math.random().toString(36).slice(2, 9),
                      name: '',
                      price: '',
                      group: extrasBatch[extrasBatch.length - 1]?.group || '加料',
                      type: 'extra',
                    },
                  ])
                }
              >
                <Plus size={13} /> 再增一項加點
              </button>
            </div>
          </div>

          <div className="flex gap-3 mt-4 justify-end" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 12 }}>
            <button className="btn btn-ghost" onClick={() => setAddingExtra(false)}>
              取消
            </button>
            <button
              className="btn btn-primary flex items-center gap-2"
              onClick={handleBatchAddExtras}
              disabled={savingExtrasBatch || extrasBatch.every((r) => !r.name.trim() || !r.price.trim())}
            >
              {savingExtrasBatch ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              批次儲存全部加點 ({extrasBatch.filter((r) => r.name.trim() && r.price.trim()).length} 項)
            </button>
          </div>
        </div>
      )}

      {/* Section switcher - 三大標籤 */}
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
            'btn-primary': itemSection === 'combos',
            'btn-ghost': itemSection !== 'combos',
          })}
          onClick={() => setItemSection('combos')}
          style={{
            fontSize: 13,
            padding: '6px 14px',
            background: itemSection === 'combos' ? 'var(--accent)' : 'transparent',
            borderColor: itemSection === 'combos' ? 'var(--accent)' : 'transparent',
            color: itemSection === 'combos' ? '#fff' : 'inherit',
          }}
        >
          🍱 套餐選擇 ({comboExtras.length})
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
          ➕ 加點 / 配料項目 ({regularExtras.length})
        </button>
      </div>

      {/* Main List Section */}
      {itemSection === 'combos' ? (
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <div className="h3">🍱 套餐選擇清單</div>
            <span className="caption">{comboExtras.length} 項</span>
          </div>

          {comboExtras.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🍱</div>
              <div className="empty-state-title">尚未有套餐項目</div>
              <div className="empty-state-desc">
                {selectedRest === '__ALL__' ? '請先選擇指定餐廳再新增套餐項目' : '點擊上方【🍱 新增套餐】為此餐廳新增套餐'}
              </div>
            </div>
          ) : (
            <div className="admin-items-list">
              {comboExtras.map((extra) => (
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
                        <option value="single">單選互斥 (套餐)</option>
                        <option value="extra">可複選 (加料)</option>
                      </select>
                      <button className="btn btn-ghost" onClick={() => setEditingExtra(null)}>
                        <X size={14} />
                      </button>
                      <button className="btn btn-primary" onClick={handleSaveEditExtra} style={{ padding: '8px 16px' }}>
                        <Save size={14} />
                      </button>
                    </div>
                  ) : (
                    /* Display combo extra */
                    <>
                      <div className="flex flex-col flex-1" style={{ minWidth: 0 }}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base">{extra.name}</span>
                          <span className="badge" style={{ fontSize: 11, background: 'rgba(124, 92, 252, 0.2)', color: 'var(--accent)' }}>
                            {extra.group || '套餐'}
                          </span>
                          <span className="badge badge-default" style={{ fontSize: 11 }}>
                            單選互斥
                          </span>
                          {selectedRest === '__ALL__' && (
                            <span className="badge badge-default" style={{ fontSize: 11 }}>
                              {getRestName(extra.restaurantId)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="price-display price-sm font-semibold" style={{ color: 'var(--accent)', marginRight: 12 }}>
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
      ) : itemSection === 'extras' ? (
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <div className="h3">➕ 加點配料清單</div>
            <span className="caption">{regularExtras.length} 項</span>
          </div>

          {regularExtras.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">➕</div>
              <div className="empty-state-title">尚未有加點項目</div>
              <div className="empty-state-desc">
                {selectedRest === '__ALL__' ? '請先選擇指定餐廳再新增加點項目' : '點擊上方按鈕為此餐廳新增加點項目'}
              </div>
            </div>
          ) : (
            <div className="admin-items-list">
              {regularExtras.map((extra) => (
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
                        <option value="extra">可複選 (加料)</option>
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
