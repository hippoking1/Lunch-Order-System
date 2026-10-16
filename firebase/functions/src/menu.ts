import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { normalizeName, getBaseItemName } from './shared/normalize';
import { MenuItemDoc, Portion, SpecialPriceDoc } from './shared/types';

const db = admin.firestore();

export async function getFullMenuPayloadInternal() {
  const today = new Date().toISOString().split('T')[0];

  const restSnap = await db.collection('restaurants').where('isActive', '==', true).get();
  const restaurants = restSnap.docs.map(d => ({
    id: d.id,
    name: d.data().name || '',
    category: d.data().category || '',
    createdAt: d.data().createdAt || '',
    sweetnessOptions: d.data().sweetnessOptions || null,
    iceOptions: d.data().iceOptions || null,
  }));

  const portionSnap = await db.collection('itemPortions').get();
  const portionsMap: Record<string, Portion[]> = {};
  portionSnap.docs.forEach(doc => {
    const d = doc.data();
    const key = `${d.restaurantId}_${d.normalizedName || normalizeName(d.menuItemName)}`;
    if (!portionsMap[key]) portionsMap[key] = [];
    portionsMap[key].push({
      name: d.portionName || '',
      price: Number(d.price || 0)
    });
  });

  const menuSnap = await db.collection('menuItems').where('isActive', '==', true).get();
  const items: any[] = [];
  const extras: any[] = [];

  menuSnap.docs.forEach(doc => {
    const d = doc.data() as MenuItemDoc;
    if (d.limitedType) {
      if (d.startDate && today < d.startDate) return;
      if (d.endDate && today > d.endDate) return;
    }

    const normKey = `${d.restaurantId}_${d.normalizedName || normalizeName(d.itemName)}`;
    const itemPortions = portionsMap[normKey] || [];

    if (!d.isExtra) {
      items.push({
        id: doc.id,
        restaurantId: d.restaurantId,
        name: d.itemName,
        price: Number(d.price || 0),
        category: d.category || '',
        image: d.image || '',
        subCategory: d.subCategory || '',
        flavors: d.flavors || '',
        portions: itemPortions,
        limitedType: d.limitedType || '',
        startDate: d.startDate || '',
        endDate: d.endDate || '',
        createdAt: d.createdAt || ''
      });
    } else {
      const type = (d.extraType === 'single') ? 'single' : 'extra';
      extras.push({
        id: doc.id,
        restaurantId: d.restaurantId,
        name: d.itemName,
        price: Number(d.price || 0),
        type,
        group: d.extraGroup || (type === 'single' ? '套餐' : '加點')
      });
    }
  });

  const specialPrices = await getActiveSpecialPricesInternal();

  let newItemDisplayDays = 7;
  const setDoc = await db.collection('settings').doc('NewItemDisplayDays').get();
  if (setDoc.exists) {
    newItemDisplayDays = Number(setDoc.data()?.value) || 7;
  }

  return {
    restaurants,
    items,
    extras,
    specialPrices,
    newItemDisplayDays
  };
}

export async function getActiveSpecialPricesInternal(): Promise<SpecialPriceDoc[]> {
  const today = new Date().toISOString().split('T')[0];
  const snap = await db.collection('specialPrices').where('isActive', '==', true).get();
  const list: SpecialPriceDoc[] = [];

  snap.docs.forEach(doc => {
    const d = doc.data();
    if (d.startDate && today < d.startDate) return;
    if (d.endDate && today > d.endDate) return;

    list.push({
      id: doc.id,
      restaurantId: d.restaurantId || '',
      menuItemId: d.menuItemId || '',
      itemName: d.itemName || '',
      portionName: d.portionName || '',
      originalPrice: Number(d.originalPrice || 0),
      specialPrice: Number(d.specialPrice || 0),
      startDate: d.startDate || '',
      endDate: d.endDate || '',
      label: d.label || '',
      isActive: true
    });
  });

  return list;
}

