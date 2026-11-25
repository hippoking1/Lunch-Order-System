/**
 * 初始化 / 重建 Firestore 聚合快取腳本
 * 產出：
 * 1. catalog/menuBundle (含自動分片)
 * 2. catalog/employees
 * 3. meta/appConfig (menuVersion, employeesVersion, newItemDisplayDays)
 * 4. adminEmails/{email} (供 firestore.rules isAdmin() 驗證使用)
 *
 * 使用方式：node scripts/build-catalog-cache.mjs
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const CHUNK_BYTE_LIMIT = 700_000;

function normalizeName(name) {
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

function dedupePortions(portions) {
  if (!Array.isArray(portions) || portions.length === 0) return [];
  const sorted = [...portions].sort(
    (a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999),
  );
  const map = new Map();
  for (const p of sorted) {
    const cleanName = String(p?.name || '').trim();
    const numPrice = Number(p?.price);
    if (!cleanName || Number.isNaN(numPrice)) continue;
    const key = normalizeName(cleanName);
    if (!key) continue;
    map.set(key, { name: cleanName, price: numPrice });
  }
  return Array.from(map.values());
}

function toCompactItems(items) {
  return items.map((it) => {
    const c = {
      i: it.id,
      r: it.restaurantId,
      n: it.name,
      p: it.price,
      c: it.category,
    };
    if (it.subCategory) c.sc = it.subCategory;
    if (it.image) c.img = it.image;
    if (it.flavors) c.fl = it.flavors;
    if (it.portions && it.portions.length > 0) c.po = it.portions;
    if (it.limitedType) c.lt = it.limitedType;
    if (it.startDate) c.sd = it.startDate;
    if (it.endDate) c.ed = it.endDate;
    if (it.createdAt) c.ca = it.createdAt;
    return c;
  });
}

async function getClient() {
  const serviceAccountPath = path.resolve('serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    const admin = require(
      path.resolve('firebase/functions/node_modules/firebase-admin'),
    );
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, 'utf8'),
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    const db = admin.firestore();
    return {
      mode: 'admin',
      async getAll(col) {
        const snap = await db.collection(col).get();
        return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
      },
      async setDoc(col, id, payload, merge = false) {
        await db.collection(col).doc(id).set(payload, { merge });
      },
    };
  }

  const envPath = path.resolve('frontend/.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('找不到 serviceAccountKey.json 或 frontend/.env');
  }
  const env = Object.fromEntries(
    fs
      .readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const idx = l.indexOf('=');
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
      }),
  );

  const { initializeApp } = await import('../frontend/node_modules/firebase/app/dist/index.mjs');
  const {
    getFirestore,
    collection,
    getDocs,
    doc,
    setDoc: fsSetDoc,
  } = await import('../frontend/node_modules/firebase/firestore/dist/index.mjs');

  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  const db = getFirestore(app);

  return {
    mode: 'client',
    async getAll(col) {
      const snap = await getDocs(collection(db, col));
      return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    },
    async setDoc(col, id, payload, merge = false) {
      await fsSetDoc(doc(db, col, id), payload, { merge });
    },
  };
}

async function main() {
  const client = await getClient();
  console.log(`🔧 使用 ${client.mode} 模式讀取 Firestore 資料...`);

  const [restDocs, portionDocs, menuDocs, spDocs, userDocs, settingDocs] =
    await Promise.all([
      client.getAll('restaurants'),
      client.getAll('itemPortions'),
      client.getAll('menuItems'),
      client.getAll('specialPrices'),
      client.getAll('users'),
      client.getAll('settings'),
    ]);

  const restCatMap = {};
  const allRestaurants = restDocs.map(({ id, data: dat }) => {
    const cat = dat.category || '正餐';
    restCatMap[id] = cat;
    return {
      id,
      name: dat.name || '',
      category: cat,
      telephone: dat.telephone || '',
      isActive: dat.isActive !== false,
      sweetnessOptions: dat.sweetnessOptions || null,
      iceOptions: dat.iceOptions || null,
      createdAt: dat.createdAt || '',
    };
  });

  const portionsById = {};
  const portionsByNorm = {};
  const portionsByLegacy = {};
  for (const { data: d } of portionDocs) {
    const pObj = {
      name: d.portionName || '',
      price: Number(d.price || 0),
      sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 9999,
    };
    if (!pObj.name) continue;
    if (d.menuItemId) {
      (portionsById[`${d.restaurantId}_${d.menuItemId}`] ||= []).push(pObj);
    }
    const norm = d.normalizedName || normalizeName(d.menuItemName || '');
    if (norm) {
      (portionsByNorm[`${d.restaurantId}_${norm}`] ||= []).push(pObj);
    }
    if (d.legacyItemId) {
      (portionsByLegacy[`${d.restaurantId}_${d.legacyItemId}`] ||= []).push(
        pObj,
      );
    }
  }

  const items = [];
  const extras = [];
  for (const { id, data: d } of menuDocs) {
    if (d.isActive === false) continue;
    const norm = d.normalizedName || normalizeName(d.itemName || '');
    const matchedPortions = dedupePortions(
      portionsById[`${d.restaurantId}_${id}`] ||
        portionsByNorm[`${d.restaurantId}_${norm}`] ||
        (d.legacyItemId
          ? portionsByLegacy[`${d.restaurantId}_${d.legacyItemId}`]
          : undefined) ||
        [],
    );

    if (!d.isExtra) {
      const restCat = restCatMap[d.restaurantId] || '正餐';
      const subCat = (d.subCategory || '').trim();
      let itemCat = (d.category || '').trim() || restCat;
      if (
        restCat !== '飲料' &&
        itemCat === '飲料' &&
        subCat &&
        !/^(飲料|飲品)$/.test(subCat)
      ) {
        itemCat = restCat;
      }
      items.push({
        id,
        restaurantId: d.restaurantId,
        name: d.itemName,
        price: Number(d.price || 0),
        category: itemCat,
        image: d.image || '',
        subCategory: subCat,
        flavors: d.flavors || '',
        portions: matchedPortions,
        limitedType: d.limitedType || '',
        startDate: d.startDate || '',
        endDate: d.endDate || '',
        createdAt: d.createdAt || '',
      });
    } else {
      const type = d.extraType === 'single' ? 'single' : 'extra';
      extras.push({
        id,
        restaurantId: d.restaurantId,
        name: d.itemName,
        price: Number(d.price || 0),
        type,
        group: d.extraGroup || (type === 'single' ? '套餐' : '加點'),
      });
    }
  }

  const specialPrices = spDocs
    .filter(({ data: d }) => d.isActive !== false)
    .map(({ id, data: d }) => ({
      id,
      restaurantId: d.restaurantId || '',
      itemId: d.menuItemId || d.itemId || '',
      itemName: d.itemName || '',
      portionName: d.portionName || '',
      originalPrice: Number(d.originalPrice || 0),
      specialPrice: Number(d.specialPrice || 0),
      startDate: d.startDate || '',
      endDate: d.endDate || '',
      label: d.label || '',
      isActive: true,
    }));

  const newDaysDoc = settingDocs.find((d) => d.id === 'NewItemDisplayDays');
  const newItemDisplayDays = newDaysDoc
    ? Number(newDaysDoc.data?.value) || 7
    : 7;
  const balanceEnabledDoc = settingDocs.find((d) => d.id === 'BalanceEnabled');
  const balanceEnabled = balanceEnabledDoc
    ? Boolean(balanceEnabledDoc.data?.value)
    : false;

  const names = userDocs
    .map((d) => d.id)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'zh-Hant'));

  const version = Date.now();
  const now = new Date().toISOString();

  const bundle = {
    version,
    newItemDisplayDays,
    balanceEnabled,
    allRestaurants,
    items: toCompactItems(items),
    extras,
    specialPrices,
    updatedAt: now,
  };

  const jsonStr = JSON.stringify(bundle);
  const byteLen = Buffer.byteLength(jsonStr, 'utf8');
  console.log(
    `📦 菜單聚合大小: ${(byteLen / 1024).toFixed(1)} KB (餐廳 ${allRestaurants.length}, 品項 ${items.length}, 加點 ${extras.length}, 員工 ${names.length})`,
  );

  if (byteLen <= CHUNK_BYTE_LIMIT) {
    await client.setDoc('catalog', 'menuBundle', {
      version,
      chunkCount: 0,
      payloadJson: jsonStr,
      updatedAt: now,
    });
  } else {
    const step = 300_000;
    const chunks = [];
    for (let i = 0; i < jsonStr.length; i += step) {
      chunks.push(jsonStr.slice(i, i + step));
    }
    for (let i = 0; i < chunks.length; i++) {
      await client.setDoc('catalog', `menuBundle_${i}`, {
        version,
        index: i,
        data: chunks[i],
      });
    }
    await client.setDoc('catalog', 'menuBundle', {
      version,
      chunkCount: chunks.length,
      updatedAt: now,
    });
  }

  await client.setDoc('catalog', 'employees', {
    version,
    names,
    updatedAt: now,
  });

  await client.setDoc('meta', 'appConfig', {
    menuVersion: version,
    employeesVersion: version,
    newItemDisplayDays,
    balanceEnabled,
    updatedAt: now,
  });

  // 同步管理員 Email 白名單 (adminEmails)
  let adminCount = 0;
  for (const { id, data } of userDocs) {
    if (data.role === 'admin' && data.email) {
      const emailKey = String(data.email).trim().toLowerCase();
      await client.setDoc('adminEmails', emailKey, {
        name: id,
        role: 'admin',
        updatedAt: now,
      });
      adminCount++;
    }
  }

  console.log(`✅ 寫入完成！menuBundle + employees + appConfig + adminEmails (${adminCount} 位管理員)`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ 執行失敗:', err);
  process.exit(1);
});
