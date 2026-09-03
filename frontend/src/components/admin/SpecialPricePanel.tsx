import { useState, useMemo } from 'react';
import { Tag, Trash2, Plus } from 'lucide-react';
import { useStore } from '../../store';
import { useToast } from '../../hooks/useToast';

export default function SpecialPricePanel() {
  const menuPayload = useStore((s) => s.menuPayload);
  const adminData = useStore((s) => s.adminData);
  const adminSetSpecialPrice = useStore((s) => s.adminSetSpecialPrice);
  const adminRemoveSpecialPrice = useStore((s) => s.adminRemoveSpecialPrice);
  const addToast = useToast((s) => s.addToast);

  const [selectedRest, setSelectedRest] = useState('__NONE__');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [specialPrice, setSpecialPrice] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [label, setLabel] = useState('');

  const restaurants = useMemo(
    () => menuPayload?.restaurants || [],
    [menuPayload],
  );
  const items = useMemo(() => {
    if (!menuPayload || selectedRest === '__NONE__') return [];
    return menuPayload.items.filter((i) => i.restaurantId === selectedRest);
  }, [menuPayload, selectedRest]);
  const activeSpecials = adminData?.specialPrices || [];
  const getRestName = (id: string) =>
    restaurants.find((r) => r.id === id)?.name || id;
  const getItemName = (rid: string, iid?: string) =>
    menuPayload?.items.find((i) => i.restaurantId === rid && i.id === iid)
      ?.name || iid || '';

  const selectedItem = items.find((i) => i.id === selectedItemId);

  const handleAdd = async () => {
    if (selectedRest === '__NONE__' || !selectedItemId || !specialPrice) return;
    const result = await adminSetSpecialPrice({
      restaurantId: selectedRest,
      itemId: selectedItemId,
      portionName: '',
      originalPrice: selectedItem?.price || 0,
      specialPrice: Number(specialPrice),
      startDate,
      endDate,
      label: label || '特價',
    });
    if (result.ok) {
      addToast('success', '特價已設定');
      setSpecialPrice('');
      setStartDate('');
      setEndDate('');
      setLabel('');
      setSelectedItemId('');
    } else {
      addToast('error', result.error || '設定失敗');
    }
  };

  const handleRemove = async (sp: (typeof activeSpecials)[0]) => {
    const result = await adminRemoveSpecialPrice(
      sp.restaurantId,
      sp.itemId || sp.itemName || '',
      sp.portionName,
    );
    if (result.ok) addToast('success', '特價已移除');
    else addToast('error', result.error || '移除失敗');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Add special */}
      <div className="card">
        <div className="h3 mb-3">💰 設定特價</div>
        <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
          <select
            value={selectedRest}
            onChange={(e) => {
              setSelectedRest(e.target.value);
              setSelectedItemId('');
            }}
            style={{ maxWidth: 200 }}
          >
            <option value="__NONE__">選擇餐廳...</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {selectedRest !== '__NONE__' && (
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              style={{ maxWidth: 200 }}
            >
              <option value="">選擇品項...</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} (${i.price})
                </option>
              ))}
            </select>
          )}
        </div>
        {selectedItem && (
          <div className="mt-3 flex gap-3" style={{ flexWrap: 'wrap' }}>
            <div className="flex flex-col gap-1">
              <label className="label">原價</label>
              <input
                value={`$${selectedItem.price}`}
                disabled
                style={{ width: 80 }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">特價</label>
              <input
                type="number"
                value={specialPrice}
                onChange={(e) => setSpecialPrice(e.target.value)}
                placeholder="特價"
                style={{ width: 80 }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">開始日</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: 150 }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">結束日</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: 150 }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">標籤</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="如：當季限定"
                style={{ width: 120 }}
              />
            </div>
            <div className="flex items-end">
              <button
                className="btn btn-primary"
                onClick={handleAdd}
                disabled={!specialPrice}
              >
                <Plus size={16} /> 設定
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active specials */}
      <div className="card">
        <div className="h3 mb-3">🏷️ 目前特價</div>
        {activeSpecials.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏷️</div>
            <div className="empty-state-title">沒有進行中的特價</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {activeSpecials.map((sp, idx) => (
              <div key={idx} className="admin-item-row">
                <Tag
                  size={16}
                  style={{ color: 'var(--primary)', flexShrink: 0 }}
                />
                <div
                  className="flex flex-col flex-1"
                  style={{ minWidth: 0 }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">
                      {getItemName(sp.restaurantId, sp.itemId)}
                    </span>
                    <span
                      className="badge badge-default"
                      style={{ fontSize: 11 }}
                    >
                      {getRestName(sp.restaurantId)}
                    </span>
                    {sp.label && (
                      <span className="badge badge-primary">{sp.label}</span>
                    )}
                  </div>
                  <span className="caption">
                    {sp.startDate || '即日起'} ~ {sp.endDate || '無期限'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="caption">
                    <s>${sp.originalPrice}</s>
                  </span>
                  <span
                    className="price-display price-sm"
                    style={{ color: 'var(--error)' }}
                  >
                    ${sp.specialPrice}
                  </span>
                </div>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => handleRemove(sp)}
                  title="移除特價"
                  style={{ color: 'var(--error)' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
