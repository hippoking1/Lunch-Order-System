import type { MenuItem, ParsedMenuItem, Portion, FieldDiff } from '../types';
import { parseMenuText } from './menuParser.ts';
import {
  normalizeName,
  getBaseItemName,
  dedupePortions,
  formatPortionsSummary,
} from './normalize.ts';

interface CsvItemRow {
  restaurantId: string;
  itemId: string;
  subCategory: string;
  itemName: string;
  flavors: string;
  price: number;
}

interface CsvPortionRow {
  restaurantId: string;
  itemId: string;
  portionName: string;
  price: number;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === ',' || char === '\t') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCsvMenuText(
  text: string,
  existingItems: MenuItem[],
  selectedRestaurantId?: string,
  defaultCategory: string = '正餐',
): ParsedMenuItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Check if CSV format (has headers)
  const isCsvFormat = lines.some((l) => {
    const norm = l.toLowerCase().replace(/\s+/g, '');
    return (
      norm.includes('restaurantid') ||
      norm.includes('itemid') ||
      norm.includes('itemname') ||
      norm.includes('portionname')
    );
  });

  // Fallback to traditional text parser if not CSV format
  if (!isCsvFormat) {
    return parseMenuText(
      text,
      existingItems,
      selectedRestaurantId || '__NONE__',
      defaultCategory,
    );
  }

  const csvItemRows: CsvItemRow[] = [];
  const csvPortionRows: CsvPortionRow[] = [];

  let currentMode: 'item' | 'portion' | 'unknown' = 'unknown';
  let hasPortionSection = false;

  for (const line of lines) {
    const cols = parseCsvLine(line);
    const headerStr = cols.join(',').toLowerCase();

    if (headerStr.includes('itemname') || headerStr.includes('subcategory')) {
      currentMode = 'item';
      continue;
    }
    if (headerStr.includes('portionname')) {
      currentMode = 'portion';
      hasPortionSection = true;
      continue;
    }

    if (cols.length < 3) continue;

    if (currentMode === 'item') {
      // RestaurantID,ItemID,SubCategory,ItemName,Flavors,Price
      const [rId, iId, subCat, name, flav, prStr] = cols;
      const price = parseFloat(prStr);
      if (rId && name && !isNaN(price)) {
        csvItemRows.push({
          restaurantId: rId,
          itemId: iId || '',
          subCategory: subCat || '',
          itemName: name,
          flavors: flav || '',
          price,
        });
      } else if (cols.length >= 4 && !isNaN(parseFloat(cols[cols.length - 1]))) {
        // Fallback row mapping if columns differ slightly
        const lastPrice = parseFloat(cols[cols.length - 1]);
        csvItemRows.push({
          restaurantId: cols[0],
          itemId: cols[1] || '',
          subCategory: cols[2] || '',
          itemName: cols[3] || '',
          flavors: cols[4] || '',
          price: lastPrice,
        });
      }
    } else if (currentMode === 'portion') {
      // RestaurantID,ItemID,PortionName,Price
      const [rId, iId, pName, prStr] = cols;
      const price = parseFloat(prStr);
      if (rId && pName && !isNaN(price)) {
        csvPortionRows.push({
          restaurantId: rId,
          itemId: iId || '',
          portionName: pName,
          price,
        });
      }
    }
  }

  const hasSelectedRest = Boolean(
    selectedRestaurantId &&
      selectedRestaurantId !== '__ALL__' &&
      selectedRestaurantId !== '__NONE__',
  );

  // 分組份量：優先以原始 CSV 的 `${restaurantId}_${itemId}` 精準關聯，避免多店同 ItemID 碰撞，
  // 並保留單店純 `itemId` fallback，同時針對同品項重複份量列自動去重。
  const portionsByFullKey = new Map<string, Portion[]>();
  const portionsByItemIdOnly = new Map<string, Portion[]>();
  for (const p of csvPortionRows) {
    const entry = { name: p.portionName, price: p.price };
    const fullKey = `${p.restaurantId}_${p.itemId}`;
    const fullList = portionsByFullKey.get(fullKey) || [];
    fullList.push(entry);
    portionsByFullKey.set(fullKey, fullList);

    if (p.itemId) {
      const itemList = portionsByItemIdOnly.get(p.itemId) || [];
      itemList.push(entry);
      portionsByItemIdOnly.set(p.itemId, itemList);
    }
  }

  // Create lookup map: 核心改造 - 名稱優先 (normalizedName) 及 基礎品名 (baseName 去除括號)
  const existingByKey = new Map<string, MenuItem>();
  const existingByNameKey = new Map<string, MenuItem>();
  const existingByBaseNameKey = new Map<string, MenuItem>();

  for (const item of existingItems) {
    existingByKey.set(`${item.restaurantId}_${item.id}`, item);
    existingByNameKey.set(
      `${item.restaurantId}_${normalizeName(item.name)}`,
      item,
    );
    const base = getBaseItemName(item.name);
    if (base) {
      existingByBaseNameKey.set(
        `${item.restaurantId}_${normalizeName(base)}`,
        item,
      );
    }
  }

  const results: ParsedMenuItem[] = [];

  for (const row of csvItemRows) {
    // 智慧綁定目標餐廳：若外部已選定目標餐廳，一律以選定餐廳 ID 為準
    const targetRestId = hasSelectedRest
      ? (selectedRestaurantId as string)
      : row.restaurantId;

    const key = `${targetRestId}_${row.itemId}`;
    const rawCsvFullKey = `${row.restaurantId}_${row.itemId}`;
    const nameKey = `${targetRestId}_${normalizeName(row.itemName)}`;
    const baseName = getBaseItemName(row.itemName);
    const baseKey = `${targetRestId}_${normalizeName(baseName)}`;

    // 核心比對：
    // 1. 完全相同名稱優先
    // 2. 去除括號後的品名相同（品名後 () 內如有不同，認列為同一品項的更新！）
    // 3. ID 相同比對
    const existing =
      existingByNameKey.get(nameKey) ||
      existingByBaseNameKey.get(baseKey) ||
      existingByKey.get(key);

    // 優先以 CSV 原始 `${row.restaurantId}_${row.itemId}` 取得份量，fallback 至純 itemId，並執行去重
    const rawMatchedPortions =
      portionsByFullKey.get(rawCsvFullKey) ||
      (hasSelectedRest && row.itemId
        ? portionsByItemIdOnly.get(row.itemId)
        : undefined) ||
      [];
    const csvPortions = dedupePortions(rawMatchedPortions);

    const isSubDrink = /^(飲料|飲品)$/.test((row.subCategory || '').trim());
    const resolvedCategory =
      defaultCategory === '飲料' || isSubDrink
        ? '飲料'
        : defaultCategory || '正餐';

    if (!existing) {
      // ADD (真正的新增品項)
      results.push({
        itemId: row.itemId,
        restaurantId: targetRestId,
        name: row.itemName,
        price: row.price,
        category: resolvedCategory,
        subCategory: row.subCategory,
        flavors: row.flavors,
        portions: csvPortions,
        changeType: 'add',
      });
    } else {
      // UPDATE (名稱相同，正確判斷為現有品項進行更新)
      const diffs: FieldDiff[] = [];

      if (existing.price !== row.price) {
        diffs.push({
          field: 'price',
          label: '基礎價格',
          oldVal: `$${existing.price}`,
          newVal: `$${row.price}`,
        });
      }

      if (existing.name.trim() !== row.itemName.trim()) {
        diffs.push({
          field: 'name',
          label: '品項名稱',
          oldVal: existing.name,
          newVal: row.itemName,
        });
      }

      if ((existing.category || '').trim() !== resolvedCategory) {
        diffs.push({
          field: 'category',
          label: '主分類',
          oldVal: existing.category || '(無)',
          newVal: resolvedCategory,
        });
      }

      if (
        row.subCategory &&
        (existing.subCategory || '').trim() !== row.subCategory.trim()
      ) {
        diffs.push({
          field: 'subCategory',
          label: '子分類',
          oldVal: existing.subCategory || '(無)',
          newVal: row.subCategory,
        });
      }

      if (
        row.flavors &&
        (existing.flavors || '').trim() !== row.flavors.trim()
      ) {
        diffs.push({
          field: 'flavors',
          label: '風味標籤',
          oldVal: existing.flavors || '(無)',
          newVal: row.flavors,
        });
      }

      // 份量差異判定：
      // - 含 PortionName 表（雙表格 CSV）：直接以 csvPortions 為準（含清除舊份量與順序調整）
      // - 不含 PortionName 表（單表格 CSV）：保留既有去重後份量，不誤刪既有份量
      // - 若現有資料本身存在重複份量（raw !== deduped），亦視為異動供一鍵修正
      const existingRawStr = formatPortionsSummary(existing.portions, {
        dedupe: false,
      });
      const nextPortions = hasPortionSection
        ? csvPortions
        : dedupePortions(existing.portions);
      const nextPortionsStr = formatPortionsSummary(nextPortions);

      if (existingRawStr !== nextPortionsStr) {
        diffs.push({
          field: 'portions',
          label: '份量規格',
          oldVal: existingRawStr || '(無份量)',
          newVal: nextPortionsStr || '(無份量 / 單一價)',
        });
      }

      results.push({
        itemId: existing.id, // 指向現有正確 ID
        matchedItemId: existing.id,
        restaurantId: targetRestId,
        name: row.itemName,
        price: row.price,
        category: resolvedCategory,
        subCategory: row.subCategory || existing.subCategory,
        flavors: row.flavors || existing.flavors,
        portions: nextPortions,
        changeType: diffs.length > 0 ? 'update' : 'unchanged',
        oldPrice: existing.price,
        oldSubCategory: existing.subCategory,
        oldFlavors: existing.flavors,
        oldPortions: existing.portions,
        fieldDiffs: diffs,
      });
    }
  }

  return results;
}
