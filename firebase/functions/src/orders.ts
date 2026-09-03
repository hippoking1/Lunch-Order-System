import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { OrderDoc } from './shared/types';

const db = admin.firestore();

export async function submitOrderInternal(payload: any) {
  const item = (payload.items && payload.items[0]) || null;
  if (!item) throw new HttpsError('invalid-argument', '缺少訂單項目');

  const totalPrice = Number(item.totalPrice || 0);
  const employeeName = String(payload.employeeName || '').trim();
  const restaurantId = String(payload.restaurantId || '').trim();
  const useBalance = payload.useBalance === true;
  const dateStr = payload.date || new Date().toISOString().split('T')[0];
  const nowStr = new Date().toISOString();

  let isPaidByBalance = false;

  // 檢查並處理餘額扣款 (Transaction)
  if (useBalance && totalPrice > 0 && employeeName) {
    const userRef = db.collection('users').doc(employeeName);
    await db.runTransaction(async (tx) => {
      const userDoc = await tx.get(userRef);
      const currentBal = Number(userDoc.data()?.balance || 0);
      if (currentBal >= totalPrice) {
        tx.update(userRef, { balance: currentBal - totalPrice, updatedAt: nowStr });
        isPaidByBalance = true;
      } else {
        // 餘額不足：自動降級為不扣餘額 (現金支付)，絕不中斷訂單
        isPaidByBalance = false;
      }
    });
  }

  const isCustom = item.isCustom === true;
  const finalItemName = isCustom ? (item.customName || '') : (item.itemName || '');
  const finalNote = item.note || '';

  const orderData: OrderDoc = {
    date: dateStr,
    employeeName,
    restaurantId,
    itemName: finalItemName,
    category: item.category || '',
    subCategory: item.subCategory || '',
    quantity: Number(item.quantity || 1),
    unitPrice: Number(item.unitPrice || 0),
    totalPrice,
    sweetness: item.sweetness || '',
    ice: item.ice || '',
    note: finalNote,
    paidAmount: isPaidByBalance ? totalPrice : null,
    changeAmount: isPaidByBalance ? 0 : null,
    isChangeGiven: isPaidByBalance,
    isPaidByBalance,
    createdAt: nowStr,
    legacyItemId: isCustom ? '_OTHER_' : (item.itemId || '')
  };

  const docRef = await db.collection('orders').add(orderData);

  return {
    success: true,
    isPaidByBalance,
    newOrder: {
      id: docRef.id,
      ...orderData
    }
  };
}

export async function deleteOrderInternal(orderId: string) {
  if (!orderId) throw new HttpsError('invalid-argument', '未指定訂單 ID');

  const orderRef = db.collection('orders').doc(orderId);

  return await db.runTransaction(async (tx) => {
    const doc = await tx.get(orderRef);
    if (!doc.exists) throw new HttpsError('not-found', '找不到該筆訂單');

    const order = doc.data() as OrderDoc;
    const empName = order.employeeName;
    let refundMsg = '';

    // 只有餘額支付的訂單才退款至使用者帳戶餘額
    if (order.isPaidByBalance && order.totalPrice > 0 && empName) {
      const userRef = db.collection('users').doc(empName);
      const userDoc = await tx.get(userRef);
      const currentBal = Number(userDoc.data()?.balance || 0);
      const newBal = currentBal + order.totalPrice;
      tx.update(userRef, { balance: newBal, updatedAt: new Date().toISOString() });
      refundMsg = ` (已退回帳戶餘額 $${order.totalPrice})`;
    } else if (order.paidAmount && order.paidAmount > 0) {
      refundMsg = ' (注意：此為現金付款，請退還現金)';
    }

    tx.delete(orderRef);
    return { success: true, message: refundMsg };
  });
}

export async function saveEmployeePaymentInternal(data: {
  employee: string;
  paidAmount?: number;
  changeAmount?: number;
  isChangeGiven?: boolean;
  dateString: string;
}) {
  const { employee, paidAmount, changeAmount, isChangeGiven, dateString } = data;
  if (!employee || !dateString) return;

  const snap = await db.collection('orders')
    .where('date', '==', dateString)
    .where('employeeName', '==', employee)
    .get();

  const batch = db.batch();
  snap.docs.forEach((doc) => {
    const updateData: any = {};
    if (paidAmount !== undefined) updateData.paidAmount = paidAmount;
    if (changeAmount !== undefined) updateData.changeAmount = changeAmount;
    if (isChangeGiven !== undefined) updateData.isChangeGiven = isChangeGiven;
    batch.update(doc.ref, updateData);
  });

  await batch.commit();
}

export async function getOrderSummaryInternal(dateString: string) {
  const snap = await db.collection('orders')
    .where('date', '==', dateString)
    .orderBy('createdAt', 'asc')
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      rowNumber: doc.id,
      employee: d.employeeName || '',
      restaurantId: d.restaurantId || '',
      item: d.itemName || '',
      category: d.category || '其他',
      subCategory: d.subCategory || '',
      quantity: Number(d.quantity || 0),
      unitPrice: Number(d.unitPrice || 0),
      totalPrice: Number(d.totalPrice || 0),
      sweetness: d.sweetness || '',
      ice: d.ice || '',
      note: d.note || '',
      paidAmount: d.paidAmount === null ? '' : d.paidAmount,
      changeAmount: d.changeAmount === null ? '' : d.changeAmount,
      isChangeGiven: Boolean(d.isChangeGiven),
      isPaidByBalance: Boolean(d.isPaidByBalance),
      createdAt: d.createdAt || ''
    };
  });
}

export async function updateOrderNoteInternal(orderId: string, newNote: string) {
  if (!orderId) throw new HttpsError('invalid-argument', '未指定訂單 ID');
  await db.collection('orders').doc(orderId).update({ note: newNote || '' });
  return { success: true };
}

export async function getFrequentOrdersInternal(employeeName: string, restaurantId: string) {
  if (!employeeName || !restaurantId) return [];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

  const snap = await db.collection('orders')
    .where('employeeName', '==', employeeName)
    .where('restaurantId', '==', restaurantId)
    .where('date', '>=', cutoffDate)
    .get();

  const freqMap: Record<string, any> = {};

  snap.docs.forEach((doc) => {
    const d = doc.data();
    const itemName = d.itemName || '';
    if (!itemName || itemName === '自填餐點') return;

    const note = (d.note || '').trim();
    const sweetness = (d.sweetness || '').trim();
    const ice = (d.ice || '').trim();
    const unitPrice = Number(d.unitPrice || 0);

    const key = `${itemName}|${note}|${sweetness}|${ice}`;
    if (!freqMap[key]) {
      freqMap[key] = {
        itemId: d.legacyItemId || doc.id,
        itemName,
        note,
        sweetness,
        ice,
        unitPrice,
        count: 0
      };
    }
    freqMap[key].count++;
  });

  return Object.values(freqMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}
