import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * 取得當日分類鎖定
 */
export async function getCategoryLocksInternal(dateString: string) {
  const snap = await db.collection('categoryLocks').where('date', '==', dateString).get();
  const map: Record<string, any> = {};
  snap.docs.forEach(d => {
    const data = d.data();
    map[data.category] = {
      restaurantId: data.restaurantId,
      lockedBy: data.lockedBy || '',
      lockedAt: data.lockedAt || ''
    };
  });
  return map;
}

/**
 * 鎖定餐廳
 */
export async function lockCategoryRestaurantInternal(dateString: string, category: string, restaurantId: string, lockedBy: string) {
  const now = new Date().toISOString();
  const snap = await db.collection('categoryLocks')
    .where('date', '==', dateString)
    .where('category', '==', category)
    .get();

  if (!snap.empty) {
    await snap.docs[0].ref.update({
      restaurantId,
      lockedBy: lockedBy || '',
      lockedAt: now
    });
  } else {
    await db.collection('categoryLocks').add({
      date: dateString,
      category,
      restaurantId,
      lockedBy: lockedBy || '',
      lockedAt: now
    });
  }
}

/**
 * 解鎖分類
 */
export async function unlockCategoryInternal(dateString: string, category: string) {
  const snap = await db.collection('categoryLocks')
    .where('date', '==', dateString)
    .where('category', '==', category)
    .get();

  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

/**
 * 取得確認狀態
 */
export async function getConfirmationsInternal(dateString: string) {
  const snap = await db.collection('confirmations').where('date', '==', dateString).get();
  const map: Record<string, any> = {};
  snap.docs.forEach(d => {
    const data = d.data();
    map[data.restaurantId] = {
      confirmedBy: data.confirmedBy || '',
      confirmedAt: data.confirmedAt || ''
    };
  });
  return map;
}

/**
 * 確認餐廳訂單 (並自動解除該餐廳分類鎖定)
 */
export async function confirmRestaurantOrderInternal(dateString: string, restaurantId: string, byName: string) {
  const now = new Date().toISOString();
  const snap = await db.collection('confirmations')
    .where('date', '==', dateString)
    .where('restaurantId', '==', restaurantId)
    .get();

  if (!snap.empty) {
    await snap.docs[0].ref.update({
      confirmedBy: byName || '',
      confirmedAt: now
    });
  } else {
    await db.collection('confirmations').add({
      date: dateString,
      restaurantId,
      confirmedBy: byName || '',
      confirmedAt: now
    });
  }

  // 解除該餐廳所屬分類之鎖定
  const restDoc = await db.collection('restaurants').doc(restaurantId).get();
  if (restDoc.exists) {
    const cat = restDoc.data()?.category;
    if (cat) {
      await unlockCategoryInternal(dateString, cat);
    }
  }

  return { success: true, confirmedAt: now };
}

/**
 * 取消餐廳確認
 */
export async function cancelRestaurantConfirmationInternal(dateString: string, restaurantId: string) {
  const snap = await db.collection('confirmations')
    .where('date', '==', dateString)
    .where('restaurantId', '==', restaurantId)
    .get();

  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  return { success: true };
}

/**
 * 取得所有餐廳電話
 */
export async function getAllRestaurantTelephonesInternal() {
  const snap = await db.collection('restaurants').get();
  const map: Record<string, any> = {};
  snap.docs.forEach(d => {
    map[d.id] = {
      name: d.data().name || '',
      telephone: d.data().telephone || ''
    };
  });
  return map;
}