export async function findMenuItemByName(restaurantId: string, itemName: string) {
  const normalized = normalizeName(itemName);
  // 1. 完全一致的正規化名稱比對
  const snap = await db.collection('menuItems')
    .where('restaurantId', '==', restaurantId)
    .where('normalizedName', '==', normalized)
    .limit(1)
    .get();

  if (!snap.empty) return snap.docs[0];

  // 2. 核心名稱比對：品名後 () 內如有不同，視為同一品項
  const targetBase = normalizeName(getBaseItemName(itemName));
  if (!targetBase) return null;

  const allItemsSnap = await db.collection('menuItems')
    .where('restaurantId', '==', restaurantId)
    .where('isActive', '==', true)
    .get();

  for (const doc of allItemsSnap.docs) {
    const existingName = doc.data().itemName || '';
    const existingBase = normalizeName(getBaseItemName(existingName));
    if (existingBase === targetBase) {
      return doc;
    }
  }

  return null;
}

export async function addOrUpdateMenuItemInternal(data: any) {
  let docId = data.itemId ? String(data.itemId).trim() : '';
  let existingDoc: admin.firestore.DocumentSnapshot | null = null;
  if (docId) {
    const byId = await db.collection('menuItems').doc(docId).get();
    if (byId.exists) {
      existingDoc = byId;
    }
  }

  const restaurantId = String(data.restaurantId || existingDoc?.data()?.restaurantId || '').trim();
  const itemName = String(data.itemName || existingDoc?.data()?.itemName || '').trim();
  if (!restaurantId || !itemName) throw new HttpsError('invalid-argument', '缺少餐廳或品項名稱');

  const normalized = normalizeName(itemName);
  if (!existingDoc) {
    existingDoc = await findMenuItemByName(restaurantId, itemName);
  }

  const payload: Partial<MenuItemDoc> = {
    restaurantId,
    itemName,
    normalizedName: normalized,
    price: Number(data.price || 0),
    category: data.category || '',
    subCategory: data.subCategory || '',
    image: data.image || '',
    flavors: data.flavors || '',
    isExtra: Boolean(data.isExtra),
    extraGroup: data.extraGroup || '',
    extraType: data.extraType || 'extra',
    isActive: true,
    limitedType: data.limitedType || '',
    startDate: data.startDate || '',
    endDate: data.endDate || '',
  };

  if (existingDoc) {
    docId = existingDoc.id;
    await existingDoc.ref.update(payload);
  } else {
    payload.createdAt = new Date().toISOString();
    payload.legacyItemId = data.itemId || '';
    const newDoc = await db.collection('menuItems').add(payload);
    docId = newDoc.id;
  }

  if (Array.isArray(data.portions)) {
    const pSnap = await db.collection('itemPortions')
      .where('restaurantId', '==', restaurantId)
      .where('normalizedName', '==', normalized)
      .get();
    const batch = db.batch();
    pSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    const addBatch = db.batch();
    for (const p of data.portions) {
      const pRef = db.collection('itemPortions').doc();
      addBatch.set(pRef, {
        restaurantId,
        menuItemId: docId,
        menuItemName: itemName,
        normalizedName: normalized,
        portionName: p.name,
        price: Number(p.price || 0)
      });
    }
    await addBatch.commit();
  }

  return { success: true, itemId: docId };
}

export async function deactivateMenuItemInternal(restaurantId: string | undefined, itemIdOrName: string) {
  let docRef: admin.firestore.DocumentReference | null = null;
  const byId = await db.collection('menuItems').doc(itemIdOrName).get();
  if (byId.exists && (!restaurantId || byId.data()?.restaurantId === restaurantId)) {
    docRef = byId.ref;
  } else if (restaurantId) {
    const existing = await findMenuItemByName(restaurantId, itemIdOrName);
    if (existing) docRef = existing.ref;
  }

  if (!docRef) throw new HttpsError('not-found', '找不到該品項');
  await docRef.update({ isActive: false });
  return { success: true };
}

