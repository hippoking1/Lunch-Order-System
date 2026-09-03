import * as admin from 'firebase-admin';
import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';

const db = admin.firestore();

/**
 * 檢查管理員身分 (支援 Firebase Auth 驗證)
 */
export async function assertAdmin(request: CallableRequest<any>, fallbackName?: string): Promise<string> {
  // 1. 如果有 Firebase Auth 登入資訊
  if (request.auth) {
    const email = request.auth.token.email || '';
    const uid = request.auth.uid;
    
    // 檢查自訂 claims
    if (request.auth.token.admin === true) {
      return email || uid;
    }
    
    // 檢查 users 集合中是否有匹配的 admin 使用者
    if (email) {
      const snap = await db.collection('users').where('email', '==', email).limit(1).get();
      if (!snap.empty && snap.docs[0].data().role === 'admin') {
        return snap.docs[0].data().name || email;
      }
    }
    
    // 依 UID 查詢
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists && userDoc.data()?.role === 'admin') {
      return userDoc.data()?.name || email || uid;
    }
  }

  // 2. 如果沒有 Firebase Auth，檢查 fallback 傳入的員工姓名
  const name = (request.data?.adminName || fallbackName || '').trim();
  if (name) {
    const userDoc = await db.collection('users').doc(name).get();
    if (userDoc.exists && userDoc.data()?.role === 'admin') {
      return name;
    }
  }

  throw new HttpsError('permission-denied', '權限不足：需要管理員權限 (請使用 Firebase 管理員帳號登入)');
}

/**
 * 取得所有員工名單
 */
export async function getEmployeeNames(): Promise<string[]> {
  const snap = await db.collection('users').get();
  const names = snap.docs.map(doc => doc.id).filter(Boolean);
  return names.sort((a, b) => a.localeCompare(b, 'zh-Hant'));
}

/**
 * 取得特定員工餘額
 */
export async function getEmployeeBalance(name: string): Promise<number> {
  if (!name) return 0;
  const doc = await db.collection('users').doc(name).get();
  if (!doc.exists) return 0;
  return Number(doc.data()?.balance || 0);
}

/**
 * 執行儲值 / 扣款 (以 Transaction 保證原子性)
 */
export async function performDeposit(name: string, amount: number): Promise<number> {
  if (!name) throw new HttpsError('invalid-argument', '未指定員工姓名');
  const userRef = db.collection('users').doc(name);

  return await db.runTransaction(async (tx) => {
    const doc = await tx.get(userRef);
    const now = new Date().toISOString();
    if (doc.exists) {
      const current = Number(doc.data()?.balance || 0);
      const newBal = current + Number(amount);
      tx.update(userRef, { balance: newBal, updatedAt: now });
      return newBal;
    } else {
      const newBal = Number(amount);
      tx.set(userRef, { name, balance: newBal, role: 'user', updatedAt: now });
      return newBal;
    }
  });
}

/**
 * 查詢員工角色
 */
export async function getUserRole(name: string, authUid?: string, authEmail?: string): Promise<'admin' | 'user'> {
  if (authEmail) {
    const snap = await db.collection('users').where('email', '==', authEmail).limit(1).get();
    if (!snap.empty && snap.docs[0].data().role === 'admin') return 'admin';
  }
  if (!name) return 'user';
  const doc = await db.collection('users').doc(name).get();
  if (doc.exists && doc.data()?.role === 'admin') return 'admin';
  return 'user';
}
