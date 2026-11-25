import type { FieldDiff, MenuItem, ParsedMenuItem, Portion } from '../types';
import {
  normalizeName,
  getBaseItemName,
  dedupePortions,
  formatPortionsSummary,
} from './normalize.ts';

// 價格模式
const PRICE_PATTERNS = [
  /[$＄]\s*(\d+)/, // $65 or ＄65
  /(\d{2,3})\s*元/, // 65元
  /NT\$?\s*(\d+)/i, // NT$65
];

// 特價模式
const SALE_PATTERN = /原價.*?[$＄]?(\d+).*?[→➜>＞].*?[$＄]?(\d+)/;

// 份量模式（涵蓋飲品與正餐常見單位）
const PORTION_UNIT =
  '特大杯|大杯|中杯|小杯|大碗|小碗|大份|小份|杯|瓶|壺|碗|盤|份|罐|盒|大|中|小|XL|L|M|S';
const PORTION_PATTERN = new RegExp(`(${PORTION_UNIT})\\s*[$＄]?\\s*(\\d+)`, 'gi');
const PORTION_HEAD_PATTERN = new RegExp(`^(.+?)\\s*(?:${PORTION_UNIT})\\s*[$＄]?\\s*\\d+`, 'i');

// 語意標記
const SECTION_MARKERS: Record<string, RegExp> = {
  add: /新品|新增|上市|NEW|🆕|限定|新推出/i,
  remove: /停售|下架|停賣|售完|❌|暫停|取消/i,
  sale: /特價|優惠|促銷|折扣|🔥|限時|活動價/i,
};

function detectSection(line: string): 'add' | 'remove' | 'sale' | null {
  for (const [key, regex] of Object.entries(SECTION_MARKERS)) {
    if (regex.test(line)) return key as 'add' | 'remove' | 'sale';
  }
  return null;
}

