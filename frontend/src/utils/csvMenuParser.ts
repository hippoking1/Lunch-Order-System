import type { MenuItem, ParsedMenuItem, Portion, FieldDiff } from '../types';
import { parseMenuText } from './menuParser';

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

function normalizeName(name: string): string {
  return name
    .replace(/\s+/g, '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 65248),
    )
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/【/g, '[')
    .replace(/】/g, ']')
    .replace(/，/g, ',')
    .replace(/：/g, ':')
    .toLowerCase();
}

function getBaseItemName(name: string): string {
  if (!name) return '';
  return name.replace(/[（(].*?[）)]/g, '').trim();
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
    return parseMenuText(text, existingItems, selectedRestaurantId || '__NONE__', defaultCategory);
  }

  const csvItemRows: CsvItemRow[] = [];
  const csvPortionRows: CsvPortionRow[] = [];

  let currentMode: 'item' | 'portion' | 'unknown' = 'unknown';

  for (const line of lines) {
    const cols = parseCsvLine(line);
    const headerStr = cols.join(',').toLowerCase();

    if (headerStr.includes('itemname') || headerStr.includes('subcategory')) {
      currentMode = 'item';
      continue;
    }
    if (headerStr.includes('portionname')) {
      currentMode = 'portion';
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
          price: price,
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
          price: price,
        });
      }
    }
  }

  const hasSelectedRest =
    Boolean(selectedRestaurantId &&
    selectedRestaurantId !== '__ALL__' &&
    selectedRestaurantId !== '__NONE__');

  // Group portions by itemId (優先直接以 itemId 關聯，徹底免去手動維護超長隨機 RestaurantID)
  const portionsByItemKey = new Map<string, Portion[]>();
  for (const p of csvPortionRows) {
    const itemOnlyKey = p.itemId;
    const fullKey = `${p.restaurantId}_${p.itemId}`;
    
    if (!portionsByItemKey.has(itemOnlyKey)) {
      portionsByItemKey.set(itemOnlyKey, []);
    }
    portionsByItemKey.get(itemOnlyKey)!.push({ name: p.portionName, price: p.price });

    if (!portionsByItemKey.has(fullKey)) {
      portionsByItemKey.set(fullKey, []);
    }
    portionsByItemKey.get(fullKey)!.push({ name: p.portionName, price: p.price });
  }

  // Create lookup map: 核心改造 - 名稱優先 (normalizedName) 及 基礎品名 (baseName 去除括號)
  const existingByKey = new Map<string, MenuItem>();
  const existingByNameKey = new Map<string, MenuItem>();
  const existingByBaseNameKey = new Map<string, MenuItem>();

  for (const item of existingItems) {
    existingByKey.set(`${item.restaurantId}_${item.id}`, item);
    existingByNameKey.set(`${item.restaurantId}_${normalizeName(item.name)}`, item);
    const base = getBaseItemName(item.name);
    if (base) {
      existingByBaseNameKey.set(`${item.restaurantId}_${normalizeName(base)}`, item);
    }
  }

  const results: ParsedMenuItem[] = [];

  for (const row of csvItemRows) {
    // 智慧綁定目標餐廳：若外部已選定目標餐廳，一律以選定餐廳 ID 為準
    const targetRestId = hasSelectedRest ? (selectedRestaurantId as string) : row.restaurantId;

    const key = `${targetRestId}_${row.itemId}`;
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

    // 優先以純 itemId 取得關聯份量，fallback 至 fullKey
    const portions = portionsByItemKey.get(row.itemId) || portionsByItemKey.get(key) || [];

    const isSubDrink = /^(飲料|飲品)$/.test((row.subCategory || '').trim());
    const resolvedCategory =
      defaultCategory === '飲料' || isSubDrink ? '飲料' : defaultCategory || '正餐';

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
        portions: portions,
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

      // Check portions diff
      const existingPortionsStr = (existing.portions || [])
        .map((p) => `${p.name}:$${p.price}`)
        .sort()
        .join(', ');
      const newPortionsStr = portions
        .map((p) => `${p.name}:$${p.price}`)
        .sort()
        .join(', ');

      if (portions.length > 0 && existingPortionsStr !== newPortionsStr) {
        diffs.push({
          field: 'portions',
          label: '份量規格',
          oldVal: existingPortionsStr || '(無份量)',
          newVal: newPortionsStr,
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
        portions: portions.length > 0 ? portions : existing.portions || [],
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
