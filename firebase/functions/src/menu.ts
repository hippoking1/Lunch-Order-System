import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { normalizeName } from './shared/normalize';
import { MenuItemDoc, Portion, SpecialPriceDoc } from './shared/types';

const db = admin.firestore();

export async function getFullMenuPayloadInternal() {
  const today = new Date().toISOString().split('T')[0];

  const restSnap = await db.collection('restaurants').where('isActive', '==', true).get();
  const restaurants = restSnap.docs.map(d => ({
    id: d.id,
    name: d.data().name || '',
    category: d.data().category || '',
    createdAt: d.data().createdAt || ''
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
  const snap = await db.collection('menuItems')
    .where('restaurantId', '==', restaurantId)
    .where('normalizedName', '==', normalized)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0];
}

export async function addOrUpdateMenuItemInternal(data: any) {
  const restaurantId = String(data.restaurantId || '').trim();
  const itemName = String(data.itemName || '').trim();
  if (!restaurantId || !itemName) throw new HttpsError('invalid-argument', '缺少餐廳或品項名稱');

  const normalized = normalizeName(itemName);
  const existing = await findMenuItemByName(restaurantId, itemName);

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

  let docId = '';
  if (existing) {
    docId = existing.id;
    await existing.ref.update(payload);
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

export async function deactivateMenuItemInternal(restaurantId: string, itemIdOrName: string) {
  let docRef: admin.firestore.DocumentReference | null = null;
  const byId = await db.collection('menuItems').doc(itemIdOrName).get();
  if (byId.exists && byId.data()?.restaurantId === restaurantId) {
    docRef = byId.ref;
  } else {
    const existing = await findMenuItemByName(restaurantId, itemIdOrName);
    if (existing) docRef = existing.ref;
  }

  if (!docRef) throw new HttpsError('not-found', '找不到該品項');
  await docRef.update({ isActive: false });
  return { success: true };
}

export async function reactivateMenuItemInternal(restaurantId: string, itemIdOrName: string) {
  let docRef: admin.firestore.DocumentReference | null = null;
  const byId = await db.collection('menuItems').doc(itemIdOrName).get();
  if (byId.exists && byId.data()?.restaurantId === restaurantId) {
    docRef = byId.ref;
  } else {
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

    const existing = await findMenuItemByName(targetRestId, itemName);

    if (change.type === 'remove') {
      if (existing) {
        await existing.ref.update({ isActive: false });
        applied++;
      }
    } else if (change.type === 'add' || change.type === 'update') {
      await addOrUpdateMenuItemInternal({
        restaurantId: targetRestId,
        itemName,
        price: change.price,
        category: change.category || existing?.data()?.category || '正餐',
        subCategory: change.subCategory || existing?.data()?.subCategory || '',
        flavors: change.flavors || existing?.data()?.flavors || '',
        limitedType: change.limitedType || existing?.data()?.limitedType || '',
        portions: change.portions || []
      });
      applied++;
    }
  }

  return { success: true, applied };
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