function extractPrice(line: string): number | null {
  for (const pattern of PRICE_PATTERNS) {
    const match = line.match(pattern);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

function extractPortions(line: string): Portion[] {
  const portions: Portion[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(PORTION_PATTERN.source, 'gi');
  while ((match = regex.exec(line)) !== null) {
    portions.push({ name: match[1], price: parseInt(match[2], 10) });
  }
  return dedupePortions(portions);
}

function extractSalePrice(
  line: string,
): { originalPrice: number; salePrice: number } | null {
  const match = line.match(SALE_PATTERN);
  if (match) {
    return {
      originalPrice: parseInt(match[1], 10),
      salePrice: parseInt(match[2], 10),
    };
  }
  return null;
}

export function parseMenuText(
  text: string,
  existingItems: MenuItem[],
  restaurantId: string,
  defaultCategory: string = '正餐',
): ParsedMenuItem[] {
  const results: ParsedMenuItem[] = [];
  const lines = text.split('\n');
  let currentSection: 'add' | 'remove' | 'sale' | null = null;
  let currentSubCategory = '';

  const resolveItemCategory = (subCat: string) => {
    const isSubDrink = /^(飲料|飲品)$/.test((subCat || '').trim());
    return defaultCategory === '飲料' || isSubDrink ? '飲料' : defaultCategory || '正餐';
  };

  // Build existing items map for matching
  const existingMap = new Map<string, MenuItem>();
  const existingBaseMap = new Map<string, MenuItem>();
  existingItems
    .filter((i) => i.restaurantId === restaurantId)
    .forEach((item) => {
      existingMap.set(normalizeName(item.name), item);
      const base = getBaseItemName(item.name);
      if (base) existingBaseMap.set(normalizeName(base), item);
    });

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check for section markers
    const section = detectSection(line);
    if (section) {
      currentSection = section;
    }

    // Check for category headers (short lines without prices or portions)
    if (
      line.length < 15 &&
      !extractPrice(line) &&
      extractPortions(line).length === 0 &&
      /[\u4e00-\u9fff]{2,}/.test(line)
    ) {
      const sec = detectSection(line);
      if (sec) {
        currentSection = sec;
        continue;
      }
      currentSubCategory = line.replace(/[【】[\]《》]/g, '').trim();
      continue;
    }

    // Check for sale price pattern
    const sale = extractSalePrice(line);
    if (sale) {
      const nameMatch = line.match(/^(.+?)\s*原價/);
      if (nameMatch) {
        const name = nameMatch[1].trim();
        const existing = existingMap.get(normalizeName(name));
        results.push({
          name,
          price: sale.salePrice,
          category: resolveItemCategory(currentSubCategory),
          subCategory: currentSubCategory,
          portions: [],
          changeType: 'sale',
          oldPrice: sale.originalPrice,
          matchedItemId: existing?.id,
          saleLabel: '特價',
        });
        continue;
      }
    }

    // Check for portions
    const portions = extractPortions(line);
    if (portions.length > 1) {
      const nameMatch = line.match(PORTION_HEAD_PATTERN);
      if (nameMatch) {
        const name = nameMatch[1].replace(/[\s\-_:：]+$/, '').trim();
        if (name) {
          const existing =
            existingMap.get(normalizeName(name)) ||
            existingBaseMap.get(normalizeName(getBaseItemName(name)));
          const basePrice = Math.min(...portions.map((p) => p.price));
          const diffs: FieldDiff[] = [];

          if (existing) {
            if (existing.price !== basePrice) {
              diffs.push({
                field: 'price',
                label: '基礎價格',
                oldVal: `$${existing.price}`,
                newVal: `$${basePrice}`,
              });
            }
            if (existing.name.trim() !== name.trim()) {
              diffs.push({
                field: 'name',
                label: '品項名稱',
                oldVal: existing.name,
                newVal: name,
              });
            }
            const existingRawPortionsStr = formatPortionsSummary(existing.portions, { dedupe: false });
            const newPortionsStr = formatPortionsSummary(portions);
            if (existingRawPortionsStr !== newPortionsStr) {
              diffs.push({
                field: 'portions',
                label: '份量規格',
                oldVal: existingRawPortionsStr || '(無份量)',
                newVal: newPortionsStr,
              });
            }
          }

          results.push({
            itemId: existing?.id,
            matchedItemId: existing?.id,
            name,
            price: basePrice,
            category: resolveItemCategory(currentSubCategory),
            subCategory: currentSubCategory || existing?.subCategory || '',
            portions,
            changeType:
              currentSection === 'remove'
                ? 'remove'
                : existing
                  ? diffs.length > 0
                    ? 'update'
                    : 'unchanged'
                  : 'add',
            oldPrice: existing?.price,
            oldPortions: existing?.portions,
            fieldDiffs: diffs,
          });
          continue;
        }
      }
    }

    // Standard price extraction
    const price = extractPrice(line);
    if (price !== null && price > 0 && price < 500) {
      let name = line;
      for (const pattern of PRICE_PATTERNS) {
        const match = line.match(pattern);
        if (match) {
          name = line.substring(0, match.index || 0).trim();
          break;
        }
      }
      name = name.replace(/[\s\-_]+$/, '').replace(/^[\s\-_]+/, '');
      if (name.length < 1 || name.length > 30) continue;

      const existing =
        existingMap.get(normalizeName(name)) ||
        existingBaseMap.get(normalizeName(getBaseItemName(name)));

      const diffs: FieldDiff[] = [];
      let changeType: ParsedMenuItem['changeType'] = 'add';
      if (currentSection === 'remove') {
        changeType = 'remove';
      } else if (currentSection === 'sale') {
        changeType = 'sale';
      } else if (existing) {
        if (existing.price !== price) {
          diffs.push({
            field: 'price',
            label: '基礎價格',
            oldVal: `$${existing.price}`,
            newVal: `$${price}`,
          });
        }
        if (existing.name.trim() !== name.trim()) {
          diffs.push({
            field: 'name',
            label: '品項名稱',
            oldVal: existing.name,
            newVal: name,
          });
        }
        changeType = diffs.length > 0 ? 'update' : 'unchanged';
      }

      results.push({
        itemId: existing?.id,
        matchedItemId: existing?.id,
        name,
        price,
        category: resolveItemCategory(currentSubCategory),
        subCategory: currentSubCategory || existing?.subCategory || '',
        portions: existing ? dedupePortions(existing.portions) : [],
        changeType,
        oldPrice: existing?.price,
        saleLabel: currentSection === 'sale' ? '特價' : undefined,
        fieldDiffs: diffs,
      });
    } else if (currentSection === 'remove') {
      // For remove section, items might not have prices
      const name = line.replace(/[（(].*?[)）]/g, '').trim();
      if (name.length >= 2 && name.length <= 20) {
        const existing = existingMap.get(normalizeName(name));
        if (existing) {
          results.push({
            name,
            price: existing.price,
            category: resolveItemCategory(currentSubCategory),
            subCategory: currentSubCategory,
            portions: [],
            changeType: 'remove',
            matchedItemId: existing.id,
          });
        }
      }
    }
  }

  return results;
}
