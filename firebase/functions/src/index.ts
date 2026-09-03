import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

admin.initializeApp();
const db = admin.firestore();

import {
  assertAdmin,
  getEmployeeNames,
  getEmployeeBalance,
  performDeposit,
  getUserRole
} from './users';

import {
  submitOrderInternal,
  deleteOrderInternal,
  saveEmployeePaymentInternal,
  getOrderSummaryInternal,
  updateOrderNoteInternal,
  getFrequentOrdersInternal
} from './orders';

import {
  getFullMenuPayloadInternal,
  getActiveSpecialPricesInternal,
  addOrUpdateMenuItemInternal,
  deactivateMenuItemInternal,
  reactivateMenuItemInternal,
  applyMenuChangesInternal,
  setSpecialPriceInternal,
  removeSpecialPriceInternal
} from './menu';

import {
  getCategoryLocksInternal,
  lockCategoryRestaurantInternal,
  unlockCategoryInternal,
  getConfirmationsInternal,
  confirmRestaurantOrderInternal,
  cancelRestaurantConfirmationInternal,
  getAllRestaurantTelephonesInternal
} from './locks';

import {
  expireSpecialPricesTask,
  expireLimitedItemsTask
} from './scheduled';

import { importFromSheetsData } from './migration';

// ── 點餐核心 Callable Functions ─────────────────────

export const getInitialData = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  const dateStr = request.data?.dateStr || new Date().toISOString().split('T')[0];

  const [
    telephones,
    employees,
    summary,
    menuPayload,
    confirmations,
    locks
  ] = await Promise.all([
    getAllRestaurantTelephonesInternal(),
    getEmployeeNames(),
    getOrderSummaryInternal(dateStr),
    getFullMenuPayloadInternal(),
    getConfirmationsInternal(dateStr),
    getCategoryLocksInternal(dateStr)
  ]);

  return {
    date: dateStr,
    telephones,
    employees,
    summary,
    menuPayload,
    confirmations,
    locks
  };
});

export const getEmployeeBalanceCallable = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  const name = request.data?.name || '';
  return await getEmployeeBalance(name);
});

export const submitOrder = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  return await submitOrderInternal(request.data);
});

export const saveEmployeePayment = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  await saveEmployeePaymentInternal(request.data);
  return { success: true };
});

export const confirmRestaurantOrder = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  const { date, restId, byName } = request.data;
  return await confirmRestaurantOrderInternal(date, restId, byName);
});

export const cancelRestaurantConfirmation = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  const { date, restId } = request.data;
  return await cancelRestaurantConfirmationInternal(date, restId);
});

export const deleteOrder = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  const { orderId } = request.data;
  return await deleteOrderInternal(orderId);
});

export const performDepositCallable = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  const { name, amount } = request.data;
  return await performDeposit(name, Number(amount));
});

export const updateOrderNote = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  const { orderId, newNote } = request.data;
  return await updateOrderNoteInternal(orderId, newNote);
});

export const getUserRoleCallable = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  const name = request.data?.name || '';
  const authUid = request.auth?.uid;
  const authEmail = request.auth?.token?.email;
  return await getUserRole(name, authUid, authEmail);
});

export const getFrequentOrders = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  const { employeeName, restaurantId } = request.data;
  return await getFrequentOrdersInternal(employeeName, restaurantId);
});

export const lockCategoryRestaurant = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  const { date, category, restaurantId, lockedBy } = request.data;
  await lockCategoryRestaurantInternal(date, category, restaurantId, lockedBy);
  const locks = await getCategoryLocksInternal(date);
  return { locks };
});

export const unlockCategory = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  const { date, category } = request.data;
  await unlockCategoryInternal(date, category);
  const locks = await getCategoryLocksInternal(date);
  return { locks };
});

// ── 後台管理 Callable Functions (強制管理員檢查) ────

export const getAdminData = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  await assertAdmin(request);
  const menuPayload = await getFullMenuPayloadInternal();
  const specialPrices = await getActiveSpecialPricesInternal();
  return { menuPayload, specialPrices };
});

export const addRestaurant = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  await assertAdmin(request);
  const data = request.data;
  const restId = 'REST_' + Date.now();
  await db.collection('restaurants').doc(restId).set({
    name: data.name || '',
    category: data.category || '正餐',
    telephone: data.telephone || '',
    isActive: true,
    createdAt: new Date().toISOString()
  });
  return { success: true, restaurantId: restId };
});

export const addMenuItem = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  await assertAdmin(request);
  return await addOrUpdateMenuItemInternal(request.data);
});

export const updateMenuItem = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  await assertAdmin(request);
  return await addOrUpdateMenuItemInternal(request.data);
});

export const deactivateMenuItem = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  await assertAdmin(request);
  const { restaurantId, itemId } = request.data;
  return await deactivateMenuItemInternal(restaurantId, itemId);
});

export const reactivateMenuItem = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  await assertAdmin(request);
  const { restaurantId, itemId } = request.data;
  return await reactivateMenuItemInternal(restaurantId, itemId);
});

export const applyMenuChanges = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  await assertAdmin(request);
  const { restaurantId, changes } = request.data;
  return await applyMenuChangesInternal(restaurantId, changes);
});

export const setSpecialPrice = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  await assertAdmin(request);
  return await setSpecialPriceInternal(request.data);
});

export const removeSpecialPrice = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  await assertAdmin(request);
  const { restaurantId, itemId, portionName } = request.data;
  return await removeSpecialPriceInternal(restaurantId, itemId, portionName);
});

export const updateNewItemDisplayDays = onCall({ region: 'asia-east1', cors: true }, async (request) => {
  await assertAdmin(request);
  const days = Number(request.data?.days) || 7;
  await db.collection('settings').doc('NewItemDisplayDays').set({ value: days });
  return { success: true };
});

// ── 資料搬遷 Callable Functions ─────────────────────

export const migrateFromSheets = onCall({ region: 'asia-east1', timeoutSeconds: 300, cors: true }, async (request) => {
  await assertAdmin(request);
  return await importFromSheetsData(request.data);
});

// ── Cloud Scheduler 定時排程 ────────────────────────

export const scheduledExpireSpecialPrices = onSchedule({
  schedule: '0 0 * * *',
  timeZone: 'Asia/Taipei',
  region: 'asia-east1'
}, async () => {
  await expireSpecialPricesTask();
});

export const scheduledExpireLimitedItems = onSchedule({
  schedule: '0 0 * * *',
  timeZone: 'Asia/Taipei',
  region: 'asia-east1'
}, async () => {
  await expireLimitedItemsTask();
});
