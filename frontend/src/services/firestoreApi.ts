import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  writeBatch,
  runTransaction,
  onSnapshot,
  type Unsubscribe,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { LS_MENU_CACHE_KEY, LS_EMP_CACHE_KEY } from '../constants';
import { normalizeName, getBaseItemName } from '../utils/normalize';
import type {
  Confirmation,
  Extra,
  FrequentOrderEntry,
  LockRecord,
  MenuItem,
  MenuPayload,
  OrderPayload,
  OrderRecord,
  Portion,
  Restaurant,
  RestaurantTelephone,
  SpecialPrice,
} from '../types';

const CHUNK_BYTE_LIMIT = 700_000;

export function getTodayDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// ── Compact Serialization for Menu Bundle ─────────────

interface CompactBundle {
  version: number;
  newItemDisplayDays: number;
  allRestaurants: Restaurant[];
  items: Array<Record<string, any>>;
  extras: Extra[];
  specialPrices: SpecialPrice[];
  updatedAt: string;
}

function toCompactItems(items: MenuItem[]): Array<Record<string, any>> {
  return items.map((it) => {
    const c: Record<string, any> = {
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

function fromCompactItems(compact: Array<Record<string, any>>): MenuItem[] {
  return compact.map((c) => ({
    id: c.i,
    restaurantId: c.r,
    name: c.n,
    price: Number(c.p || 0),
    category: c.c || '正餐',
    image: c.img || '',
    subCategory: c.sc || '',
    flavors: c.fl || '',
    portions: Array.isArray(c.po) ? c.po : [],
    limitedType: c.lt || '',
    startDate: c.sd || '',
    endDate: c.ed || '',
    createdAt: c.ca || '',
  }));
}

export function hydrateTelephones(
  allRestaurants: Restaurant[],
): Record<string, RestaurantTelephone> {
  const telephones: Record<string, RestaurantTelephone> = {};
  allRestaurants.forEach((r) => {
    telephones[r.id] = {
      name: r.name || '',
      telephone: r.telephone || '',
    };
  });
  return telephones;
}

export function filterActiveMenuForDate(
  rawBundle: {
    allRestaurants: Restaurant[];
    items: MenuItem[];
    extras: Extra[];
    specialPrices: SpecialPrice[];
    newItemDisplayDays: number;
  },
  dateStr: string,
): {
  menuPayload: MenuPayload;
  allRestaurants: Restaurant[];
  telephones: Record<string, RestaurantTelephone>;
  newItemDisplayDays: number;
} {
  const restaurants = rawBundle.allRestaurants.filter(
    (r) => r.isActive !== false,
  );
  const restCatMap: Record<string, string> = {};
  restaurants.forEach((r) => {
    restCatMap[r.id] = r.category || '正餐';
  });

  const items = rawBundle.items
    .filter((d) => {
      if (d.limitedType) {
        if (d.startDate && dateStr < d.startDate) return false;
        if (d.endDate && dateStr > d.endDate) return false;
      }
      return true;
    })
    .map((item) => {
      const restCat = restCatMap[item.restaurantId] || '正餐';
      const subCat = (item.subCategory || '').trim();
      let itemCat = (item.category || '').trim() || restCat;
      if (
        restCat !== '飲料' &&
        itemCat === '飲料' &&
        subCat &&
        !/^(飲料|飲品)$/.test(subCat)
      ) {
        itemCat = restCat;
      }
      return { ...item, category: itemCat };
    });

  const specialPrices = (rawBundle.specialPrices || []).filter((sp) => {
    if (sp.isActive === false) return false;
    if (sp.startDate && dateStr < sp.startDate) return false;
    if (sp.endDate && dateStr > sp.endDate) return false;
    return true;
  });

  return {
    allRestaurants: rawBundle.allRestaurants,
    telephones: hydrateTelephones(rawBundle.allRestaurants),
    newItemDisplayDays: rawBundle.newItemDisplayDays ?? 7,
    menuPayload: {
      restaurants,
      items,
      extras: rawBundle.extras || [],
      specialPrices,
      newItemDisplayDays: rawBundle.newItemDisplayDays ?? 7,
    },
  };
}

// ── LocalStorage Cache Helpers ────────────────────────

interface CachedMenuStorage {
  version: number;
  newItemDisplayDays: number;
  allRestaurants: Restaurant[];
  items: MenuItem[];
  extras: Extra[];
  specialPrices: SpecialPrice[];
}

interface CachedEmployeesStorage {
  version: number;
  names: string[];
}

function readLocalJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeLocalJson(key: string, val: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore quota errors
  }
}

// ── Build Bundle Directly from Firestore Collections ──

export async function readFullMenuFromCollections(): Promise<{
  allRestaurants: Restaurant[];
  items: MenuItem[];
  extras: Extra[];
  specialPrices: SpecialPrice[];
  newItemDisplayDays: number;
}> {
  const [restSnap, portionSnap, menuSnap, spSnap, setSnap] = await Promise.all([
    getDocs(collection(db, 'restaurants')),
    getDocs(collection(db, 'itemPortions')),
    getDocs(query(collection(db, 'menuItems'), where('isActive', '==', true))),
    getDocs(
      query(collection(db, 'specialPrices'), where('isActive', '==', true)),
    ),
    getDoc(doc(db, 'settings', 'NewItemDisplayDays')),
  ]);

  const restCatMap: Record<string, string> = {};
  const allRestaurants: Restaurant[] = restSnap.docs.map((d) => {
    const dat = d.data();
    const cat = (dat.category || '正餐') as Restaurant['category'];
    restCatMap[d.id] = cat;
    return {
      id: d.id,
      name: dat.name || '',
      category: cat,
      telephone: dat.telephone || '',
      isActive: dat.isActive !== false,
      sweetnessOptions: dat.sweetnessOptions || null,
      iceOptions: dat.iceOptions || null,
      createdAt: dat.createdAt || '',
    };
  });

  const portionsById: Record<string, Portion[]> = {};
  const portionsByNorm: Record<string, Portion[]> = {};
  const portionsByLegacy: Record<string, Portion[]> = {};

  portionSnap.docs.forEach((pDoc) => {
    const d = pDoc.data();
    const pObj: Portion = {
      name: d.portionName || '',
      price: Number(d.price || 0),
    };
    if (!pObj.name) return;
    if (d.menuItemId) {
      const k = `${d.restaurantId}_${d.menuItemId}`;
      (portionsById[k] ||= []).push(pObj);
    }
    const norm = d.normalizedName || normalizeName(d.menuItemName || '');
    if (norm) {
      const k = `${d.restaurantId}_${norm}`;
      (portionsByNorm[k] ||= []).push(pObj);
    }
    if (d.legacyItemId) {
      const k = `${d.restaurantId}_${d.legacyItemId}`;
      (portionsByLegacy[k] ||= []).push(pObj);
    }
  });

  const items: MenuItem[] = [];
  const extras: Extra[] = [];

  menuSnap.docs.forEach((mDoc) => {
    const d = mDoc.data();
    const norm = d.normalizedName || normalizeName(d.itemName || '');
    const matchedPortions =
      portionsById[`${d.restaurantId}_${mDoc.id}`] ||
      portionsByNorm[`${d.restaurantId}_${norm}`] ||
      (d.legacyItemId
        ? portionsByLegacy[`${d.restaurantId}_${d.legacyItemId}`]
        : undefined) ||
      [];

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
        id: mDoc.id,
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
        id: mDoc.id,
        restaurantId: d.restaurantId,
        name: d.itemName,
        price: Number(d.price || 0),
        type,
        group: d.extraGroup || (type === 'single' ? '套餐' : '加點'),
      });
    }
  });

  const specialPrices: SpecialPrice[] = spSnap.docs.map((sDoc) => {
    const d = sDoc.data();
    return {
      id: sDoc.id,
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
    };
  });

  const newItemDisplayDays = setSnap.exists()
    ? Number(setSnap.data()?.value) || 7
    : 7;

  return {
    allRestaurants,
    items,
    extras,
    specialPrices,
    newItemDisplayDays,
  };
}

