import { useState, useMemo } from 'react';
import { FileText, Check, X, Zap, AlertTriangle, Sparkles, RefreshCw, Copy } from 'lucide-react';
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

export default function TextMenuImporter({ initialRestaurantId }: { initialRestaurantId?: string } = {}) {
  const [text, setText] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState(initialRestaurantId || '__NONE__');
  const [parsedItems, setParsedItems] = useState<ParsedMenuItem[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const menuPayload = useStore((s) => s.menuPayload);
  const allRestaurants = useStore((s) => s.allRestaurants);
  const adminApplyChanges = useStore((s) => s.adminApplyChanges);
  const adminCleanupDuplicates = useStore((s) => s.adminCleanupDuplicates);
  const addToast = useToast((s) => s.addToast);
  const [cleaning, setCleaning] = useState(false);
  const [showUnchanged, setShowUnchanged] = useState(false);

  const restaurants = useMemo(
    () => (allRestaurants && allRestaurants.length > 0 ? allRestaurants : (menuPayload?.restaurants || [])),
    [allRestaurants, menuPayload],
  );

  const handleCopyGemPrompt = () => {
    const selectedObj = restaurants.find((r) => r.id === selectedRestaurant);
    const restName = selectedObj ? selectedObj.name : '此餐廳';
    const promptText = `角色任務：
你是一位精準的資料處理專家，專精於 OCR 文字提取與結構化資料轉換。請分析這張菜單照片，並將其轉換為適合「${restName}」匯入系統的 CSV 資料表格。

具體指令與欄位需求：

第一部分：請輸出 MenuItems 表格（CSV 格式）
欄位依序為：
RestaurantID,ItemID,SubCategory,ItemName,Flavors,Price
- RestaurantID：直接填入 1 即可（系統匯入時會自動對齊${restName}，無需手動修改）
- ItemID：請依照 SubCategory 類別從 101, 102... 201, 202... 依序編號
- SubCategory：菜單上的分類小標題（如：泰式系列、經典茶飲、超值便當）
- ItemName：餐點名稱
- Flavors：若有口味選擇請列出，以逗號分隔（如：辣,不辣；若無則留空）
- Price：若有不同份量，填入「最低」單價；無份量之分則填固定單價

第二部分：請輸出 ItemPortions 表格（CSV 格式）
注意：僅針對同一個餐點有不同份量（如：大/中/小、瓶裝/杯裝）才填寫此表。
欄位依序為：
RestaurantID,ItemID,PortionName,Price
- RestaurantID：直接填入 1
- ItemID：必須與上方 MenuItems 對應的 ItemID 完全一致
- PortionName：份量名稱（如：大、小、杯、瓶）
- Price：該份量對應的價格

約束條件：
1. 確保 ItemID 在兩張表中能正確對應，這是我系統份量關聯的關鍵。
2. 忽略菜單中的裝飾性文字、電話、地址或廣告標語。
3. 輸出純 CSV 格式，方便我直接複製貼上。
4. 若圖片文字模糊，請在該欄位標註 [待確認]。`;

    navigator.clipboard.writeText(promptText);
    addToast('success', `已複製「${restName}」專用 Gem Prompt！直接貼給 Gemini 辨識即可`);
  };

  const handleCleanupDuplicates = async () => {
    setCleaning(true);
    const targetRest = selectedRestaurant === '__NONE__' ? undefined : selectedRestaurant;
    const res = await adminCleanupDuplicates(targetRest);
    setCleaning(false);
    if (res.ok) {
      addToast('success', `清理完成！共清除了 ${res.deletedCount || 0} 筆重複品項`);
    } else {
      addToast('error', res.error || '清理失敗');
    }
  };

  const handleParse = () => {
    if (!text.trim()) return;
    const items = menuPayload?.items || [];
    const targetRestObj = restaurants.find((r) => r.id === selectedRestaurant);
    const defaultCat = targetRestObj?.category || '正餐';

    // Check if input is CSV format
    const isCsv = text.toLowerCase().includes('restaurantid') || text.toLowerCase().includes('itemid');

    let result: ParsedMenuItem[];
    if (isCsv) {
      result = parseCsvMenuText(text, items, selectedRestaurant, defaultCat);
      // Auto-detect restaurant if not selected
      if (selectedRestaurant === '__NONE__' && result.length > 0 && result[0].restaurantId) {
        const detectedId = result[0].restaurantId;
        const exists = restaurants.find((r) => r.id === detectedId);
        if (exists) {
          setSelectedRestaurant(detectedId);
          // Re-parse with detected restaurant category
          result = parseCsvMenuText(text, items, detectedId, exists.category || '正餐');
        }
      }
    } else {
      if (selectedRestaurant === '__NONE__') {
        addToast('error', '請選擇目標餐廳');
        return;
      }
      result = parseMenuText(text, items, selectedRestaurant, defaultCat);
    }

    setParsedItems(result);
    // 預設僅勾選真正有異動之品項 (排除 unchanged)
    const changedIndices = result
      .map((item, i) => (item.changeType !== 'unchanged' ? i : -1))
      .filter((i) => i !== -1);
    setCheckedItems(new Set(changedIndices));

    if (result.length === 0) {
      addToast('info', '未找到可比對的品項內容');
    } else {
      const changeCount = changedIndices.length;
      addToast('success', `成功解析 ${result.length} 項品項，其中 ${changeCount} 項有異動待審`);
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
    const changed = parsedItems
      .map((item, i) => (item.changeType !== 'unchanged' ? i : -1))
      .filter((i) => i !== -1);
    setCheckedItems(new Set(changed));
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
      update: [],
      add: [],
      remove: [],
      sale: [],
      unchanged: [],
    };
    parsedItems.forEach((item) => {
      const ct = item.changeType || 'add';
      if (!map[ct]) map[ct] = [];
      map[ct].push(item);
    });
    return map;
  }, [parsedItems]);

  const typeConfig: Record<string, any> = {
    update: {
      label: '⚡ 待審變更 / 內容與價格異動 (UPDATE)',
      icon: Zap,
      color: 'var(--warning)',
      badge: 'badge-warning',
    },
    add: {
      label: '✨ 新增品項 (ADD)',
      icon: Check,
      color: 'var(--success)',
      badge: 'badge-success',
    },
    remove: {
      label: '❌ 停售品項 (REMOVE)',
      icon: X,
      color: 'var(--error)',
      badge: 'badge-error',
    },
    sale: {
      label: '🔥 特價設定 (SALE)',
      icon: AlertTriangle,
      color: 'var(--primary)',
      badge: 'badge-primary',
    },
    unchanged: {
      label: '✅ 內容完全一致 (無須變更)',
      icon: Check,
      color: 'var(--text-muted)',
      badge: 'badge-default',
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
          <button
            className="btn btn-outline btn-sm flex items-center gap-1"
            onClick={handleCopyGemPrompt}
            title="複製已為此餐廳量身設定的 Gemini Gem 分析 Prompt"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            <Copy size={14} /> 複製 Gem 專用 Prompt
          </button>
        </div>
        <p className="caption mb-2">
          支援雙表格 CSV 格式 (<code>RestaurantID,ItemID,SubCategory,ItemName,Flavors,Price</code> 及 <code>RestaurantID,ItemID,PortionName,Price</code>)，貼入後系統將自動比對現有菜單並將異動匯入<b>待審變更</b>。
        </p>
        <div style={{ background: 'rgba(124, 92, 252, 0.08)', border: '1px solid rgba(124, 92, 252, 0.2)', padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12, color: 'var(--text-secondary)' }}>
          💡 <b>智慧解耦提示</b>：只要在下方選單選好目標餐廳，CSV 內的 <code>RestaurantID</code>（無論填 1、30 或任意值）系統皆會<b>自動套用至該餐廳</b>，且份量以 <code>ItemID</code> 自動關聯，完全無需手動修改隨機 ID！
        </div>

        <div
          className="flex gap-3 mb-3 items-center"
          style={{ flexWrap: 'wrap' }}
        >
          <select
            value={selectedRestaurant}
            onChange={(e) => setSelectedRestaurant(e.target.value)}
            style={{ maxWidth: 280 }}
          >
            <option value="__NONE__">自動偵測 / 選擇餐廳...</option>
            {restaurants.map((r, idx) => (
              <option key={r.id} value={r.id}>
                #{idx + 1} {r.name} {(r as any).isActive === false ? '(已下架)' : ''} (ID: {r.id})
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
            <div className="flex gap-2 items-center flex-wrap">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleCleanupDuplicates}
                disabled={cleaning}
                title="掃描同餐廳同品項的重複文件並一鍵清除多餘品項"
              >
                {cleaning ? <RefreshCw size={14} className="animate-spin" /> : '🧹 一鍵清理重複品項'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={selectAll}>
                全選異動
              </button>
              <button className="btn btn-ghost btn-sm" onClick={deselectAll}>
                取消全選
              </button>
              <span className="caption font-semibold">
                ({checkedItems.size} / {parsedItems.filter(p => p.changeType !== 'unchanged').length} 待更新)
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
                                className="flex items-center gap-1.5"
                                style={{
                                  background: 'rgba(59, 130, 246, 0.12)',
                                  border: '1px solid rgba(59, 130, 246, 0.3)',
                                  padding: '3px 10px',
                                  borderRadius: 6,
                                  fontSize: 12,
                                }}
                              >
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                                  {diff.label}:
                                </span>
                                <span style={{ color: '#ef4444', textDecoration: 'line-through', opacity: 0.85 }}>
                                  {diff.oldVal}
                                </span>
                                <span style={{ color: 'var(--text-muted)' }}>➔</span>
                                <span style={{ color: '#10b981', fontWeight: 700 }}>
                                  {diff.newVal}
                                </span>
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

          {/* Unchanged Items Accordion */}
          {grouped.unchanged && grouped.unchanged.length > 0 && (
            <div
              className="mb-4 p-3"
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px dashed var(--glass-border)',
                borderRadius: 8,
              }}
            >
              <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() => setShowUnchanged(!showUnchanged)}
              >
                <div className="flex items-center gap-2">
                  <Check size={16} style={{ color: 'var(--text-muted)' }} />
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-muted)' }}>
                    ✅ 內容完全一致 / 無須變更 (UNCHANGED)
                  </span>
                  <span className="badge badge-default" style={{ fontSize: 11 }}>
                    {grouped.unchanged.length} 項
                  </span>
                </div>
                <span className="caption" style={{ color: 'var(--primary)', cursor: 'pointer' }}>
                  {showUnchanged ? '點擊折疊 ▲' : '點擊展開查看 ▼'}
                </span>
              </div>

              {showUnchanged && (
                <div className="flex flex-col gap-1.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
                  {grouped.unchanged.map((item, ui) => (
                    <div
                      key={ui}
                      className="flex items-center justify-between text-xs py-1 px-2"
                      style={{ opacity: 0.7 }}
                    >
                      <span className="mono">ID: {item.itemId || item.matchedItemId || '-'}</span>
                      <span className="font-medium flex-1 px-3">{item.name}</span>
                      <span>{item.subCategory || '-'}</span>
                      <span className="mono px-3 font-semibold">${item.price}</span>
                      <span className="badge badge-default" style={{ fontSize: 10 }}>完全一致</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