export async function reactivateMenuItemInternal(restaurantId: string | undefined, itemIdOrName: string) {
  let docRef: admin.firestore.DocumentReference | null = null;
  const byId = await db.collection('menuItems').doc(itemIdOrName).get();
  if (byId.exists && (!restaurantId || byId.data()?.restaurantId === restaurantId)) {
    docRef = byId.ref;
  } else if (restaurantId) {
    const existing = await findMenuItemByName(restaurantId, itemIdOrName);
    if (existing) docRef = existing.ref;
  }

  if (!docRef) throw new HttpsError('not-found', '找不到該品項');
  await docRef.update({ isActive: true });
  return { success: true };
}

export async function applyMenuChangesInternal(restaurantId: string, changes: any[]) {
  if (!Array.isArray(changes) || changes.length === 0) return { success: true, applied: 0 };

  let applied = 0;
  for (const change of changes) {
    const targetRestId = change.restaurantId || restaurantId;
    const itemName = String(change.itemName || change.name || '').trim();
    if (!itemName) continue;

    // 1. 若前端比對已直接給出明確的 itemId，先嘗試直接以 docId 取得
    let targetDoc: admin.firestore.DocumentSnapshot | null = null;
    if (change.itemId && change.itemId !== '_OTHER_') {
      const docSnap = await db.collection('menuItems').doc(change.itemId).get();
      if (docSnap.exists) {
        targetDoc = docSnap;
      }
    }

    // 2. 若無法依 ID 取得，再依餐廳與正規化名稱搜尋
    if (!targetDoc) {
      targetDoc = await findMenuItemByName(targetRestId, itemName);
    }

    if (change.type === 'remove') {
      if (targetDoc) {
        await targetDoc.ref.update({ isActive: false });
        applied++;
      }
    } else if (change.type === 'update') {
      if (targetDoc) {
        // 現有品項更新：直接 update 現有 doc，絕不新建重複文件！
        const updatePayload: any = {
          itemName,
          normalizedName: normalizeName(itemName),
          price: Number(change.price || 0),
          isActive: true
        };
        if (change.category) updatePayload.category = change.category;
        if (change.subCategory !== undefined) updatePayload.subCategory = change.subCategory;
        if (change.flavors !== undefined) updatePayload.flavors = change.flavors;
        if (change.limitedType !== undefined) updatePayload.limitedType = change.limitedType;
        await targetDoc.ref.update(updatePayload);
        applied++;
      } else {
        // 若找不到原品項，才 fallback 為新建
        await addOrUpdateMenuItemInternal({
          restaurantId: targetRestId,
          itemName,
          price: change.price,
          category: change.category || '正餐',
          subCategory: change.subCategory || '',
          flavors: change.flavors || '',
          limitedType: change.limitedType || '',
          portions: change.portions || []
        });
        applied++;
      }
    } else if (change.type === 'add') {
      // 新增品項：若核心名稱相同已存在，自動轉為更新，防止重複添加！
      if (targetDoc) {
        await targetDoc.ref.update({
          itemName,
          normalizedName: normalizeName(itemName),
          price: Number(change.price || 0),
          subCategory: change.subCategory || targetDoc.data()?.subCategory || '',
          isActive: true
        });
      } else {
        await addOrUpdateMenuItemInternal({
          restaurantId: targetRestId,
          itemName,
          price: change.price,
          category: change.category || '正餐',
          subCategory: change.subCategory || '',
          flavors: change.flavors || '',
          limitedType: change.limitedType || '',
          portions: change.portions || []
        });
      }
      applied++;
    }
  }

  return { success: true, applied };
}

