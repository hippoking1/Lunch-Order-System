/**
 * 本地匯入腳本
 * 使用方法：
 * 1. 在 Firebase Console 下載 Service Account 金鑰，存為 serviceAccountKey.json 放於專案根目錄
 * 2. 將從 Google Drive 下載的 lunch-order-export.json 放於專案根目錄
 * 3. 執行 node scripts/import-local.mjs
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// 優先嘗試從根目錄或 functions/node_modules 載入 firebase-admin
let admin;
try {
  admin = require('firebase-admin');
} catch {
  try {
    const functionsAdminPath = path.resolve('firebase/functions/node_modules/firebase-admin');
    admin = require(functionsAdminPath);
  } catch {
    console.error('找不到 firebase-admin 套件，請先在專案根目錄執行 npm install firebase-admin 或進入 firebase/functions 安裝');
    process.exit(1);
  }
}

const serviceAccountPath = path.resolve('serviceAccountKey.json');
const dataPath = path.resolve('lunch-order-export.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ 找不到金鑰檔：請先將 Firebase Service Account 金鑰命名為 serviceAccountKey.json 放於專案根目錄！');
  process.exit(1);
}

if (!fs.existsSync(dataPath)) {
  console.error('❌ 找不到資料檔：請先將從 Google Drive 下載的 lunch-order-export.json 放於專案根目錄！');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

function normalizeName(name) {
  if (!name) return '';
  return name
    .replace(/\s+/g, '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 65248))
    .toLowerCase();
}

async function run() {
  console.log('🚀 開始搬遷資料至 Firestore...');
  const stats = {
    users: 0,
    restaurants: 0,
    menuItems: 0,
    itemPortions: 0,
    orders: 0,
    confirmations: 0,
    specialPrices: 0,
    settings: 0
  };

  // 1. Users
  if (Array.isArray(data.Users)) {
    const batch = db.batch();
    for (const u of data.Users) {
      const name = String(u.EmployeeName || u.Name || u['姓名'] || u[0] || '').trim();
      if (!name) continue;
      const balance = Number(u.Balance || u['餘額'] || u[1] || 0);
      const role = String(u.Role || u['角色'] || u[2] || 'user').trim().toLowerCase() === 'admin' ? 'admin' : 'user';
      batch.set(db.collection('users').doc(name), {
        name,
        balance,
        role,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      stats.users++;
    }
    await batch.commit();
    console.log('✅ 匯入 Users: ' + stats.users + ' 筆');
  }

  // 2. Restaurants
  if (Array.isArray(data.Restaurants)) {
    const batch = db.batch();
    for (const r of data.Restaurants) {
      const id = String(r.RestaurantID || r.id || '').trim();
      if (!id) continue;
      batch.set(db.collection('restaurants').doc(id), {
        name: String(r.Name || '').trim(),
        category: String(r.Category || '正餐').trim(),
        telephone: String(r.Telephone || '').trim(),
        isActive: r.IsActive === true || String(r.IsActive).toLowerCase() === 'true' || r.IsActive === 1 || r.IsActive === '1',
        createdAt: r.CreatedAt ? String(r.CreatedAt) : new Date().toISOString()
      }, { merge: true });
      stats.restaurants++;
    }
    await batch.commit();
    console.log('✅ 匯入 Restaurants: ' + stats.restaurants + ' 筆');
  }

  // 3. MenuItems
  if (Array.isArray(data.MenuItems)) {
    const batch = db.batch();
    for (const m of data.MenuItems) {
      const rid = String(m.RestaurantID || '').trim();
      const name = String(m.ItemName || '').trim();
      if (!rid || !name) continue;

      const norm = normalizeName(name);
      const docRef = db.collection('menuItems').doc();
      batch.set(docRef, {
        restaurantId: rid,
        itemName: name,
        normalizedName: norm,
        price: Number(m.Price || 0),
        category: String(m.Category || '').trim(),
        subCategory: String(m.SubCategory || '').trim(),
        image: String(m.Image || '').trim(),
        flavors: String(m.Flavors || '').trim(),
        isExtra: m.IsExtra === true || String(m.IsExtra).toLowerCase() === 'true',
        extraGroup: String(m.ExtraGroup || '').trim(),
        extraType: String(m.ExtraType || 'extra').toLowerCase(),
        isActive: m.IsActive !== false && String(m.IsActive).toLowerCase() !== 'false',
        limitedType: String(m.LimitedType || '').trim(),
        startDate: m.StartDate ? String(m.StartDate).split('T')[0] : '',
        endDate: m.EndDate ? String(m.EndDate).split('T')[0] : '',
        createdAt: m.CreatedAt ? String(m.CreatedAt) : new Date().toISOString(),
        legacyItemId: String(m.ItemID || '')
      });
      stats.menuItems++;
    }
    await batch.commit();
    console.log('✅ 匯入 MenuItems: ' + stats.menuItems + ' 筆 (已自動建立 normalizedName 名稱比對索引)');
  }

  // 4. ItemPortions
  if (Array.isArray(data.ItemPortions)) {
    const batch = db.batch();
    for (const p of data.ItemPortions) {
      const rid = String(p.RestaurantID || '').trim();
      const pName = String(p.PortionName || '').trim();
      if (!rid || !pName) continue;
      const docRef = db.collection('itemPortions').doc();
      batch.set(docRef, {
        restaurantId: rid,
        portionName: pName,
        price: Number(p.Price || 0),
        legacyItemId: String(p.ItemID || '')
      });
      stats.itemPortions++;
    }
    await batch.commit();
    console.log('✅ 匯入 ItemPortions: ' + stats.itemPortions + ' 筆');
  }

  // 5. Orders
  if (Array.isArray(data.Orders)) {
    const chunkSize = 400;
    for (let i = 0; i < data.Orders.length; i += chunkSize) {
      const chunk = data.Orders.slice(i, i + chunkSize);
      const batch = db.batch();
      chunk.forEach((o, idx) => {
        const docRef = db.collection('orders').doc();
        const paid = o.PaidAmount !== '' && o.PaidAmount !== null ? Number(o.PaidAmount) : null;
        const change = o.ChangeAmount !== '' && o.ChangeAmount !== null ? Number(o.ChangeAmount) : null;
        const isGiven = Boolean(o.IsChangeGiven === true || String(o.IsChangeGiven).toLowerCase() === 'true');
        const isPaidBal = (paid !== null && paid > 0);

        batch.set(docRef, {
          date: String(o.Date ? String(o.Date).split('T')[0] : ''),
          employeeName: String(o.EmployeeName || '').trim(),
          restaurantId: String(o.RestaurantID || '').trim(),
          itemName: String(o.ItemName || o.CustomItemName || '未知餐點').trim(),
          unitPrice: Number(o.UnitPrice || 0),
          quantity: Number(o.Quantity || 1),
          totalPrice: Number(o.TotalPrice || 0),
          sweetness: String(o.Sweetness || '').trim(),
          ice: String(o.Ice || '').trim(),
          note: String(o.Note || '').trim(),
          paidAmount: paid,
          changeAmount: change,
          isChangeGiven: isGiven,
          isPaidByBalance: isPaidBal,
          createdAt: o.CreatedAt ? String(o.CreatedAt) : new Date().toISOString(),
          legacyItemId: String(o.ItemID || ''),
          legacyRowNumber: i + idx + 2
        });
        stats.orders++;
      });
      await batch.commit();
    }
    console.log('✅ 匯入 Orders: ' + stats.orders + ' 筆 (包含歷史找零與支付狀態)');
  }

  // 6. Confirmations
  if (Array.isArray(data.Confirmations)) {
    const batch = db.batch();
    for (const c of data.Confirmations) {
      const docRef = db.collection('confirmations').doc();
      batch.set(docRef, {
        date: String(c.Date ? String(c.Date).split('T')[0] : ''),
        restaurantId: String(c.RestaurantID || '').trim(),
        confirmedBy: String(c.ConfirmedBy || '').trim(),
        confirmedAt: c.ConfirmedAt ? String(c.ConfirmedAt) : new Date().toISOString()
      });
      stats.confirmations++;
    }
    await batch.commit();
    console.log('✅ 匯入 Confirmations: ' + stats.confirmations + ' 筆');
  }

  // 7. SpecialPrices
  if (Array.isArray(data.SpecialPrices)) {
    const batch = db.batch();
    for (const s of data.SpecialPrices) {
      const docRef = db.collection('specialPrices').doc();
      batch.set(docRef, {
        restaurantId: String(s.RestaurantID || '').trim(),
        itemName: String(s.ItemName || '').trim(),
        portionName: String(s.PortionName || '').trim(),
        originalPrice: Number(s.OriginalPrice || 0),
        specialPrice: Number(s.SpecialPrice || 0),
        startDate: s.StartDate ? String(s.StartDate).split('T')[0] : '',
        endDate: s.EndDate ? String(s.EndDate).split('T')[0] : '',
        label: String(s.Label || '').trim(),
        isActive: s.IsActive !== false && String(s.IsActive).toLowerCase() !== 'false'
      });
      stats.specialPrices++;
    }
    await batch.commit();
    console.log('✅ 匯入 SpecialPrices: ' + stats.specialPrices + ' 筆');
  }

  // 8. Settings
  if (Array.isArray(data.Settings)) {
    const batch = db.batch();
    for (const st of data.Settings) {
      const key = String(st.Key || st[0] || '').trim();
      if (!key) continue;
      const val = st.Value !== undefined ? st.Value : st[1];
      batch.set(db.collection('settings').doc(key), { value: val });
      stats.settings++;
    }
    await batch.commit();
    console.log('✅ 匯入 Settings: ' + stats.settings + ' 筆');
  }

  console.log('\n🎉 === 資料搬遷驗證成功！統計如下 ===');
  console.table(stats);
}

run().catch((err) => {
  console.error('❌ 匯入過程發生錯誤：', err);
  process.exit(1);
});