export async function publishMenuBundleFromRaw(raw: {
  allRestaurants: Restaurant[];
  items: MenuItem[];
  extras: Extra[];
  specialPrices: SpecialPrice[];
  newItemDisplayDays: number;
}): Promise<number> {
  const version = Date.now();
  const bundle: CompactBundle = {
    version,
    newItemDisplayDays: raw.newItemDisplayDays ?? 7,
    allRestaurants: raw.allRestaurants,
    items: toCompactItems(raw.items),
    extras: raw.extras,
    specialPrices: raw.specialPrices,
    updatedAt: new Date().toISOString(),
  };

  const jsonStr = JSON.stringify(bundle);
  const byteLen = new TextEncoder().encode(jsonStr).length;

  if (byteLen <= CHUNK_BYTE_LIMIT) {
    await setDoc(doc(db, 'catalog', 'menuBundle'), {
      version,
      chunkCount: 0,
      payloadJson: jsonStr,
      updatedAt: bundle.updatedAt,
    });
  } else {
    const chunks: string[] = [];
    const step = 300_000;
    for (let i = 0; i < jsonStr.length; i += step) {
      chunks.push(jsonStr.slice(i, i + step));
    }
    const batch = writeBatch(db);
    chunks.forEach((chunk, idx) => {
      batch.set(doc(db, 'catalog', `menuBundle_${idx}`), {
        version,
        index: idx,
        data: chunk,
      });
    });
    batch.set(doc(db, 'catalog', 'menuBundle'), {
      version,
      chunkCount: chunks.length,
      updatedAt: bundle.updatedAt,
    });
    await batch.commit();
  }

  await setDoc(
    doc(db, 'meta', 'appConfig'),
    {
      menuVersion: version,
      newItemDisplayDays: raw.newItemDisplayDays ?? 7,
      updatedAt: bundle.updatedAt,
    },
    { merge: true },
  );

  writeLocalJson(LS_MENU_CACHE_KEY, {
    version,
    newItemDisplayDays: raw.newItemDisplayDays ?? 7,
    allRestaurants: raw.allRestaurants,
    items: raw.items,
    extras: raw.extras,
    specialPrices: raw.specialPrices,
  } satisfies CachedMenuStorage);

  return version;
}

export async function rebuildCatalogBundleFromFirestore(): Promise<{
  version: number;
  raw: {
    allRestaurants: Restaurant[];
    items: MenuItem[];
    extras: Extra[];
    specialPrices: SpecialPrice[];
    newItemDisplayDays: number;
  };
}> {
  const raw = await readFullMenuFromCollections();
  const version = await publishMenuBundleFromRaw(raw);
  return { version, raw };
}

