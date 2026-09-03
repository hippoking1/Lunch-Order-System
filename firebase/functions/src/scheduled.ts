import * as admin from 'firebase-admin';

const db = admin.firestore();

export async function expireSpecialPricesTask() {
  const today = new Date().toISOString().split('T')[0];
  const snap = await db.collection('specialPrices')
    .where('isActive', '==', true)
    .get();

  const batch = db.batch();
  let count = 0;
  snap.docs.forEach(doc => {
    const d = doc.data();
    if (d.endDate && today > d.endDate) {
      batch.update(doc.ref, { isActive: false });
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
  }
  console.log(`[expireSpecialPricesTask] 自動停用 ${count} 筆過期特價`);
}

export async function expireLimitedItemsTask() {
  const today = new Date().toISOString().split('T')[0];
  const snap = await db.collection('menuItems')
    .where('isActive', '==', true)
    .get();

  const batch = db.batch();
  let count = 0;
  snap.docs.forEach(doc => {
    const d = doc.data();
    if (d.limitedType && d.endDate && today > d.endDate) {
      batch.update(doc.ref, { isActive: false });
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
  }
  console.log(`[expireLimitedItemsTask] 自動停用 ${count} 筆過期限定商品`);
}
