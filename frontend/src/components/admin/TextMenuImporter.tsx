import { useState, useMemo } from 'react';
import { FileText, Check, X, Zap, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';
import classNames from 'classnames';
import { useStore } from '../../store';
import { useToast } from '../../hooks/useToast';
import { parseMenuText } from '../../utils/menuParser';
import { parseCsvMenuText } from '../../utils/csvMenuParser';
import type { ParsedMenuItem } from '../../types';

const SAMPLE_CSV = `RestaurantID,ItemID,SubCategory,ItemName,Flavors,Price
4,101,蘋果系列,蘋果香青,,70
4,102,蘋果系列,蘋果烏龍,,70
4,103,蘋果系列,蘋果青凍飲,,75
4,104,蘋果系列,奶蓋蘋果青,,80
4,201,草莓系列,草莓青茶,,75
4,202,草莓系列,烤糖奶蓋草莓奶綠,,80
4,203,草莓系列,烤糖奶蓋草莓紅,,80
4,204,草莓系列,草莓奶綠,,90
4,301,奶蓋系列,烤糖奶蓋紅,,60
4,302,奶蓋系列,海鹽奶蓋香綠・青・烏,,60
4,303,奶蓋系列,海鹽奶蓋紅茶,,70
4,304,奶蓋系列,烤糖奶蓋綠,,70
4,401,老賴招牌,老賴紅茶,,40
4,402,老賴招牌,手工豆漿,,55
4,403,老賴招牌,豆香紅茶,,60
4,404,老賴招牌,太后牛乳,,65
4,405,老賴招牌,珍珠紅茶,,45
4,406,老賴招牌,珍珠奶茶,,55
4,407,老賴招牌,烏梅紅茶,,50
4,408,老賴招牌,冬瓜檸檬,,55
4,501,醇原茶,醇原茶,,40
4,502,醇原茶,冷香青茶,,40
4,503,醇原茶,茉翠香綠,,40
4,504,醇原茶,青霧綠茶,,40
4,505,醇原茶,文清烏龍,,40
4,601,穀麥系列,冬檸穀麥,,40
4,602,穀麥系列,玄米穀麥茶,,40
4,603,穀麥系列,穀麥豆香,,55
4,604,穀麥系列,穀麥奶茶,,55
4,605,穀麥系列,穀麥太后牛乳,,65
4,701,醇茶調飲,鮮檸紅茶,,55
4,702,醇茶調飲,鮮檸青霧綠,,55
4,703,醇茶調飲,鮮檸香綠・青,,55
4,704,醇茶調飲,鮮檸珍珠奶茶,,65
4,705,醇茶調飲,樂多香綠・青,,55
4,801,醇冬瓜,熬煮冬瓜茶,,40
4,802,醇冬瓜,冬瓜冷香青,,40
4,803,醇冬瓜,冬瓜青霧,,40
4,804,醇冬瓜,冬瓜紅茶,,40
4,805,醇冬瓜,冬瓜香綠,,40
4,806,醇冬瓜,冬瓜太后牛乳,,65
4,807,醇冬瓜,香綠太后牛乳,,65
4,901,醇奶茶,珍珠太后牛乳,,70
4,902,醇奶茶,布丁太后牛乳,,75
4,903,醇奶茶,招牌奶茶,,55
4,904,醇奶茶,胚芽奶茶,,65
4,905,醇奶茶,椰果奶茶,,65
4,906,醇奶茶,布丁奶茶,,65
4,907,醇奶茶,香綠奶茶,,55
4,908,醇奶茶,珍珠奶綠,,55
4,909,醇奶茶,布丁綠奶,,65
4,910,醇奶茶,珍珠胚芽奶茶,,65
4,911,醇奶茶,冷香青茶,,40
4,912,醇奶茶,冷香青,,40
4,913,醇奶茶,茉翠香綠,,40
4,914,醇奶茶,青霧綠茶,,40
4,915,醇奶茶,文清烏龍,,40
4,1001,醇烏龍,冬瓜烏龍,,40
4,1002,醇烏龍,冰淇淋烏龍,,60
4,1003,醇烏龍,烏龍奶茶,,55
4,1004,醇烏龍,鮮檸烏龍,,55
4,1005,醇烏龍,樂多烏龍,,55
4,1006,醇烏龍,珍珠烏龍奶茶,,55
4,1007,醇烏龍,烏龍太后牛乳,,65
4,1008,醇烏龍,珍珠布丁奶茶,,70
4,1101,醇芝麻,黑芝麻豆漿,,65
4,1102,醇芝麻,黑芝麻奶茶,,65
4,1103,醇芝麻,黑芝麻珍珠奶茶,,70
4,1104,醇芝麻,黑芝麻胚芽奶茶,,75
4,1105,醇芝麻,黑芝麻太后牛乳,,80
4,1106,醇芝麻,黑芝麻珍珠太后牛乳,,85
4,1201,醇鮮果,鮮三果茶,,70
4,1202,醇鮮果,鮮百香雙Q,,70
4,1203,醇鮮果,鮮百香果綠,,65
4,1204,醇鮮果,鮮百香樂多,,65
4,1205,醇柳橙樂多,,70
4,1301,老賴冰粿室,冬檸冰粿飲,,65
4,1302,老賴冰粿室,烏龍冰粿奶茶,,65
4,1303,老賴冰粿室,珍珠冰粿奶茶,,65
4,1401,蜂蜜系列,蜂蜜冷香青,,55
4,1402,蜂蜜系列,蜂蜜香綠,,55
4,1403,蜂蜜系列,蜂蜜烏龍,,55
4,1404,蜂蜜系列,蜂蜜奶茶,,65
4,1501,冰淇淋系列,冰淇淋紅茶,,60
4,1502,冰淇淋系列,凍香冰淇淋紅茶,,65
4,1503,冰淇淋系列,冰淇淋奶茶,,70
4,1504,冰淇淋系列,凍香冰淇淋奶茶,,75
4,1601,醇茶包,茶後茶包－台灣精選紅茶,,99

RestaurantID,ItemID,PortionName,Price
4,401,杯,40
4,401,瓶,130
4,402,杯,55
4,402,瓶,175
4,403,杯,60
4,403,瓶,190
4,404,杯,65
4,404,瓶,205
4,408,杯,55
4,408,瓶,175
4,501,杯,40
4,501,瓶,130
4,502,杯,40
4,502,瓶,130
4,503,杯,40
4,503,瓶,130
4,504,杯,40
4,504,瓶,130
4,505,杯,40
4,505,瓶,130
4,601,杯,40
4,601,瓶,130
4,602,杯,40
4,602,瓶,130
4,603,杯,55
4,603,瓶,175
4,604,杯,55
4,604,瓶,175
4,605,杯,65
4,605,瓶,205
4,701,杯,55
4,701,瓶,175
4,702,杯,55
4,702,瓶,175
4,703,杯,55
4,703,瓶,175
4,704,杯,65
4,704,瓶,175
4,801,杯,40
4,801,瓶,130
4,802,杯,40
4,802,瓶,130
4,803,杯,40
4,803,瓶,130
4,804,杯,40
4,804,瓶,130
4,805,杯,40
4,805,瓶,130
4,806,杯,65
4,806,瓶,205
4,807,杯,65
4,807,瓶,205
4,901,杯,70
4,901,瓶,175
4,903,杯,55
4,903,瓶,175
4,907,杯,55
4,907,瓶,175
4,1001,杯,40
4,1001,瓶,130
4,1003,杯,55
4,1003,瓶,175
4,1004,杯,55
4,1004,瓶,175
4,1007,杯,65
4,1007,瓶,205`;

export default function TextMenuImporter() {
  const [text, setText] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState('__NONE__');
  const [parsedItems, setParsedItems] = useState<ParsedMenuItem[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const menuPayload = useStore((s) => s.menuPayload);
  const adminApplyChanges = useStore((s) => s.adminApplyChanges);
  const addToast = useToast((s) => s.addToast);

  const restaurants = useMemo(
    () => menuPayload?.restaurants || [],
    [menuPayload],
  );

  const handleParse = () => {
    if (!text.trim()) return;
    const items = menuPayload?.items || [];
    
    // Check if input is CSV format
    const isCsv = text.toLowerCase().includes('restaurantid') || text.toLowerCase().includes('itemid');
    
    let result: ParsedMenuItem[];
    if (isCsv) {
      result = parseCsvMenuText(text, items, selectedRestaurant);
      // Auto-detect restaurant if not selected
      if (selectedRestaurant === '__NONE__' && result.length > 0 && result[0].restaurantId) {
        const detectedId = result[0].restaurantId;
        const exists = restaurants.find((r) => r.id === detectedId);
        if (exists) {
          setSelectedRestaurant(detectedId);
        }
      }
    } else {
      if (selectedRestaurant === '__NONE__') {
        addToast('error', '請選擇目標餐廳');
        return;
      }
      result = parseMenuText(text, items, selectedRestaurant);
    }

    setParsedItems(result);
    setCheckedItems(new Set(result.map((_, i) => i)));

    if (result.length === 0) {
      addToast('info', '未找到可比對的品項內容');
    } else {
      addToast('success', `成功解析 ${result.length} 項品項，已加入待審變更`);
    }
  };

  const toggleItem = (idx: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    setCheckedItems(new Set(parsedItems.map((_, i) => i)));
  };

  const deselectAll = () => {
    setCheckedItems(new Set());
  };

  const handleApply = async () => {
    const selected = parsedItems.filter((_, i) => checkedItems.has(i));
    if (selected.length === 0) return;

    // Group selected items by restaurantId
    const itemsByRest = new Map<string, typeof selected>();
    selected.forEach((item) => {
      const rid = item.restaurantId || (selectedRestaurant !== '__NONE__' ? selectedRestaurant : '4');
      if (!itemsByRest.has(rid)) itemsByRest.set(rid, []);
      itemsByRest.get(rid)!.push(item);
    });

    let totalApplied = 0;

    for (const [restId, restItems] of itemsByRest.entries()) {
      const changes = restItems.map((item) => ({
        type: item.changeType === 'sale' ? 'update' : item.changeType,
        itemId: item.itemId || item.matchedItemId || '',
        itemName: item.name,
        price: item.price,
        category: item.category,
        subCategory: item.subCategory,
        flavors: item.flavors,
        limitedType: item.limitedType,
        portions: item.portions,
      }));

      const result = await adminApplyChanges(restId, changes);
      if (result.ok) {
        totalApplied += restItems.length;
      } else {
        addToast('error', `餐廳 (${restId}) 套用失敗: ${result.error || '未知錯誤'}`);
      }
    }

    if (totalApplied > 0) {
      addToast('success', `成功套用 ${totalApplied} 項變更至系統！`);
      setText('');
      setParsedItems([]);
      setCheckedItems(new Set());
    }
  };

  const grouped = useMemo(() => {
    const map: Record<string, ParsedMenuItem[]> = {
      add: [],
      update: [],
      remove: [],
      sale: [],
    };
    parsedItems.forEach((item) => {
      (map[item.changeType] || map.add).push(item);
    });
    return map;
  }, [parsedItems]);

  const typeConfig = {
    add: {
      label: '新增品項 (ADD)',
      icon: Check,
      color: 'var(--success)',
      badge: 'badge-success',
    },
    update: {
      label: '待審變更 / 內容與價格異動 (UPDATE)',
      icon: Zap,
      color: 'var(--warning)',
      badge: 'badge-warning',
    },
    remove: {
      label: '停售品項 (REMOVE)',
      icon: X,
      color: 'var(--error)',
      badge: 'badge-error',
    },
    sale: {
      label: '特價設定 (SALE)',
      icon: AlertTriangle,
      color: 'var(--primary)',
      badge: 'badge-primary',
    },
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Input Section */}
      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <div className="h3">📝 貼上菜單內容 / 雙表格 CSV</div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              setText(SAMPLE_CSV);
              setSelectedRestaurant('4');
              addToast('info', '已帶入老賴茶棧 CSV 測試範例');
            }}
          >
            <Sparkles size={14} /> 帶入老賴 CSV 範例
          </button>
        </div>
        <p className="caption mb-3">
          支援雙表格 CSV 格式 (<code>RestaurantID,ItemID,SubCategory,ItemName,Flavors,Price</code> 及 <code>RestaurantID,ItemID,PortionName,Price</code>)，貼入後系統將自動比對現有菜單並將異動匯入<b>待審變更</b>。
        </p>

        <div
          className="flex gap-3 mb-3 items-center"
          style={{ flexWrap: 'wrap' }}
        >
          <select
            value={selectedRestaurant}
            onChange={(e) => setSelectedRestaurant(e.target.value)}
            style={{ maxWidth: 240 }}
          >
            <option value="__NONE__">自動偵測 / 選擇餐廳...</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} (ID: {r.id})
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={handleParse}
            disabled={!text.trim()}
          >
            <FileText size={16} /> 比對現有菜單 & 匯入待審變更
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            '請貼上 CSV 文字或菜單列表...\n\n範例：\nRestaurantID,ItemID,SubCategory,ItemName,Flavors,Price\n4,101,蘋果系列,蘋果香青,,70\n...\n\nRestaurantID,ItemID,PortionName,Price\n4,401,杯,40\n4,401,瓶,130'
          }
          rows={10}
          style={{
            resize: 'vertical',
            minHeight: 220,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        />
      </div>

      {/* Pending Changes Review Section */}
      {parsedItems.length > 0 && (
        <div className="card animate-slide-up" style={{ border: '2px solid var(--primary)' }}>
          <div className="flex justify-between items-center mb-3">
            <div>
              <div className="h3 flex items-center gap-2" style={{ color: 'var(--primary)' }}>
                <RefreshCw size={20} className="animate-spin-slow" />
                待審變更審視面板 (Pending Changes)
              </div>
              <p className="caption mt-1">
                共有 <b>{parsedItems.length}</b> 項比對結果，勾選欲調整之內容後點擊下方按鈕以批次套用至資料庫。
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <button className="btn btn-ghost btn-sm" onClick={selectAll}>
                全選
              </button>
              <button className="btn btn-ghost btn-sm" onClick={deselectAll}>
                取消全選
              </button>
              <span className="caption font-semibold">
                ({checkedItems.size} / {parsedItems.length} 已選擇)
              </span>
            </div>
          </div>

          {(['update', 'add', 'sale', 'remove'] as const).map((type) => {
            const items = grouped[type];
            if (!items || items.length === 0) return null;
            const config = typeConfig[type];
            const Icon = config.icon;

            return (
              <div key={type} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={16} style={{ color: config.color }} />
                  <span
                    className="font-semibold"
                    style={{ color: config.color }}
                  >
                    {config.label}
                  </span>
                  <span className={classNames('badge', config.badge)}>
                    {items.length} 項
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((item) => {
                    const globalIdx = parsedItems.indexOf(item);
                    const isChecked = checkedItems.has(globalIdx);
                    const hasDiffs = item.fieldDiffs && item.fieldDiffs.length > 0;

                    return (
                      <div
                        key={globalIdx}
                        className={classNames('parsed-item-row flex flex-col gap-1', {
                          checked: isChecked,
                        })}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: isChecked ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                          background: isChecked ? 'rgba(var(--primary-rgb), 0.05)' : 'transparent',
                        }}
                        onClick={() => toggleItem(globalIdx)}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleItem(globalIdx)}
                            className="checkbox-styled"
                            onClick={(e) => e.stopPropagation()}
                          />
                          {item.itemId && (
                            <span className="badge badge-outline mono" style={{ fontSize: 12 }}>
                              ID: {item.itemId}
                            </span>
                          )}
                          <span className="font-semibold flex-1 text-base">
                            {item.name}
                          </span>
                          {item.subCategory && (
                            <span className="badge badge-secondary" style={{ fontSize: 12 }}>
                              {item.subCategory}
                            </span>
                          )}
                          <span className="mono font-semibold" style={{ color: config.color }}>
                            ${item.price}
                          </span>
                        </div>

                        {/* Detailed Field Diffs */}
                        {hasDiffs ? (
                          <div className="flex flex-wrap gap-2 mt-1 pl-7">
                            {item.fieldDiffs?.map((diff, di) => (
                              <div
                                key={di}
                                className="caption"
                                style={{
                                  background: 'rgba(255, 180, 0, 0.15)',
                                  color: 'var(--warning)',
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  fontSize: 12,
                                }}
                              >
                                <b>{diff.label}：</b>
                                <s style={{ opacity: 0.7 }}>{diff.oldVal}</s> → <b>{diff.newVal}</b>
                              </div>
                            ))}
                          </div>
                        ) : item.portions && item.portions.length > 0 ? (
                          <div className="caption pl-7 text-muted" style={{ fontSize: 12 }}>
                            <b>獨立份量：</b>
                            {item.portions.map((p) => `${p.name} $${p.price}`).join(' / ')}
                          </div>
                        ) : null}

                        {/* Priority Tag Selection for New/Updated items */}
                        <div className="flex items-center gap-2 pl-7 mt-1" onClick={(e) => e.stopPropagation()}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>優先排序標記：</span>
                          {(['期間限定', '新品上市', '店長推薦'] as const).map((tag) => {
                            const isTagged = item.limitedType === tag;
                            const icons = { '期間限定': '🌸', '新品上市': '🆕', '店長推薦': '⭐' };
                            return (
                              <button
                                key={tag}
                                type="button"
                                className={classNames('btn btn-xs', {
                                  'btn-primary': isTagged,
                                  'btn-ghost': !isTagged,
                                })}
                                style={{
                                  fontSize: 11,
                                  padding: '1px 6px',
                                  height: 20,
                                  borderRadius: 10,
                                  border: isTagged ? 'none' : '1px dashed var(--glass-border)',
                                }}
                                onClick={() => {
                                  setParsedItems((prev) =>
                                    prev.map((pi, idx) =>
                                      idx === globalIdx
                                        ? { ...pi, limitedType: isTagged ? '' : tag }
                                        : pi,
                                    ),
                                  );
                                }}
                              >
                                {icons[tag]} {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <hr className="divider" />
          <div className="flex gap-3 justify-end items-center">
            <span className="caption">
              即將套用 <b>{checkedItems.size}</b> 項變更至系統菜單
            </span>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setParsedItems([]);
                setCheckedItems(new Set());
              }}
            >
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={handleApply}
              disabled={checkedItems.size === 0}
            >
              <Check size={16} /> 確認並套用 {checkedItems.size} 項變更
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