export async function loadCatalogWithCache(dateStr: string): Promise<{
  employees: string[];
  menuPayload: MenuPayload;
  allRestaurants: Restaurant[];
  telephones: Record<string, RestaurantTelephone>;
  newItemDisplayDays: number;
}> {
  let configSnap: DocumentSnapshot | null = null;
  try {
    configSnap = await getDoc(doc(db, 'meta', 'appConfig'));
  } catch {
    configSnap = null;
  }

  const configData = configSnap?.exists() ? configSnap.data() : null;
  const remoteMenuVer = Number(configData?.menuVersion || 0);
  const remoteEmpVer = Number(configData?.employeesVersion || 0);

  // 1. Menu Bundle (LocalStorage or 1-doc Catalog)
  let rawMenu: CachedMenuStorage | null = readLocalJson<CachedMenuStorage>(
    LS_MENU_CACHE_KEY,
  );
  if (
    !rawMenu ||
    !remoteMenuVer ||
    rawMenu.version !== remoteMenuVer ||
    !Array.isArray(rawMenu.items)
  ) {
    let loadedFromBundle = false;
    try {
      const bundleSnap = await getDoc(doc(db, 'catalog', 'menuBundle'));
      if (bundleSnap.exists()) {
        const bd = bundleSnap.data();
        let jsonStr = bd.payloadJson as string | undefined;
        if (!jsonStr && Number(bd.chunkCount) > 0) {
          const chunkPromises = Array.from(
            { length: Number(bd.chunkCount) },
            (_, i) => getDoc(doc(db, 'catalog', `menuBundle_${i}`)),
          );
          const chunkSnaps = await Promise.all(chunkPromises);
          jsonStr = chunkSnaps.map((s) => s.data()?.data || '').join('');
        }
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr) as CompactBundle;
          rawMenu = {
            version: Number(parsed.version || remoteMenuVer || Date.now()),
            newItemDisplayDays: Number(parsed.newItemDisplayDays ?? 7),
            allRestaurants: parsed.allRestaurants || [],
            items: fromCompactItems(parsed.items || []),
            extras: parsed.extras || [],
            specialPrices: parsed.specialPrices || [],
          };
          writeLocalJson(LS_MENU_CACHE_KEY, rawMenu);
          loadedFromBundle = true;
        }
      }
    } catch (err) {
      console.warn('[loadCatalogWithCache] bundle fetch failed:', err);
    }

    if (!loadedFromBundle || !rawMenu) {
      // Fallback: 只在尚未建立 menuBundle 時從基底集合讀取菜單（絕不讀取 orders！）
      const raw = await readFullMenuFromCollections();
      rawMenu = {
        version: remoteMenuVer || Date.now(),
        ...raw,
      };
      writeLocalJson(LS_MENU_CACHE_KEY, rawMenu);
    }
  }

  // 2. Employees List (LocalStorage or 1-doc Catalog)
  let cachedEmp = readLocalJson<CachedEmployeesStorage>(LS_EMP_CACHE_KEY);
  if (
    !cachedEmp ||
    !remoteEmpVer ||
    cachedEmp.version !== remoteEmpVer ||
    !Array.isArray(cachedEmp.names)
  ) {
    let loadedEmp = false;
    try {
      const empSnap = await getDoc(doc(db, 'catalog', 'employees'));
      if (empSnap.exists()) {
        const ed = empSnap.data();
        if (Array.isArray(ed.names)) {
          cachedEmp = {
            version: Number(ed.version || remoteEmpVer || Date.now()),
            names: ed.names,
          };
          writeLocalJson(LS_EMP_CACHE_KEY, cachedEmp);
          loadedEmp = true;
        }
      }
    } catch {
      // fallback below
    }
    if (!loadedEmp || !cachedEmp) {
      const usersSnap = await getDocs(collection(db, 'users'));
      const names = usersSnap.docs
        .map((d) => d.id)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'zh-Hant'));
      cachedEmp = { version: remoteEmpVer || Date.now(), names };
      writeLocalJson(LS_EMP_CACHE_KEY, cachedEmp);
    }
  }

  const hydrated = filterActiveMenuForDate(rawMenu!, dateStr);
  return {
    employees: cachedEmp!.names,
    ...hydrated,
  };
}

// ── Daily Realtime Listeners (onSnapshot) ─────────────

function mapOrderDoc(
  dSnap: { id: string; data: () => Record<string, any> },
  menuItemLookup?: Map<string, string>,
): OrderRecord {
  const d = dSnap.data();
  let itemName = String(d.itemName || '').trim();
  if ((!itemName || itemName === '未知餐點') && menuItemLookup) {
    const resolved = menuItemLookup.get(
      `${d.restaurantId}_${d.legacyItemId}`,
    );
    if (resolved) itemName = resolved;
  }
  return {
    id: dSnap.id,
    rowNumber: dSnap.id,
    employee: d.employeeName || '',
    restaurantId: d.restaurantId || '',
    item: itemName || '未知餐點',
    category: d.category || '其他',
    subCategory: d.subCategory || '',
    quantity: Number(d.quantity || 0),
    unitPrice: Number(d.unitPrice || 0),
    totalPrice: Number(d.totalPrice || 0),
    sweetness: d.sweetness || '',
    ice: d.ice || '',
    note: d.note || '',
    paidAmount:
      d.paidAmount === null || d.paidAmount === undefined ? '' : d.paidAmount,
    changeAmount:
      d.changeAmount === null || d.changeAmount === undefined
        ? ''
        : d.changeAmount,
    isChangeGiven: Boolean(d.isChangeGiven),
    isPaidByBalance: Boolean(d.isPaidByBalance),
    createdAt: d.createdAt || '',
  };
}