// ── 清除資料庫內同餐廳重複品項 ──────────────────────────
export async function cleanupDuplicateMenuItemsInternal(restaurantId?: string) {
  let query: admin.firestore.Query = db.collection('menuItems');
  if (restaurantId && restaurantId !== '__ALL__') {
    query = query.where('restaurantId', '==', restaurantId);
  }

  const snap = await query.get();
  const map = new Map<string, admin.firestore.QueryDocumentSnapshot[]>();

  snap.docs.forEach((doc) => {
    const d = doc.data();
    // 依據去除括號後的基礎名稱進行分組，徹底合併紅心芭樂烏龍與紅心芭樂烏龍(最低微冰)等重複項目
    const baseNorm = normalizeName(getBaseItemName(d.itemName || ''));
    if (!baseNorm) return;
    const key = `${d.restaurantId}_${baseNorm}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(doc);
  });

  let deletedCount = 0;
  const toDelete: admin.firestore.DocumentReference[] = [];

  for (const [, docs] of map.entries()) {
    if (docs.length > 1) {
      // 排序：優先保留有括號詳細說明、名稱更完整、最新更新的品項
      docs.sort((a, b) => {
        const nameA = a.data().itemName || '';
        const nameB = b.data().itemName || '';
        const hasParenA = /[（(].*?[）)]/.test(nameA) ? 1 : 0;
        const hasParenB = /[（(].*?[）)]/.test(nameB) ? 1 : 0;
        if (hasParenA !== hasParenB) return hasParenB - hasParenA;
        if (nameB.length !== nameA.length) return nameB.length - nameA.length;
        const timeA = a.data().createdAt || '';
        const timeB = b.data().createdAt || '';
        return timeB.localeCompare(timeA);
      });

      // 保留 docs[0]，將其餘多餘重複項刪除
      for (let i = 1; i < docs.length; i++) {
        toDelete.push(docs[i].ref);
        deletedCount++;
      }
    }
  }

  const chunkSize = 400;
  for (let i = 0; i < toDelete.length; i += chunkSize) {
    const chunk = toDelete.slice(i, i + chunkSize);
    const batch = db.batch();
    chunk.forEach(ref => batch.delete(ref));
    await batch.commit();
  }

  return { success: true, duplicateGroups: map.size, deletedCount };
}

// ── 更新飲料餐廳自訂甜度與冰塊選項 ───────────────────────
export async function updateRestaurantCustomOptionsInternal(data: {
  restaurantId: string;
  sweetnessOptions?: string[];
  iceOptions?: string[];
}) {
  const { restaurantId, sweetnessOptions, iceOptions } = data;
  if (!restaurantId) throw new HttpsError('invalid-argument', '未指定餐廳 ID');

  const updateData: any = {};
  if (sweetnessOptions !== undefined) updateData.sweetnessOptions = sweetnessOptions;
  if (iceOptions !== undefined) updateData.iceOptions = iceOptions;

  await db.collection('restaurants').doc(restaurantId).update(updateData);
  return { success: true };
}

export async function setSpecialPriceInternal(data: any) {
  const restaurantId = String(data.restaurantId || '');
  const itemName = String(data.itemName || '');
  const portionName = String(data.portionName || '').trim();

  const snap = await db.collection('specialPrices')
    .where('restaurantId', '==', restaurantId)
    .where('itemName', '==', itemName)
    .where('portionName', '==', portionName)
    .get();

  const payload = {
    restaurantId,
    itemName,
    portionName,
    originalPrice: Number(data.originalPrice || 0),
    specialPrice: Number(data.specialPrice || 0),
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    label: data.label || '限時特價',
    isActive: true
  };

  if (!snap.empty) {
    await snap.docs[0].ref.update(payload);
  } else {
    await db.collection('specialPrices').add(payload);
  }

  return { success: true };
}

export async function removeSpecialPriceInternal(restaurantId: string, itemName: string, portionName: string) {
  const snap = await db.collection('specialPrices')
    .where('restaurantId', '==', restaurantId)
    .where('itemName', '==', itemName)
    .where('portionName', '==', (portionName || '').trim())
    .get();

  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  return { success: true };
}
