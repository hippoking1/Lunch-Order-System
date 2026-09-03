import type { MenuItem, ParsedMenuItem, Portion } from '../types';

// 價格模式
const PRICE_PATTERNS = [
  /[$＄]\s*(\d+)/, // $65 or ＄65
  /(\d{2,3})\s*元/, // 65元
  /NT\$?\s*(\d+)/i, // NT$65
];

// 特價模式
const SALE_PATTERN = /原價.*?[$＄]?(\d+).*?[→➜>＞].*?[$＄]?(\d+)/;

// 份量模式
const PORTION_PATTERN = /(大杯|中杯|小杯|大|中|小|L|M|S)\s*[$＄]?\s*(\d+)/gi;

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
    if (match) return parseInt(match[1]);
  }
  return null;
}

function extractPortions(line: string): Portion[] {
  const portions: Portion[] = [];
  let match;
  const regex = new RegExp(PORTION_PATTERN.source, 'gi');
  while ((match = regex.exec(line)) !== null) {
    portions.push({ name: match[1], price: parseInt(match[2]) });
  }
  return portions;
}

function extractSalePrice(
  line: string,
): { originalPrice: number; salePrice: number } | null {
  const match = line.match(SALE_PATTERN);
  if (match) {
    return { originalPrice: parseInt(match[1]), salePrice: parseInt(match[2]) };
  }
  return null;
}

function normalizeName(name: string): string {
  return name
    .replace(/\s+/g, '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 65248),
    )
    .toLowerCase();
}

export function parseMenuText(
  text: string,
  existingItems: MenuItem[],
  restaurantId: string,
): ParsedMenuItem[] {
  const results: ParsedMenuItem[] = [];
  const lines = text.split('\n');
  let currentSection: 'add' | 'remove' | 'sale' | null = null;
  let currentCategory = '';

  // Build existing items map for matching
  const existingMap = new Map<string, MenuItem>();
  existingItems
    .filter((i) => i.restaurantId === restaurantId)
    .forEach((item) => {
      existingMap.set(normalizeName(item.name), item);
    });

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check for section markers
    const section = detectSection(line);
    if (section) {
      currentSection = section;
    }

    // Check for category headers (short lines without prices)
    if (
      line.length < 15 &&
      !extractPrice(line) &&
      /[\u4e00-\u9fff]{2,}/.test(line)
    ) {
      const sec = detectSection(line);
      if (sec) {
        currentSection = sec;
        continue;
      }
      currentCategory = line.replace(/[【】[\]《》]/g, '').trim();
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
          category: currentCategory,
          subCategory: '',
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
      const nameMatch = line.match(
        /^(.+?)\s*(?:大杯|中杯|小杯|大|中|小|L|M|S)/i,
      );
      if (nameMatch) {
        const name = nameMatch[1].trim();
        const existing = existingMap.get(normalizeName(name));
        results.push({
          name,
          price: portions[0].price,
          category: currentCategory,
          subCategory: '',
          portions,
          changeType:
            currentSection === 'remove'
              ? 'remove'
              : existing
                ? 'update'
                : 'add',
          matchedItemId: existing?.id,
        });
        continue;
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

      const existing = existingMap.get(normalizeName(name));

      let changeType: ParsedMenuItem['changeType'] = 'add';
      if (currentSection === 'remove') {
        changeType = 'remove';
      } else if (currentSection === 'sale') {
        changeType = 'sale';
      } else if (existing) {
        changeType = existing.price !== price ? 'update' : 'add';
      }

      results.push({
        name,
        price,
        category: currentCategory,
        subCategory: '',
        portions: [],
        changeType,
        oldPrice: existing?.price,
        matchedItemId: existing?.id,
        saleLabel: currentSection === 'sale' ? '特價' : undefined,
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
            category: currentCategory,
            subCategory: '',
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