export function subscribeDailyRealtime(
  dateStr: string,
  callbacks: {
    onOrders: (orders: OrderRecord[]) => void;
    onConfirmations: (confs: Record<string, Confirmation>) => void;
    onLocks: (locks: Record<string, LockRecord>) => void;
    onError?: (err: Error) => void;
  },
): Unsubscribe {
  const unsubOrders = onSnapshot(
    query(collection(db, 'orders'), where('date', '==', dateStr)),
    (snap) => {
      const orders = snap.docs
        .map((d) => mapOrderDoc(d))
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      callbacks.onOrders(orders);
    },
    (err) => callbacks.onError?.(err),
  );

  const unsubConfs = onSnapshot(
    query(collection(db, 'confirmations'), where('date', '==', dateStr)),
    (snap) => {
      const map: Record<string, Confirmation> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.restaurantId) {
          map[data.restaurantId] = {
            confirmedBy: data.confirmedBy || '',
            confirmedAt: data.confirmedAt || '',
          };
        }
      });
      callbacks.onConfirmations(map);
    },
    (err) => callbacks.onError?.(err),
  );

  const unsubLocks = onSnapshot(
    query(collection(db, 'categoryLocks'), where('date', '==', dateStr)),
    (snap) => {
      const map: Record<string, LockRecord> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.category) {
          map[data.category] = {
            restaurantId: data.restaurantId,
            lockedBy: data.lockedBy || '',
            lockedAt: data.lockedAt || '',
          };
        }
      });
      callbacks.onLocks(map);
    },
    (err) => callbacks.onError?.(err),
  );

  return () => {
    unsubOrders();
    unsubConfs();
    unsubLocks();
  };
}

export async function fetchDailyStateOnce(dateStr: string): Promise<{
  summary: OrderRecord[];
  confirmations: Record<string, Confirmation>;
  locks: Record<string, LockRecord>;
}> {
  const [ordersSnap, confSnap, locksSnap] = await Promise.all([
    getDocs(query(collection(db, 'orders'), where('date', '==', dateStr))),
    getDocs(
      query(collection(db, 'confirmations'), where('date', '==', dateStr)),
    ),
    getDocs(
      query(collection(db, 'categoryLocks'), where('date', '==', dateStr)),
    ),
  ]);

  const summary = ordersSnap.docs
    .map((d) => mapOrderDoc(d))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  const confirmations: Record<string, Confirmation> = {};
  confSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.restaurantId) {
      confirmations[data.restaurantId] = {
        confirmedBy: data.confirmedBy || '',
        confirmedAt: data.confirmedAt || '',
      };
    }
  });

  const locks: Record<string, LockRecord> = {};
  locksSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.category) {
      locks[data.category] = {
        restaurantId: data.restaurantId,
        lockedBy: data.lockedBy || '',
        lockedAt: data.lockedAt || '',
      };
    }
  });

  return { summary, confirmations, locks };
}

// ── Employee & Order Transactions ─────────────────────

export async function getEmployeeInfoApi(
  name: string,
  authEmail?: string | null,
): Promise<{ balance: number; role: 'admin' | 'user' }> {
  let role: 'admin' | 'user' = 'user';
  let balance = 0;

  if (authEmail) {
    try {
      const adminDoc = await getDoc(
        doc(db, 'adminEmails', authEmail.toLowerCase()),
      );
      if (adminDoc.exists()) role = 'admin';
    } catch {
      // ignore
    }
  }

  if (name) {
    const userDoc = await getDoc(doc(db, 'users', name));
    if (userDoc.exists()) {
      const data = userDoc.data();
      balance = Number(data?.balance || 0);
      if (data?.role === 'admin') role = 'admin';
    }
  }

  return { balance, role };
}

export async function getUserRoleApi(
  name: string,
  authEmail?: string | null,
): Promise<'admin' | 'user'> {
  if (authEmail) {
    try {
      const adminDoc = await getDoc(
        doc(db, 'adminEmails', authEmail.toLowerCase()),
      );
      if (adminDoc.exists()) return 'admin';
    } catch {
      // ignore
    }
  }
  if (!name) return 'user';
  const userDoc = await getDoc(doc(db, 'users', name));
  if (userDoc.exists() && userDoc.data()?.role === 'admin') return 'admin';
  return 'user';
}

export async function submitOrderApi(
  payload: OrderPayload,
  extraMeta?: { category?: string; subCategory?: string },
) {
  const item = (payload.items && payload.items[0]) || null;
  if (!item) throw new Error('缺少訂單項目');

  const totalPrice = Number(item.totalPrice || 0);
  const employeeName = String(payload.employeeName || '').trim();
  const restaurantId = String(payload.restaurantId || '').trim();
  const useBalance = payload.useBalance === true;
  const dateStr = payload.date || getTodayDateString();
  const nowStr = new Date().toISOString();

  const isCustom = item.isCustom === true;
  const finalItemName = isCustom
    ? item.customName || ''
    : item.itemName || '';
  const finalNote = item.note || '';

  const orderRef = doc(collection(db, 'orders'));

  const result = await runTransaction(db, async (tx) => {
    let isPaidByBalance = false;
    let newBalance: number | null = null;

    if (useBalance && totalPrice > 0 && employeeName) {
      const userRef = doc(db, 'users', employeeName);
      const userDoc = await tx.get(userRef);
      const currentBal = Number(userDoc.data()?.balance || 0);
      if (userDoc.exists() && currentBal >= totalPrice) {
        newBalance = currentBal - totalPrice;
        tx.update(userRef, { balance: newBalance, updatedAt: nowStr });
        isPaidByBalance = true;
      } else {
        newBalance = currentBal;
      }
    }

    const orderData = {
      date: dateStr,
      employeeName,
      restaurantId,
      itemName: finalItemName,
      category: extraMeta?.category || '',
      subCategory: extraMeta?.subCategory || '',
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
      legacyItemId: isCustom ? '_OTHER_' : item.itemId || '',
    };

    tx.set(orderRef, orderData);
    return { isPaidByBalance, newBalance, orderData };
  });

  return {
    success: true,
    isPaidByBalance: result.isPaidByBalance,
    newBalance: result.newBalance,
    newOrder: mapOrderDoc({
      id: orderRef.id,
      data: () => result.orderData,
    }),
  };
}

