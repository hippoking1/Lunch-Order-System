import * as admin from 'firebase-admin';
import { normalizeName } from './shared/normalize';

const db = admin.firestore();

export interface MigrationPayload {
  Users?: any[];
  Restaurants?: any[];
  MenuItems?: any[];
  ItemPortions?: any[];
  Orders?: any[];
  Confirmations?: any[];
  SpecialPrices?: any[];
  CategoryLocks?: any[];
  Settings?: any[];
}

export async function importFromSheetsData(data: MigrationPayload) {
  const stats = {
    users: 0,
    restaurants: 0,
    menuItems: 0,
    itemPortions: 0,
    orders: 0,
    confirmations: 0,
    specialPrices: 0,
    categoryLocks: 0,
    settings: 0,
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
  }

  // 5. Orders (歷史訂單)
  if (Array.isArray(data.Orders)) {
    // 每次最多 500 筆寫入 batch
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
  }

  return { success: true, stats };
}
