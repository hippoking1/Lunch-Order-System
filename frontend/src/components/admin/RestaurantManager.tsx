import { useState, useMemo } from 'react';
import classNames from 'classnames';
import {
  Store,
  Plus,
  Search,
  Phone,
  Edit2,
  Check,
  X,
  FileText,
  ListFilter,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { useStore } from '../../store';
import { useToast } from '../../hooks/useToast';
import { SWEETNESS_OPTIONS, ICE_OPTIONS } from '../../constants';
import type { Category, Restaurant } from '../../types';

interface Props {
  onNavigateToImport: (restaurantId: string) => void;
  onNavigateToItems: (restaurantId: string) => void;
}

export default function RestaurantManager({
  onNavigateToImport,
  onNavigateToItems,
}: Props) {
  const menuPayload = useStore((s) => s.menuPayload);
  const adminAddRestaurant = useStore((s) => s.adminAddRestaurant);
  const adminUpdateRestaurant = useStore((s) => s.adminUpdateRestaurant);
  const adminToggleRestaurantActive = useStore(
    (s) => s.adminToggleRestaurantActive,
  );
  const adminUpdateRestaurantCustomOptions = useStore(
    (s) => s.adminUpdateRestaurantCustomOptions,
  );
  const addToast = useToast((s) => s.addToast);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('__ALL__');
  const [addingRest, setAddingRest] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [newRest, setNewRest] = useState<{
    name: string;
    category: Category;
    telephone: string;
  }>({
    name: '',
    category: '正餐',
    telephone: '',
  });

  const [editForm, setEditForm] = useState<{
    name: string;
    category: Category;
    telephone: string;
  }>({
    name: '',
    category: '正餐',
    telephone: '',
  });

  // Success guide modal after adding
  const [createdRestInfo, setCreatedRestInfo] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Drink options modal state
  const [customizingDrinkRest, setCustomizingDrinkRest] = useState<Restaurant | null>(null);
  const [sweetnessList, setSweetnessList] = useState<string[]>([]);
  const [iceList, setIceList] = useState<string[]>([]);
  const [newSweetItem, setNewSweetItem] = useState('');
  const [newIceItem, setNewIceItem] = useState('');

  const handleOpenDrinkOptions = (r: Restaurant) => {
    setCustomizingDrinkRest(r);
    setSweetnessList(
      r.sweetnessOptions && r.sweetnessOptions.length > 0
        ? [...r.sweetnessOptions]
        : [...SWEETNESS_OPTIONS],
    );
    setIceList(
      r.iceOptions && r.iceOptions.length > 0
        ? [...r.iceOptions]
        : [...ICE_OPTIONS],
    );
    setNewSweetItem('');
    setNewIceItem('');
  };

  const handleSaveDrinkOptions = async () => {
    if (!customizingDrinkRest) return;
    const res = await adminUpdateRestaurantCustomOptions({
      restaurantId: customizingDrinkRest.id,
      sweetnessOptions: sweetnessList,
      iceOptions: iceList,
    });
    if (res.ok) {
      addToast('success', `已儲存「${customizingDrinkRest.name}」的甜度冰塊規格！`);
      setCustomizingDrinkRest(null);
    } else {
      addToast('error', res.error || '儲存失敗');
    }
  };

  const handleResetDrinkDefaults = () => {
    setSweetnessList([...SWEETNESS_OPTIONS]);
    setIceList([...ICE_OPTIONS]);
    addToast('info', '已重置為系統預設選項，請點擊「儲存規格」生效');
  };

  const restaurants = menuPayload?.restaurants || [];
  const items = menuPayload?.items || [];

  // Count items per restaurant
  const itemCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((item) => {
      map[item.restaurantId] = (map[item.restaurantId] || 0) + 1;
    });
    return map;
  }, [items]);

  // Filter restaurants
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) => {
      const matchCat =
        selectedCategory === '__ALL__' || r.category === selectedCategory;
      const matchSearch =
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.category && r.category.includes(search));
      return matchCat && matchSearch;
    });
  }, [restaurants, selectedCategory, search]);

  const handleAddRestaurant = async () => {
    if (!newRest.name.trim()) return;
    const res = await adminAddRestaurant({
      name: newRest.name.trim(),
      category: newRest.category,
      telephone: newRest.telephone.trim(),
    });

    if (res.ok) {
      addToast('success', `成功新增餐廳「${newRest.name.trim()}」`);
      setAddingRest(false);
      setCreatedRestInfo({
        id: res.restaurantId || '',
        name: newRest.name.trim(),
      });
      setNewRest({ name: '', category: '正餐', telephone: '' });
    } else {
      addToast('error', res.error || '新增失敗');
    }
  };

  const handleStartEdit = (r: (typeof restaurants)[0]) => {
    setEditingId(r.id);
    setEditForm({
      name: r.name,
      category: r.category || '正餐',
      telephone: (menuPayload as any)?.telephones?.[r.id]?.telephone || '',
    });
  };

  const handleSaveEdit = async (restaurantId: string) => {
    if (!editForm.name.trim()) return;
    const res = await adminUpdateRestaurant({
      restaurantId,
      name: editForm.name.trim(),
      category: editForm.category,
      telephone: editForm.telephone.trim(),
    });

    if (res.ok) {
      addToast('success', `已更新「${editForm.name.trim()}」資訊`);
      setEditingId(null);
    } else {
      addToast('error', res.error || '更新失敗');
    }
  };

  const handleToggleActive = async (restaurantId: string, currentActive: boolean) => {
    const res = await adminToggleRestaurantActive(restaurantId, !currentActive);
    if (res.ok) {
      addToast('info', !currentActive ? '餐廳已啟用上架' : '餐廳已下架停用');
    } else {
      addToast('error', res.error || '操作失敗');
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Top Toolbar */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <Store size={22} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              餐廳管理與維護
            </h2>
            <span
              className="badge badge-default"
              style={{ fontSize: 12, marginLeft: 4 }}
            >
              共 {restaurants.length} 家
            </span>
          </div>

          <button
            className="btn btn-primary flex items-center gap-2"
            onClick={() => {
              setAddingRest(!addingRest);
              setCreatedRestInfo(null);
            }}
          >
            <Plus size={16} /> 新增餐廳
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center mt-4">
          {/* Category tabs */}
          <div className="segmented-control" style={{ maxWidth: 360 }}>
            {['__ALL__', '正餐', '飲料', '甜點'].map((cat) => (
              <button
                key={cat}
                type="button"
                className={classNames('segmented-item', {
                  active: selectedCategory === cat,
                })}
                onClick={() => setSelectedCategory(cat)}
                style={{ fontSize: 13, padding: '6px 14px' }}
              >
                {cat === '__ALL__' ? '全部分類' : cat}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="search-bar flex-1" style={{ minWidth: 200 }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="搜尋餐廳名稱..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Add Restaurant Form */}
      {addingRest && (
        <div className="card card-section animate-slide-up" style={{ border: '1.5px solid var(--primary-muted)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="h3 flex items-center gap-2" style={{ color: 'var(--primary)' }}>
              <Plus size={18} /> 新增合作餐廳
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setAddingRest(false)}
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <div style={{ flex: 2, minWidth: 180 }}>
              <label className="caption mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                餐廳名稱 *
              </label>
              <input
                placeholder="例如：大同小館、五十嵐"
                value={newRest.name}
                onChange={(e) => setNewRest({ ...newRest, name: e.target.value })}
                autoFocus
              />
            </div>

            <div style={{ width: 140 }}>
              <label className="caption mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                分類 *
              </label>
              <select
                value={newRest.category}
                onChange={(e) =>
                  setNewRest({ ...newRest, category: e.target.value as Category })
                }
              >
                <option value="正餐">🍱 正餐</option>
                <option value="飲料">🥤 飲料</option>
                <option value="甜點">🍰 甜點</option>
              </select>
            </div>

            <div style={{ flex: 1.5, minWidth: 160 }}>
              <label className="caption mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                叫餐電話 (選填)
              </label>
              <input
                placeholder="例如：02-12345678"
                value={newRest.telephone}
                onChange={(e) =>
                  setNewRest({ ...newRest, telephone: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              className="btn btn-ghost"
              onClick={() => setAddingRest(false)}
            >
              取消
            </button>
            <button
              className="btn btn-primary flex items-center gap-1"
              disabled={!newRest.name.trim()}
              onClick={handleAddRestaurant}
            >
              <Check size={16} /> 確認新增
            </button>
          </div>
        </div>
      )}

      {/* Success Next Steps Guide Banner */}
      {createdRestInfo && (
        <div
          className="card animate-slide-up"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 166, 35, 0.12), rgba(124, 92, 252, 0.12))',
            border: '1.5px solid var(--primary)',
            padding: '20px 24px',
          }}
        >
          <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--primary)', fontWeight: 700 }}>
            <Sparkles size={20} /> 餐廳「{createdRestInfo.name}」已建立完成！接下來：
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: '0 0 16px 0' }}>
            你現在可以為這家新餐廳匯入菜單或新增餐點，請選擇操作方式：
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              className="btn btn-primary flex items-center gap-2"
              onClick={() => onNavigateToImport(createdRestInfo.id)}
            >
              <FileText size={16} /> 📝 立即文字/CSV匯入菜單
            </button>
            <button
              className="btn btn-outline flex items-center gap-2"
              onClick={() => onNavigateToItems(createdRestInfo.id)}
            >
              <ListFilter size={16} /> 📋 手動新增菜單品項
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setCreatedRestInfo(null)}
            >
              稍後再建
            </button>
          </div>
        </div>
      )}

      {/* Restaurant Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {filteredRestaurants.map((r) => {
          const isEditing = editingId === r.id;
          const count = itemCountMap[r.id] || 0;

          if (isEditing) {
            return (
              <div key={r.id} className="card animate-scale-up" style={{ border: '1.5px solid var(--primary)' }}>
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-sm">編輯餐廳資訊</span>
                  <button className="btn btn-ghost btn-xs" onClick={() => setEditingId(null)}>
                    <X size={14} />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    value={editForm.name}
                    placeholder="餐廳名稱"
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value as Category })}
                      style={{ flex: 1 }}
                    >
                      <option value="正餐">🍱 正餐</option>
                      <option value="飲料">🥤 飲料</option>
                      <option value="甜點">🍰 甜點</option>
                    </select>
                    <input
                      value={editForm.telephone}
                      placeholder="電話"
                      onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })}
                      style={{ flex: 1.5 }}
                    />
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                      取消
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(r.id)}>
                      儲存
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={r.id}
              className="card flex flex-col justify-between"
              style={{
                padding: '18px 20px',
                border: '1px solid var(--glass-border)',
                transition: 'all 0.2s ease',
              }}
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h3
                    className="font-bold truncate"
                    style={{ fontSize: 17, margin: 0, color: 'var(--text-primary)' }}
                    title={r.name}
                  >
                    {r.name}
                  </h3>
                  <span
                    className={classNames('badge', {
                      'badge-primary': r.category === '正餐',
                      'badge-accent': r.category === '飲料',
                      'badge-warning': r.category === '甜點',
                    })}
                    style={{ fontSize: 11 }}
                  >
                    {r.category || '正餐'}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  <span className="flex items-center gap-1">
                    <Phone size={13} style={{ opacity: 0.7 }} />
                    {(r as any).telephone || '未設定電話'}
                  </span>
                  <span>•</span>
                  <span>{count} 項餐點</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                className="flex items-center justify-between pt-3"
                style={{ borderTop: '1px solid var(--glass-border)' }}
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="btn btn-outline btn-xs flex items-center gap-1"
                    onClick={() => onNavigateToImport(r.id)}
                    title="匯入文字或CSV菜單"
                    style={{ padding: '4px 8px', fontSize: 12 }}
                  >
                    <FileText size={12} /> 匯入菜單
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs flex items-center gap-1"
                    onClick={() => onNavigateToItems(r.id)}
                    title="管理此餐廳菜單品項"
                    style={{ padding: '4px 8px', fontSize: 12 }}
                  >
                    <ListFilter size={12} /> 查品項
                  </button>
                  {r.category === '飲料' && (
                    <button
                      type="button"
                      className="btn btn-outline btn-xs flex items-center gap-1"
                      onClick={() => handleOpenDrinkOptions(r)}
                      title="自訂此飲料店的甜度與冰塊選項"
                      style={{ padding: '4px 8px', fontSize: 12, borderColor: 'var(--accent)', color: 'var(--accent)' }}
                    >
                      🥤 規格選項
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleStartEdit(r)}
                    title="編輯名稱或電話"
                    style={{ padding: '4px 6px' }}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleToggleActive(r.id, (r as any).isActive !== false)}
                    title={(r as any).isActive !== false ? '點擊停用此餐廳' : '點擊啟用此餐廳'}
                    style={{ padding: '4px 6px' }}
                  >
                    {(r as any).isActive !== false ? (
                      <Eye size={13} style={{ color: 'var(--success)' }} />
                    ) : (
                      <EyeOff size={13} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredRestaurants.length === 0 && (
        <div className="card text-center py-8">
          <p style={{ color: 'var(--text-muted)' }}>查無符合的餐廳</p>
        </div>
      )}

      {/* Drink Options Customization Modal */}
      {customizingDrinkRest && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="card animate-scale-up"
            style={{
              maxWidth: 540,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '2px solid var(--primary)',
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="h3 flex items-center gap-2">
                  🥤 自訂飲料選項規格
                </h3>
                <p className="caption" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                  {customizingDrinkRest.name} (飲料店專屬)
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCustomizingDrinkRest(null)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Sweetness section */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-sm">🍬 甜度選項列表 ({sweetnessList.length})</span>
                <span className="caption">點擊 ✕ 刪除不提供的甜度</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {sweetnessList.map((opt, idx) => (
                  <span
                    key={idx}
                    className="badge badge-default flex items-center gap-1"
                    style={{ padding: '4px 8px', fontSize: 13 }}
                  >
                    {opt}
                    <X
                      size={12}
                      style={{ cursor: 'pointer', opacity: 0.7 }}
                      onClick={() => setSweetnessList(sweetnessList.filter((_, i) => i !== idx))}
                    />
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="新增自訂甜度 (例：僅供正常與半糖兩種選擇、固定甜度、二分糖)"
                  value={newSweetItem}
                  onChange={(e) => setNewSweetItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSweetItem.trim()) {
                      e.preventDefault();
                      setSweetnessList([...sweetnessList, newSweetItem.trim()]);
                      setNewSweetItem('');
                    }
                  }}
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={!newSweetItem.trim()}
                  onClick={() => {
                    if (newSweetItem.trim()) {
                      setSweetnessList([...sweetnessList, newSweetItem.trim()]);
                      setNewSweetItem('');
                    }
                  }}
                >
                  <Plus size={14} /> 新增
                </button>
              </div>
            </div>

            {/* Ice section */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-sm">🧊 冰塊選項列表 ({iceList.length})</span>
                <span className="caption">點擊 ✕ 刪除不提供的冰塊</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {iceList.map((opt, idx) => (
                  <span
                    key={idx}
                    className="badge badge-default flex items-center gap-1"
                    style={{ padding: '4px 8px', fontSize: 13 }}
                  >
                    {opt}
                    <X
                      size={12}
                      style={{ cursor: 'pointer', opacity: 0.7 }}
                      onClick={() => setIceList(iceList.filter((_, i) => i !== idx))}
                    />
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="新增自訂冰塊 (例：完全去冰、微碎冰、固定冰量、常溫)"
                  value={newIceItem}
                  onChange={(e) => setNewIceItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newIceItem.trim()) {
                      e.preventDefault();
                      setIceList([...iceList, newIceItem.trim()]);
                      setNewIceItem('');
                    }
                  }}
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={!newIceItem.trim()}
                  onClick={() => {
                    if (newIceItem.trim()) {
                      setIceList([...iceList, newIceItem.trim()]);
                      setNewIceItem('');
                    }
                  }}
                >
                  <Plus size={14} /> 新增
                </button>
              </div>
            </div>

            <div
              className="flex justify-between items-center pt-3 mt-4"
              style={{ borderTop: '1px solid var(--glass-border)' }}
            >
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResetDrinkDefaults}
              >
                還原系統預設選項
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setCustomizingDrinkRest(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveDrinkOptions}
                >
                  儲存選項規格
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