export async function deleteOrderApi(orderId: string): Promise<{
  success: boolean;
  message: string;
  refundedEmployee?: string;
  refundAmount?: number;
}> {
  if (!orderId) throw new Error('未指定訂單 ID');
  const orderRef = doc(db, 'orders', orderId);

  return await runTransaction(db, async (tx) => {
    const oSnap = await tx.get(orderRef);
    if (!oSnap.exists()) throw new Error('找不到該筆訂單');

    const order = oSnap.data();
    const empName = order.employeeName as string;
    const totalPrice = Number(order.totalPrice || 0);
    let refundMsg = '';
    let refundedEmployee: string | undefined;
    let refundAmount = 0;

    if (order.isPaidByBalance && totalPrice > 0 && empName) {
      const userRef = doc(db, 'users', empName);
      const userDoc = await tx.get(userRef);
      if (userDoc.exists()) {
        const currentBal = Number(userDoc.data()?.balance || 0);
        tx.update(userRef, {
          balance: currentBal + totalPrice,
          updatedAt: new Date().toISOString(),
        });
        refundedEmployee = empName;
        refundAmount = totalPrice;
        refundMsg = ` (已退回帳戶餘額 $${totalPrice})`;
      }
    } else if (order.paidAmount && Number(order.paidAmount) > 0) {
      refundMsg = ' (注意：此為現金付款，請退還現金)';
    }

    tx.delete(orderRef);
    return {
      success: true,
      message: refundMsg,
      refundedEmployee,
      refundAmount,
    };
  });
}

export async function performDepositApi(
  name: string,
  amount: number,
  knownEmployees: string[],
): Promise<{ newBalance: number; updatedEmployees?: string[] }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('未指定員工姓名');

  const userRef = doc(db, 'users', trimmed);
  const now = new Date().toISOString();

  const { newBalance, isNewUser } = await runTransaction(db, async (tx) => {
    const uDoc = await tx.get(userRef);
    if (uDoc.exists()) {
      const current = Number(uDoc.data()?.balance || 0);
      const next = current + Number(amount);
      tx.update(userRef, { balance: next, updatedAt: now });
      return { newBalance: next, isNewUser: false };
    } else {
      const next = Number(amount);
      tx.set(userRef, {
        name: trimmed,
        balance: next,
        role: 'user',
        updatedAt: now,
      });
      return { newBalance: next, isNewUser: true };
    }
  });

  let updatedEmployees: string[] | undefined;
  if (isNewUser || !knownEmployees.includes(trimmed)) {
    const merged = Array.from(new Set([...knownEmployees, trimmed])).sort(
      (a, b) => a.localeCompare(b, 'zh-Hant'),
    );
    const ver = Date.now();
    try {
      await setDoc(doc(db, 'catalog', 'employees'), {
        version: ver,
        names: merged,
        updatedAt: now,
      });
      await updateDoc(doc(db, 'meta', 'appConfig'), {
        employeesVersion: ver,
        updatedAt: now,
      });
      writeLocalJson(LS_EMP_CACHE_KEY, { version: ver, names: merged });
      updatedEmployees = merged;
    } catch {
      // 若權限不足忽略快取更新
    }
  }

  return { newBalance, updatedEmployees };
}

export async function saveEmployeePaymentApi(data: {
  employee: string;
  paidAmount?: number;
  changeAmount?: number;
  isChangeGiven?: boolean;
  dateString: string;
}): Promise<void> {
  const { employee, paidAmount, changeAmount, isChangeGiven, dateString } =
    data;
  if (!employee || !dateString) return;

  const snap = await getDocs(
    query(
      collection(db, 'orders'),
      where('date', '==', dateString),
      where('employeeName', '==', employee),
    ),
  );
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    const updateData: Record<string, any> = {};
    if (paidAmount !== undefined) updateData.paidAmount = paidAmount;
    if (changeAmount !== undefined) updateData.changeAmount = changeAmount;
    if (isChangeGiven !== undefined) updateData.isChangeGiven = isChangeGiven;
    batch.update(d.ref, updateData);
  });
  await batch.commit();
}

export async function updateOrderNoteApi(
  orderId: string,
  newNote: string,
): Promise<void> {
  if (!orderId) throw new Error('未指定訂單 ID');
  await updateDoc(doc(db, 'orders', orderId), { note: newNote || '' });
}

