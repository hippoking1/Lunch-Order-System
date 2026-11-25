export interface PortionLike {
  name: string;
  price: number;
}

export interface StoredPortionRecord {
  id: string;
  restaurantId: string;
  menuItemId?: string;
  menuItemName?: string;
  normalizedName?: string;
  legacyItemId?: string;
  portionName?: string;
  price?: number;
}

export interface PortionUpsertRecord {
  docId: string;
  restaurantId: string;
  menuItemId: string;
  menuItemName: string;
  normalizedName: string;
  portionName: string;
  price: number;
  sortOrder: number;
}

/**
 * 品項名稱正規化
 * 1. 移除所有空白字元
 * 2. 全形英數轉半形
 * 3. 全形括號、標點轉半形 (（）-> (), 【】-> [], ，-> ,, ：-> :)
 * 4. 轉小寫
 */
export function normalizeName(name: string): string {
  if (!name) return '';
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

/**
 * 提取品項核心名稱（去除品名後方或內部的括號 ()、（） 及其說明文字）
 */
export function getBaseItemName(name: string): string {
  if (!name) return '';
  return name.replace(/[（(].*?[）)]/g, '').trim();
}

export function safeDocKey(raw: string): string {
  return encodeURIComponent(String(raw || '').trim()).replace(/%/g, '_');
}

export function dedupePortions<T extends PortionLike>(
  portions?: T[] | null,
): PortionLike[] {
  if (!Array.isArray(portions) || portions.length === 0) return [];
  const map = new Map<string, PortionLike>();
  for (const p of portions) {
    const cleanName = String(p?.name || '').trim();
    const numPrice = Number(p?.price);
    if (!cleanName || Number.isNaN(numPrice)) continue;
    const key = normalizeName(cleanName);
    if (!key) continue;
    map.set(key, { name: cleanName, price: numPrice });
  }
  return Array.from(map.values());
}

export function buildPortionDocId(
  restaurantId: string,
  menuItemId: string,
  portionName: string,
): string {
  return `${safeDocKey(restaurantId)}_${safeDocKey(menuItemId)}_${safeDocKey(normalizeName(portionName))}`;
}

export function planPortionSync(params: {
  restaurantId: string;
  menuItemId: string;
  itemName: string;
  previousItemName?: string;
  previousNormalizedName?: string;
  legacyItemId?: string;
  nextPortions: PortionLike[];
  existingPortionDocs: StoredPortionRecord[];
}): {
  toDeleteIds: string[];
  toUpsert: PortionUpsertRecord[];
} {
  const {
    restaurantId,
    menuItemId,
    itemName,
    previousItemName,
    previousNormalizedName,
    legacyItemId,
    nextPortions,
    existingPortionDocs,
  } = params;

  const cleanPortions = dedupePortions(nextPortions);
  const newNorm = normalizeName(itemName);
  const newBase = normalizeName(getBaseItemName(itemName));
  const oldNorm = previousNormalizedName || normalizeName(previousItemName || '');
  const oldBase = normalizeName(getBaseItemName(previousItemName || ''));

  const targetNorms = new Set([newNorm, oldNorm].filter(Boolean));
  const targetBases = new Set([newBase, oldBase].filter(Boolean));

  const toUpsert: PortionUpsertRecord[] = cleanPortions.map((p, idx) => ({
    docId: buildPortionDocId(restaurantId, menuItemId, p.name),
    restaurantId,
    menuItemId,
    menuItemName: itemName,
    normalizedName: newNorm,
    portionName: p.name,
    price: p.price,
    sortOrder: idx,
  }));

  const keepDocIds = new Set(toUpsert.map((u) => u.docId));
  const toDeleteIds: string[] = [];

  for (const doc of existingPortionDocs) {
    if (doc.restaurantId !== restaurantId) continue;

    const docNorm = doc.normalizedName || normalizeName(doc.menuItemName || '');
    const docBase = normalizeName(getBaseItemName(doc.menuItemName || docNorm));

    const matchesItem =
      (doc.menuItemId && doc.menuItemId === menuItemId) ||
      (docNorm && targetNorms.has(docNorm)) ||
      (legacyItemId && doc.legacyItemId && String(doc.legacyItemId) === String(legacyItemId)) ||
      (!doc.menuItemId && docBase && targetBases.has(docBase));

    if (matchesItem && !keepDocIds.has(doc.id)) {
      toDeleteIds.push(doc.id);
    }
  }

  return { toDeleteIds, toUpsert };
}

export function planDuplicatePortionsCleanup(params: {
  survivingItems: Array<{
    id: string;
    restaurantId: string;
    itemName: string;
    normalizedName?: string;
    legacyItemId?: string;
    isActive?: boolean;
  }>;
  deletedMenuItemIds: Set<string>;
  portionDocs: StoredPortionRecord[];
}): { toDeleteIds: string[] } {
  const { survivingItems, deletedMenuItemIds, portionDocs } = params;

  const itemById = new Map<string, (typeof survivingItems)[number]>();
  const itemByNorm = new Map<string, (typeof survivingItems)[number]>();
  const itemByBase = new Map<string, (typeof survivingItems)[number]>();
  const itemByLegacy = new Map<string, (typeof survivingItems)[number]>();

  for (const it of survivingItems) {
    itemById.set(`${it.restaurantId}_${it.id}`, it);
    const norm = it.normalizedName || normalizeName(it.itemName);
    if (norm && !itemByNorm.has(`${it.restaurantId}_${norm}`)) {
      itemByNorm.set(`${it.restaurantId}_${norm}`, it);
    }
    const base = normalizeName(getBaseItemName(it.itemName));
    if (base && !itemByBase.has(`${it.restaurantId}_${base}`)) {
      itemByBase.set(`${it.restaurantId}_${base}`, it);
    }
    if (it.legacyItemId && !itemByLegacy.has(`${it.restaurantId}_${it.legacyItemId}`)) {
      itemByLegacy.set(`${it.restaurantId}_${it.legacyItemId}`, it);
    }
  }

  const toDelete = new Set<string>();
  const grouped = new Map<string, StoredPortionRecord[]>();

  for (const pDoc of portionDocs) {
    const pName = normalizeName(pDoc.portionName || '');
    if (!pName) {
      toDelete.add(pDoc.id);
      continue;
    }

    if (pDoc.menuItemId && deletedMenuItemIds.has(pDoc.menuItemId)) {
      toDelete.add(pDoc.id);
      continue;
    }

    const norm = pDoc.normalizedName || normalizeName(pDoc.menuItemName || '');
    const base = normalizeName(getBaseItemName(pDoc.menuItemName || norm));

    const owner =
      (pDoc.menuItemId ? itemById.get(`${pDoc.restaurantId}_${pDoc.menuItemId}`) : undefined) ||
      (norm ? itemByNorm.get(`${pDoc.restaurantId}_${norm}`) : undefined) ||
      (pDoc.legacyItemId ? itemByLegacy.get(`${pDoc.restaurantId}_${pDoc.legacyItemId}`) : undefined) ||
      (base ? itemByBase.get(`${pDoc.restaurantId}_${base}`) : undefined);

    if (!owner) {
      toDelete.add(pDoc.id);
      continue;
    }

    const groupKey = `${owner.restaurantId}_${owner.id}_${pName}`;
    const list = grouped.get(groupKey) || [];
    list.push(pDoc);
    grouped.set(groupKey, list);
  }

  for (const [groupKey, docs] of grouped.entries()) {
    if (docs.length <= 1) continue;
    docs.sort((a, b) => {
      const aDet = a.id.includes(groupKey) ? 1 : 0;
      const bDet = b.id.includes(groupKey) ? 1 : 0;
      if (aDet !== bDet) return bDet - aDet;
      const aHasId = a.menuItemId ? 1 : 0;
      const bHasId = b.menuItemId ? 1 : 0;
      if (aHasId !== bHasId) return bHasId - aHasId;
      const aHasNorm = a.normalizedName ? 1 : 0;
      const bHasNorm = b.normalizedName ? 1 : 0;
      if (aHasNorm !== bHasNorm) return bHasNorm - aHasNorm;
      return b.id.localeCompare(a.id);
    });
    for (let i = 1; i < docs.length; i++) {
      toDelete.add(docs[i].id);
    }
  }

  return { toDeleteIds: Array.from(toDelete) };
}