export async function getFrequentOrdersApi(
  employeeName: string,
  restaurantId: string,
): Promise<FrequentOrderEntry[]> {
  if (!employeeName || !restaurantId) return [];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(thirtyDaysAgo);

  const snap = await getDocs(
    query(
      collection(db, 'orders'),
      where('employeeName', '==', employeeName),
      where('restaurantId', '==', restaurantId),
      where('date', '>=', cutoffDate),
    ),
  );

  const freqMap: Record<string, FrequentOrderEntry> = {};
  snap.docs.forEach((d) => {
    const data = d.data();
    const itemName = data.itemName || '';
    if (!itemName || itemName === '自填餐點') return;

    const note = (data.note || '').trim();
    const sweetness = (data.sweetness || '').trim();
    const ice = (data.ice || '').trim();
    const unitPrice = Number(data.unitPrice || 0);

    const key = `${itemName}|${note}|${sweetness}|${ice}`;
    if (!freqMap[key]) {
      freqMap[key] = {
        itemId: data.legacyItemId || d.id,
        itemName,
        note,
        sweetness,
        ice,
        unitPrice,
        count: 0,
      };
    }
    freqMap[key].count++;
  });

  return Object.values(freqMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// ── Locks & Confirmations (Deterministic IDs + Legacy Cleanup) ──

function safeDocKey(raw: string): string {
  return encodeURIComponent(raw).replace(/%/g, '_');
}

export async function lockCategoryRestaurantApi(
  dateString: string,
  category: string,
  restaurantId: string,
  lockedBy: string,
): Promise<void> {
  const now = new Date().toISOString();
  const detId = `${dateString}_${safeDocKey(category)}`;
  const existing = await getDocs(
    query(
      collection(db, 'categoryLocks'),
      where('date', '==', dateString),
      where('category', '==', category),
    ),
  );

  const batch = writeBatch(db);
  existing.docs.forEach((d) => {
    if (d.id !== detId) batch.delete(d.ref);
  });
  batch.set(doc(db, 'categoryLocks', detId), {
    date: dateString,
    category,
    restaurantId,
    lockedBy: lockedBy || '',
    lockedAt: now,
  });
  await batch.commit();
}

export async function unlockCategoryApi(
  dateString: string,
  category: string,
): Promise<void> {
  const detId = `${dateString}_${safeDocKey(category)}`;
  const existing = await getDocs(
    query(
      collection(db, 'categoryLocks'),
      where('date', '==', dateString),
      where('category', '==', category),
    ),
  );

  const batch = writeBatch(db);
  batch.delete(doc(db, 'categoryLocks', detId));
  existing.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export async function confirmRestaurantOrderApi(
  dateString: string,
  restaurantId: string,
  byName: string,
  restCategory?: string,
): Promise<{ confirmedAt: string }> {
  const now = new Date().toISOString();
  const detId = `${dateString}_${safeDocKey(restaurantId)}`;

  const existing = await getDocs(
    query(
      collection(db, 'confirmations'),
      where('date', '==', dateString),
      where('restaurantId', '==', restaurantId),
    ),
  );

  const batch = writeBatch(db);
  existing.docs.forEach((d) => {
    if (d.id !== detId) batch.delete(d.ref);
  });
  batch.set(doc(db, 'confirmations', detId), {
    date: dateString,
    restaurantId,
    confirmedBy: byName || '',
    confirmedAt: now,
  });
  await batch.commit();

  let cat = restCategory;
  if (!cat) {
    const restSnap = await getDoc(doc(db, 'restaurants', restaurantId));
    cat = restSnap.data()?.category;
  }
  if (cat) {
    await unlockCategoryApi(dateString, cat);
  }

  return { confirmedAt: now };
}

export async function cancelRestaurantConfirmationApi(
  dateString: string,
  restaurantId: string,
): Promise<void> {
  const detId = `${dateString}_${safeDocKey(restaurantId)}`;
  const existing = await getDocs(
    query(
      collection(db, 'confirmations'),
      where('date', '==', dateString),
      where('restaurantId', '==', restaurantId),
    ),
  );

  const batch = writeBatch(db);
  batch.delete(doc(db, 'confirmations', detId));
  existing.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ── Admin Operations ──────────────────────────────────

async function findMenuItemDoc(
  restaurantId: string,
  itemName: string,
): Promise<DocumentSnapshot | null> {
  const normalized = normalizeName(itemName);
  const snap = await getDocs(
    query(
      collection(db, 'menuItems'),
      where('restaurantId', '==', restaurantId),
      where('normalizedName', '==', normalized),
    ),
  );
  if (!snap.empty) return snap.docs[0];

  const targetBase = normalizeName(getBaseItemName(itemName));
  if (!targetBase) return null;

  const allSnap = await getDocs(
    query(
      collection(db, 'menuItems'),
      where('restaurantId', '==', restaurantId),
      where('isActive', '==', true),
    ),
  );
  for (const d of allSnap.docs) {
    const existingBase = normalizeName(
      getBaseItemName(d.data().itemName || ''),
    );
    if (existingBase === targetBase) return d;
  }
  return null;
}

export async function addRestaurantApi(data: {
  name: string;
  category: string;
  telephone?: string;
}): Promise<string> {
  const restId = 'REST_' + Date.now();
  await setDoc(doc(db, 'restaurants', restId), {
    name: String(data.name || '').trim(),
    category: data.category || '正餐',
    telephone: String(data.telephone || '').trim(),
    isActive: true,
    createdAt: new Date().toISOString(),
  });
  return restId;
}

export async function updateRestaurantApi(data: {
  restaurantId: string;
  name?: string;
  category?: string;
  telephone?: string;
}): Promise<void> {
  if (!data.restaurantId) throw new Error('未指定餐廳 ID');
  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = String(data.name).trim();
  if (data.category !== undefined) updateData.category = data.category;
  if (data.telephone !== undefined)
    updateData.telephone = String(data.telephone).trim();
  await updateDoc(doc(db, 'restaurants', data.restaurantId), updateData);
}

export async function toggleRestaurantActiveApi(
  restaurantId: string,
  isActive: boolean,
): Promise<void> {
  if (!restaurantId) throw new Error('未指定餐廳 ID');
  await updateDoc(doc(db, 'restaurants', restaurantId), {
    isActive: Boolean(isActive),
  });
}

export async function updateRestaurantCustomOptionsApi(data: {
  restaurantId: string;
  sweetnessOptions?: string[];
  iceOptions?: string[];
}): Promise<void> {
  if (!data.restaurantId) throw new Error('未指定餐廳 ID');
  const updateData: Record<string, any> = {};
  if (data.sweetnessOptions !== undefined)
    updateData.sweetnessOptions = data.sweetnessOptions;
  if (data.iceOptions !== undefined) updateData.iceOptions = data.iceOptions;
  await updateDoc(doc(db, 'restaurants', data.restaurantId), updateData);
}

export async function addOrUpdateMenuItemApi(
  data: Record<string, any>,
): Promise<string> {
  let docId = data.itemId ? String(data.itemId).trim() : '';
  let existingDoc: DocumentSnapshot | null = null;
  if (docId) {
    const byId = await getDoc(doc(db, 'menuItems', docId));
    if (byId.exists()) existingDoc = byId;
  }

  const restaurantId = String(
    data.restaurantId || existingDoc?.data()?.restaurantId || '',
  ).trim();
  const itemName = String(
    data.itemName || existingDoc?.data()?.itemName || '',
  ).trim();
  if (!restaurantId || !itemName) throw new Error('缺少餐廳或品項名稱');

  const normalized = normalizeName(itemName);
  if (!existingDoc) {
    existingDoc = await findMenuItemDoc(restaurantId, itemName);
  }

  const payload: Record<string, any> = {
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
    await updateDoc(existingDoc.ref, payload);
  } else {
    payload.createdAt = new Date().toISOString();
    payload.legacyItemId = data.itemId || '';
    const newRef = doc(collection(db, 'menuItems'));
    await setDoc(newRef, payload);
    docId = newRef.id;
  }

  if (Array.isArray(data.portions)) {
    const pSnap = await getDocs(
      query(
        collection(db, 'itemPortions'),
        where('restaurantId', '==', restaurantId),
        where('normalizedName', '==', normalized),
      ),
    );
    const batch = writeBatch(db);
    pSnap.docs.forEach((d) => batch.delete(d.ref));
    for (const p of data.portions) {
      const pRef = doc(collection(db, 'itemPortions'));
      batch.set(pRef, {
        restaurantId,
        menuItemId: docId,
        menuItemName: itemName,
        normalizedName: normalized,
        portionName: p.name,
        price: Number(p.price || 0),
      });
    }
    await batch.commit();
  }

  return docId;
}

export async function setMenuItemActiveApi(
  restaurantId: string | undefined,
  itemIdOrName: string,
  isActive: boolean,
): Promise<void> {
  const byId = await getDoc(doc(db, 'menuItems', itemIdOrName));
  if (
    byId.exists() &&
    (!restaurantId || byId.data()?.restaurantId === restaurantId)
  ) {
    await updateDoc(byId.ref, { isActive });
    return;
  }
  if (restaurantId) {
    const existing = await findMenuItemDoc(restaurantId, itemIdOrName);
    if (existing) {
      await updateDoc(existing.ref, { isActive });
      return;
    }
  }
  throw new Error('找不到該品項');
}

export async function applyMenuChangesApi(
  restaurantId: string,
  changes: Array<Record<string, any>>,
  knownRestaurants?: Restaurant[],
): Promise<number> {
  if (!Array.isArray(changes) || changes.length === 0) return 0;

  const restCatCache: Record<string, string> = {};
  knownRestaurants?.forEach((r) => {
    restCatCache[r.id] = r.category || '正餐';
  });

  const getRestCat = async (rid: string) => {
    if (!rid) return '正餐';
    if (restCatCache[rid]) return restCatCache[rid];
    const rDoc = await getDoc(doc(db, 'restaurants', rid));
    const cat = rDoc.data()?.category || '正餐';
    restCatCache[rid] = cat;
    return cat;
  };

  // 先一次性載入該餐廳的現有品項做記憶體比對，避免每筆變更都重複查詢 Firestore
  const restItemsSnap = await getDocs(
    query(
      collection(db, 'menuItems'),
      where('restaurantId', '==', restaurantId),
    ),
  );
  const byIdMap = new Map<string, DocumentSnapshot>();
  const byNormMap = new Map<string, DocumentSnapshot>();
  const byBaseMap = new Map<string, DocumentSnapshot>();

  restItemsSnap.docs.forEach((d) => {
    byIdMap.set(d.id, d);
    const dat = d.data();
    const norm = dat.normalizedName || normalizeName(dat.itemName || '');
    if (norm && !byNormMap.has(norm)) byNormMap.set(norm, d);
    const base = normalizeName(getBaseItemName(dat.itemName || ''));
    if (base && dat.isActive !== false && !byBaseMap.has(base)) {
      byBaseMap.set(base, d);
    }
  });

  let applied = 0;
  let batch = writeBatch(db);
  let ops = 0;

  const flushBatch = async () => {
    if (ops > 0) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  };

  const commitIfNeeded = async () => {
    ops++;
    if (ops >= 400) await flushBatch();
  };

  for (const change of changes) {
    const targetRestId = change.restaurantId || restaurantId;
    const itemName = String(change.itemName || change.name || '').trim();
    if (!itemName) continue;

    const restCat = await getRestCat(targetRestId);
    const subCat = String(change.subCategory || '').trim();
    const isSubDrink = /^(飲料|飲品)$/.test(subCat);
    const resolvedCategory =
      change.category &&
      !(restCat !== '飲料' && change.category === '飲料' && subCat && !isSubDrink)
        ? change.category
        : restCat === '飲料' || isSubDrink
          ? '飲料'
          : restCat;

    let targetDoc: DocumentSnapshot | undefined;
    if (change.itemId && change.itemId !== '_OTHER_') {
      targetDoc = byIdMap.get(change.itemId);
      if (!targetDoc && targetRestId !== restaurantId) {
        const snap = await getDoc(doc(db, 'menuItems', change.itemId));
        if (snap.exists()) targetDoc = snap;
      }
    }
    if (!targetDoc && targetRestId === restaurantId) {
      const norm = normalizeName(itemName);
      const base = normalizeName(getBaseItemName(itemName));
      targetDoc = byNormMap.get(norm) || byBaseMap.get(base);
    } else if (!targetDoc) {
      targetDoc = (await findMenuItemDoc(targetRestId, itemName)) ?? undefined;
    }

    if (change.type === 'remove') {
      if (targetDoc) {
        batch.update(targetDoc.ref, { isActive: false });
        await commitIfNeeded();
        applied++;
      }
    } else if (change.type === 'update') {
      if (targetDoc) {
        const updatePayload: Record<string, any> = {
          itemName,
          normalizedName: normalizeName(itemName),
          price: Number(change.price || 0),
          category: resolvedCategory,
          isActive: true,
        };
        if (change.subCategory !== undefined)
          updatePayload.subCategory = change.subCategory;
        if (change.flavors !== undefined)
          updatePayload.flavors = change.flavors;
        if (change.limitedType !== undefined)
          updatePayload.limitedType = change.limitedType;
        batch.update(targetDoc.ref, updatePayload);
        await commitIfNeeded();
        applied++;
      } else {
        await addOrUpdateMenuItemApi({
          restaurantId: targetRestId,
          itemName,
          price: change.price,
          category: resolvedCategory,
          subCategory: change.subCategory || '',
          flavors: change.flavors || '',
          limitedType: change.limitedType || '',
          portions: change.portions || [],
        });
        applied++;
      }
    } else if (change.type === 'add') {
      if (targetDoc) {
        batch.update(targetDoc.ref, {
          itemName,
          normalizedName: normalizeName(itemName),
          price: Number(change.price || 0),
          category: resolvedCategory,
          subCategory:
            change.subCategory || targetDoc.data()?.subCategory || '',
          isActive: true,
        });
        await commitIfNeeded();
      } else {
        await addOrUpdateMenuItemApi({
          restaurantId: targetRestId,
          itemName,
          price: change.price,
          category: resolvedCategory,
          subCategory: change.subCategory || '',
          flavors: change.flavors || '',
          limitedType: change.limitedType || '',
          portions: change.portions || [],
        });
      }
      applied++;
    }
  }

  await flushBatch();
  return applied;
}

export async function setSpecialPriceApi(data: {
  restaurantId: string;
  itemId?: string;
  itemName?: string;
  portionName?: string;
  originalPrice?: number;
  specialPrice: number;
  startDate?: string;
  endDate?: string;
  label?: string;
}): Promise<void> {
  const restaurantId = String(data.restaurantId || '');
  const portionName = String(data.portionName || '').trim();
  const itemId = String(data.itemId || '').trim();
  const itemName = String(data.itemName || '').trim();

  const existingSnap = await getDocs(
    query(
      collection(db, 'specialPrices'),
      where('restaurantId', '==', restaurantId),
    ),
  );
  const matchedDoc = existingSnap.docs.find((d) => {
    const s = d.data();
    const samePortion = String(s.portionName || '').trim() === portionName;
    if (!samePortion) return false;
    if (itemId && (s.menuItemId === itemId || s.itemId === itemId)) return true;
    if (itemName && s.itemName === itemName) return true;
    return false;
  });

  const payload = {
    restaurantId,
    menuItemId: itemId,
    itemId,
    itemName,
    portionName,
    originalPrice: Number(data.originalPrice || 0),
    specialPrice: Number(data.specialPrice || 0),
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    label: data.label || '限時特價',
    isActive: true,
  };

  if (matchedDoc) {
    await updateDoc(matchedDoc.ref, payload);
  } else {
    await setDoc(doc(collection(db, 'specialPrices')), payload);
  }
}

export async function removeSpecialPriceApi(
  restaurantId: string,
  itemIdOrName: string,
  portionName: string,
): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, 'specialPrices'),
      where('restaurantId', '==', restaurantId),
    ),
  );
  const targetPortion = (portionName || '').trim();
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    const s = d.data();
    const samePortion = String(s.portionName || '').trim() === targetPortion;
    const sameItem =
      s.menuItemId === itemIdOrName ||
      s.itemId === itemIdOrName ||
      s.itemName === itemIdOrName;
    if (samePortion && sameItem) {
      batch.delete(d.ref);
    }
  });
  await batch.commit();
}

export async function updateNewItemDisplayDaysApi(days: number): Promise<void> {
  await setDoc(doc(db, 'settings', 'NewItemDisplayDays'), { value: days });
}

export async function cleanupDuplicateMenuItemsApi(
  restaurantId?: string,
): Promise<{ duplicateGroups: number; deletedCount: number }> {
  const q =
    restaurantId && restaurantId !== '__ALL__'
      ? query(
          collection(db, 'menuItems'),
          where('restaurantId', '==', restaurantId),
        )
      : collection(db, 'menuItems');

  const snap = await getDocs(q);
  const map = new Map<string, DocumentSnapshot[]>();

  snap.docs.forEach((d) => {
    const data = d.data();
    const baseNorm = normalizeName(getBaseItemName(data.itemName || ''));
    if (!baseNorm) return;
    const key = `${data.restaurantId}_${baseNorm}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  });

  const toDelete: DocumentSnapshot[] = [];
  for (const [, docs] of map.entries()) {
    if (docs.length > 1) {
      docs.sort((a, b) => {
        const nameA = a.data()?.itemName || '';
        const nameB = b.data()?.itemName || '';
        const hasParenA = /[（(].*?[）)]/.test(nameA) ? 1 : 0;
        const hasParenB = /[（(].*?[）)]/.test(nameB) ? 1 : 0;
        if (hasParenA !== hasParenB) return hasParenB - hasParenA;
        if (nameB.length !== nameA.length) return nameB.length - nameA.length;
        const timeA = a.data()?.createdAt || '';
        const timeB = b.data()?.createdAt || '';
        return timeB.localeCompare(timeA);
      });
      for (let i = 1; i < docs.length; i++) {
        toDelete.push(docs[i]);
      }
    }
  }

  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = writeBatch(db);
    toDelete.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  return { duplicateGroups: map.size, deletedCount: toDelete.length };
}
