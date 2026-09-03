import { create } from 'zustand';
import { httpsCallable } from 'firebase/functions';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { functions, auth, db } from './firebase';
import type {
  AdminData,
  AppTab,
  Confirmation,
  Extra,
  FrequentOrderEntry,
  InitialData,
  LockRecord,
  MenuItem,
  MenuPayload,
  OrderPayload,
  OrderRecord,
  RestaurantTelephone,
} from './types';

// 解析「X選Y」規則的 Helper 函數
export function getFreeExtrasCount(itemName: string): number | null {
  const chineseToNum: Record<string, number> = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
  };
  const match = itemName.match(/(?:配料區)?([一二三四五六七八九十\d]+)選([一二三四五六七八九十\d]+)/);
  if (match) {
    const selectStr = match[2];
    const count = chineseToNum[selectStr] || parseInt(selectStr, 10);
    if (!isNaN(count)) return count;
  }
  return null;
}

// ── Types ──────────────────────────────────────────

interface AppState {
  initialized: boolean;
  loading: boolean;
  date: string;
  employees: string[];
  telephones: Record<string, RestaurantTelephone>;
  summary: OrderRecord[];
  confirmations: Record<string, Confirmation>;
  locks: Record<string, LockRecord>;
  menuPayload: MenuPayload | null;
  balance: number | null;

  // UI state
  activeTab: AppTab;
  searchQuery: string;
  depositAmount: string;

  // Selection state
  selectedEmployee: string;
  selectedCategory: string;
  selectedRestaurant: string;
  selectedItem: MenuItem | null;

  // Item config
  quantity: number;
  selectedPortion: string;
  selectedFlavors: string[];
  selectedExtras: string[];
  selectedSingleExtras: Record<string, string>;
  sweetness: string;
  ice: string;
  note: string;
  useBalance: boolean;
  customItemName: string;
  customItemPrice: string;

  // Admin state & Auth
  userRole: 'admin' | 'user';
  adminUser: FirebaseUser | null;
  adminData: AdminData | null;
  adminLoading: boolean;
  newItemDisplayDays: number;

  // Actions
  init: (dateStr?: string) => Promise<void>;
  setLoading: (l: boolean) => void;
  setActiveTab: (tab: AppTab) => void;
  setSearchQuery: (q: string) => void;
  setDepositAmount: (v: string) => void;
  setEmployee: (emp: string) => Promise<void>;
  setCategory: (cat: string) => void;
  setRestaurant: (restId: string) => void;
  setItem: (item: MenuItem | null) => void;
  setQuantity: (q: number) => void;
  setPortion: (p: string) => void;
  toggleFlavor: (f: string) => void;
  toggleExtra: (id: string) => void;
  setSingleExtra: (group: string, id: string) => void;
  setOption: (key: string, val: string | boolean) => void;
  setCustomItemName: (name: string) => void;
  setCustomItemPrice: (price: string) => void;
  submitOrder: () => Promise<{ ok: boolean; error?: string }>;
  savePayment: (emp: string, paid: number, change: number) => Promise<void>;
  setChangeGiven: (emp: string, isGiven: boolean) => Promise<void>;
  confirmRestaurant: (restId: string) => Promise<void>;
  cancelConfirm: (restId: string) => Promise<void>;
  refreshSummary: () => Promise<void>;
  deleteOrder: (orderId: string | number) => Promise<{ message?: string }>;
  depositBalance: (amount: number) => Promise<{ ok: boolean; error?: string }>;
  updateNote: (
    orderId: string | number,
    newNote: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  getQuickOrders: (employee: string) => FrequentOrderEntry[];
  frequentOrders: FrequentOrderEntry[];
  frequentOrdersLoading: boolean;
  fetchFrequentOrders: (employee: string, restaurantId: string) => Promise<void>;
  applyFrequentOrder: (fo: FrequentOrderEntry) => void;
  lockCategoryRestaurant: (category: string, restaurantId: string) => Promise<{ ok: boolean; error?: string }>;
  unlockCategory: (category: string) => Promise<{ ok: boolean; error?: string }>;

  // Admin & Auth actions
  loginWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  loginWithEmail: (email: string, pass: string) => Promise<{ ok: boolean; error?: string }>;
  logoutAdmin: () => Promise<void>;
  checkUserRole: (emp: string) => Promise<void>;
  loadAdminData: () => Promise<void>;
  adminAddItem: (data: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  adminAddRestaurant: (data: { name: string; category: string; telephone?: string }) => Promise<{ ok: boolean; error?: string }>;
  adminUpdateItem: (data: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  adminDeactivateItem: (restaurantId: string, itemId: string) => Promise<{ ok: boolean; error?: string }>;
  adminReactivateItem: (restaurantId: string, itemId: string) => Promise<{ ok: boolean; error?: string }>;
  adminApplyChanges: (restaurantId: string, changes: unknown[]) => Promise<{ ok: boolean; error?: string }>;
  adminSetSpecialPrice: (data: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  adminRemoveSpecialPrice: (restaurantId: string, itemId: string, portionName: string) => Promise<{ ok: boolean; error?: string }>;
  adminUpdateNewItemDisplayDays: (days: number) => Promise<{ ok: boolean; error?: string }>;
}

// ── Store ─────────────────────────────────────────────

export const useStore = create<AppState>((set, get) => {
  // 初始化 Auth 狀態監聽
  onAuthStateChanged(auth, (user) => {
    set({ adminUser: user });
    if (user) {
      set({ userRole: 'admin' });
    }
  });

  return {
    initialized: false,
    loading: true,
    date: '',
    telephones: {},
    employees: [],
    summary: [],
    confirmations: {},
    locks: {},
    menuPayload: null,
    balance: null,

    activeTab: 'order',
    searchQuery: '',
    depositAmount: '',

    selectedEmployee: '',
    selectedCategory: '',
    selectedRestaurant: '',
    selectedItem: null,

    quantity: 1,
    selectedPortion: '',
    selectedFlavors: [],
    selectedExtras: [],
    selectedSingleExtras: {},
    sweetness: '正常',
    ice: '正常',
    note: '',
    // 修正 Bug 8：預設不勾選使用餘額，由使用者自行決定
    useBalance: false,
    customItemName: '',
    customItemPrice: '',

    userRole: 'user',
    adminUser: null,
    adminData: null,
    adminLoading: false,
    newItemDisplayDays: 7,
    frequentOrders: [],
    frequentOrdersLoading: false,

    // ── Init ──

    init: async (dateStr?: string) => {
      const today = dateStr || new Date().toISOString().split('T')[0];
      set({ loading: true, date: today });

      // 嘗試 1：呼叫 Cloud Functions (標準管道)
      try {
        const fn = httpsCallable(functions, 'getInitialData');
        const res: any = await fn({ dateStr: today });
        const data = res.data as InitialData;

        const defaultCategory = '正餐';
        const locks = data.locks || {};
        const lockedRestId = locks[defaultCategory]?.restaurantId || '';

        set({
          initialized: true,
          loading: false,
          date: data.date || today,
          telephones: data.telephones || {},
          employees: data.employees || [],
          summary: data.summary || [],
          confirmations: data.confirmations || {},
          locks: locks,
          menuPayload: data.menuPayload,
          newItemDisplayDays: data.menuPayload?.newItemDisplayDays ?? 7,
          selectedCategory: defaultCategory,
          selectedRestaurant: lockedRestId,
        });
        return;
      } catch (fnErr: any) {
        console.warn('[init] Cloud Functions getInitialData failed or cold-starting, falling back to Firestore direct read...', fnErr);
      }

      // 嘗試 2：Firestore 直連 Fallback (雙保險，保證首頁 1 秒內有菜單)
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const [usersSnap, restSnap, menuSnap, portionSnap, ordersSnap, confSnap, locksSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'restaurants')),
          getDocs(collection(db, 'menuItems')),
          getDocs(collection(db, 'itemPortions')),
          getDocs(collection(db, 'orders')),
          getDocs(collection(db, 'confirmations')),
          getDocs(collection(db, 'categoryLocks')),
        ]);

        const employees = usersSnap.docs.map((d) => d.id).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
        const telephones: Record<string, RestaurantTelephone> = {};
        const restaurants: any[] = [];
        restSnap.docs.forEach((d) => {
          const dat = d.data();
          telephones[d.id] = { name: dat.name || '', telephone: dat.telephone || '' };
          if (dat.isActive !== false) {
            restaurants.push({ id: d.id, name: dat.name || '', category: dat.category || '正餐', createdAt: dat.createdAt || '' });
          }
        });

        const portionsMap: Record<string, any[]> = {};
        portionSnap.docs.forEach((d) => {
          const p = d.data();
          const key = `${p.restaurantId}_${p.legacyItemId || p.portionName}`;
          if (!portionsMap[key]) portionsMap[key] = [];
          portionsMap[key].push({ name: p.portionName, price: Number(p.price || 0) });
        });

        const items: any[] = [];
        const extras: any[] = [];
        menuSnap.docs.forEach((d) => {
          const m = d.data();
          if (m.isActive === false) return;
          const key = `${m.restaurantId}_${m.legacyItemId || d.id}`;
          const portions = portionsMap[key] || [];
          if (!m.isExtra) {
            items.push({
              id: d.id,
              restaurantId: m.restaurantId,
              name: m.itemName,
              price: Number(m.price || 0),
              category: m.category || '',
              image: m.image || '',
              subCategory: m.subCategory || '',
              flavors: m.flavors || '',
              portions,
              limitedType: m.limitedType || '',
              startDate: m.startDate || '',
              endDate: m.endDate || '',
              createdAt: m.createdAt || ''
            });
          } else {
            extras.push({
              id: d.id,
              restaurantId: m.restaurantId,
              name: m.itemName,
              price: Number(m.price || 0),
              type: m.extraType || 'extra',
              group: m.extraGroup || '加點'
            });
          }
        });

        const summary: OrderRecord[] = [];
        ordersSnap.docs.forEach((d) => {
          const o = d.data();
          if (o.date === today) {
            summary.push({
              id: d.id,
              rowNumber: d.id,
              employee: o.employeeName || '',
              restaurantId: o.restaurantId || '',
              item: o.itemName || '',
              category: o.category || '其他',
              subCategory: o.subCategory || '',
              quantity: Number(o.quantity || 1),
              unitPrice: Number(o.unitPrice || 0),
              totalPrice: Number(o.totalPrice || 0),
              sweetness: o.sweetness || '',
              ice: o.ice || '',
              note: o.note || '',
              paidAmount: o.paidAmount ?? '',
              changeAmount: o.changeAmount ?? '',
              isChangeGiven: Boolean(o.isChangeGiven),
              isPaidByBalance: Boolean(o.isPaidByBalance),
              createdAt: o.createdAt || ''
            });
          }
        });

        const confirmations: Record<string, any> = {};
        confSnap.docs.forEach((d) => {
          const c = d.data();
          if (c.date === today) {
            confirmations[c.restaurantId] = { confirmedBy: c.confirmedBy || '', confirmedAt: c.confirmedAt || '' };
          }
        });

        const locks: Record<string, any> = {};
        locksSnap.docs.forEach((d) => {
          const l = d.data();
          if (l.date === today) {
            locks[l.category] = { restaurantId: l.restaurantId, lockedBy: l.lockedBy || '', lockedAt: l.lockedAt || '' };
          }
        });

        const defaultCategory = '正餐';
        set({
          initialized: true,
          loading: false,
          date: today,
          telephones,
          employees,
          summary,
          confirmations,
          locks,
          menuPayload: {
            restaurants,
            items,
            extras,
            specialPrices: [],
            newItemDisplayDays: 7
          },
          newItemDisplayDays: 7,
          selectedCategory: defaultCategory,
          selectedRestaurant: locks[defaultCategory]?.restaurantId || '',
        });
      } catch (err: any) {
        console.error('[init] Firestore direct read also failed:', err);
        set({ initialized: true, loading: false });
      }
    },

    setLoading: (l) => set({ loading: l }),
    setActiveTab: (tab) => set({ activeTab: tab }),
    setSearchQuery: (q) => set({ searchQuery: q }),
    setDepositAmount: (v) => set({ depositAmount: v }),

    // ── Employee ──

    setEmployee: async (emp) => {
      const trimmedEmp = emp.trim();
      // 修正 Bug 8：切換員工時保持 useBalance 為 false
      set({ selectedEmployee: emp, balance: null, useBalance: false });

      if (trimmedEmp && get().employees.includes(trimmedEmp)) {
        try {
          const balFn = httpsCallable(functions, 'getEmployeeBalanceCallable');
          const balRes: any = await balFn({ name: trimmedEmp });
          const bal = Number(balRes.data || 0);

          if (get().selectedEmployee.trim() === trimmedEmp) {
            // 修正 Bug 8：取得餘額後不強制設定 useBalance: bal > 0，一律維持使用者決定
            set({ balance: bal, useBalance: false });
          }

          // 角色查詢
          const roleFn = httpsCallable(functions, 'getUserRoleCallable');
          const roleRes: any = await roleFn({ name: trimmedEmp });
          const role = roleRes.data === 'admin' || get().adminUser !== null ? 'admin' : 'user';

          if (get().selectedEmployee.trim() === trimmedEmp) {
            set({ userRole: role });
          }
        } catch (err) {
          console.error('[setEmployee] failed:', err);
        }
      } else {
        if (!get().adminUser) {
          set({ userRole: 'user' });
        }
      }
    },

    // ── Selection ──

    setCategory: (cat) => {
      const locks = get().locks || {};
      const lockedRestId = locks[cat]?.restaurantId || '';
      set({
        selectedCategory: cat,
        selectedRestaurant: lockedRestId,
        selectedItem: null,
        customItemName: '',
        customItemPrice: '',
        quantity: 1,
      });
    },

    setRestaurant: (restId) => {
      set({
        selectedRestaurant: restId,
        selectedItem: null,
        customItemName: '',
        customItemPrice: '',
        quantity: 1,
        frequentOrders: [],
      });
      const emp = get().selectedEmployee;
      if (emp && restId) {
        get().fetchFrequentOrders(emp, restId);
      }
    },

    setItem: (item) => {
      let defaultFlavor: string[] = [];
      if (item?.flavors) {
        const fArr = item.flavors
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
        if (fArr.length > 0) defaultFlavor = [fArr[0]];
      }
      set({
        selectedItem: item,
        selectedPortion: item?.portions?.[0]?.name || '',
        selectedFlavors: defaultFlavor,
        selectedExtras: [],
        selectedSingleExtras: {},
        quantity: 1,
        sweetness: '正常',
        ice: '正常',
        note: '',
      });
    },

    setQuantity: (q) => set({ quantity: Math.max(1, q) }),
    setPortion: (p) => set({ selectedPortion: p }),
    toggleFlavor: (f) => set({ selectedFlavors: [f] }),

    toggleExtra: (id) =>
      set((s) => ({
        selectedExtras: s.selectedExtras.includes(id)
          ? s.selectedExtras.filter((x) => x !== id)
          : [...s.selectedExtras, id],
      })),

    setSingleExtra: (group, id) =>
      set((s) => ({
        selectedSingleExtras: { ...s.selectedSingleExtras, [group]: id },
      })),

    setOption: (key, val) => set((s) => ({ ...s, [key]: val })),
    setCustomItemName: (name) => set({ customItemName: name }),
    setCustomItemPrice: (price) => set({ customItemPrice: price }),

    // ── Submit Order ──

    submitOrder: async () => {
      const state = get();
      if (!state.selectedEmployee || !state.selectedRestaurant || !state.selectedItem) {
        return { ok: false, error: '請完整填寫餐點資料' };
      }

      const item = state.selectedItem;
      let unitPrice = item.price;
      if (state.selectedPortion) {
        const p = item.portions?.find((x) => x.name === state.selectedPortion);
        if (p) unitPrice = p.price;
      }

      let extrasTotal = 0;
      const extrasNames: string[] = [];
      const allExtras: Extra[] =
        state.menuPayload?.extras.filter((e) => e.restaurantId === state.selectedRestaurant) || [];

      Object.values(state.selectedSingleExtras).forEach((eid) => {
        if (!eid) return;
        const e = allExtras.find((x) => String(x.id) === String(eid));
        if (e) {
          extrasTotal += e.price;
          extrasNames.push(e.name);
        }
      });

      const multipleExtrasList: { id: string; name: string; price: number }[] = [];
      state.selectedExtras.forEach((eid) => {
        const e = allExtras.find((x) => String(x.id) === String(eid));
        if (e) {
          multipleExtrasList.push({ id: String(e.id), name: e.name, price: e.price });
          extrasNames.push(e.name);
        }
      });

      const freeCount = getFreeExtrasCount(item.name);
      if (freeCount !== null) {
        const sortedList = [...multipleExtrasList].sort((a, b) => b.price - a.price);
        const freeIds = new Set<string>();
        for (let i = 0; i < Math.min(freeCount, sortedList.length); i++) {
          freeIds.add(sortedList[i].id);
        }
        multipleExtrasList.forEach((e) => {
          if (!freeIds.has(e.id)) {
            extrasTotal += e.price;
          }
        });
      } else {
        multipleExtrasList.forEach((e) => {
          extrasTotal += e.price;
        });
      }

      const totalPrice = (unitPrice + extrasTotal) * state.quantity;
      const noteArr: string[] = [];
      if (state.selectedPortion) noteArr.push(`(${state.selectedPortion})`);
      if (state.selectedFlavors.length > 0) noteArr.push(`[${state.selectedFlavors.join('/')}]`);
      if (state.note) noteArr.push(state.note);
      if (extrasNames.length > 0) noteArr.push(`加點:${extrasNames.join('、')}`);

      const payload: OrderPayload = {
        date: state.date,
        employeeName: state.selectedEmployee,
        restaurantId: state.selectedRestaurant,
        useBalance: state.useBalance,
        items: [
          {
            itemId: String(item.id),
            itemName: item.name,
            quantity: state.quantity,
            originalPrice: unitPrice,
            unitPrice,
            portionName: state.selectedPortion,
            totalPrice,
            sweetness: state.sweetness,
            ice: state.ice,
            note: noteArr.join('; '),
            isCustom: item.isCustom,
            customName: item.customName,
            customPrice: item.customPrice,
          },
        ],
      };

      set({ loading: true });
      try {
        const fn = httpsCallable(functions, 'submitOrder');
        await fn(payload);

        set({
          selectedRestaurant: '',
          selectedItem: null,
          customItemName: '',
          customItemPrice: '',
          quantity: 1,
          loading: false,
        });

        // 刷新資料
        await get().refreshSummary();
        await get().setEmployee(state.selectedEmployee);
        return { ok: true };
      } catch (e: any) {
        set({ loading: false });
        return { ok: false, error: e.message };
      }
    },

    // ── Summary ──

    refreshSummary: async () => {
      try {
        const fn = httpsCallable(functions, 'getInitialData');
        const res: any = await fn({ dateStr: get().date });
        const d = res.data as InitialData;
        set({ summary: d.summary, confirmations: d.confirmations, locks: d.locks || {} });
      } catch (err) {
        console.error('[refreshSummary] failed:', err);
      }
    },

    // ── Payment ──

    savePayment: async (emp, paid, change) => {
      set((state) => ({
        summary: state.summary.map((o) =>
          o.employee === emp ? { ...o, paidAmount: paid, changeAmount: change } : o
        ),
      }));

      try {
        const fn = httpsCallable(functions, 'saveEmployeePayment');
        await fn({
          employee: emp,
          paidAmount: paid,
          changeAmount: change,
          dateString: get().date,
        });
      } catch (err) {
        console.error('[savePayment] failed:', err);
        await get().refreshSummary();
      }
    },

    setChangeGiven: async (emp, isGiven) => {
      set((state) => ({
        summary: state.summary.map((o) =>
          o.employee === emp ? { ...o, isChangeGiven: isGiven } : o
        ),
      }));

      try {
        const fn = httpsCallable(functions, 'saveEmployeePayment');
        await fn({
          employee: emp,
          isChangeGiven: isGiven,
          dateString: get().date,
        });
      } catch (err) {
        console.error('[setChangeGiven] failed:', err);
        await get().refreshSummary();
      }
    },

    // ── Confirm ──

    confirmRestaurant: async (restId) => {
      set({ loading: true });
      try {
        const fn = httpsCallable(functions, 'confirmRestaurantOrder');
        await fn({
          date: get().date,
          restId,
          byName: get().selectedEmployee || '系統',
        });
        await get().refreshSummary();
      } finally {
        set({ loading: false });
      }
    },

    cancelConfirm: async (restId) => {
      set({ loading: true });
      try {
        const fn = httpsCallable(functions, 'cancelRestaurantConfirmation');
        await fn({
          date: get().date,
          restId,
        });
        await get().refreshSummary();
      } finally {
        set({ loading: false });
      }
    },

    // ── Delete ──

    deleteOrder: async (orderId) => {
      set({ loading: true });
      try {
        const fn = httpsCallable(functions, 'deleteOrder');
        const res: any = await fn({ orderId: String(orderId) });
        await get().refreshSummary();
        set({ loading: false });
        return { message: res.data?.message };
      } catch (e: any) {
        set({ loading: false });
        return { message: '刪除失敗: ' + e.message };
      }
    },

    // ── Deposit ──

    depositBalance: async (amount) => {
      const emp = get().selectedEmployee;
      if (!emp) return { ok: false, error: '未選擇員工' };
      set({ loading: true });

      try {
        const fn = httpsCallable(functions, 'performDepositCallable');
        const res: any = await fn({ name: emp, amount });
        const newBal = Number(res.data);

        // 修正 Bug 8：儲值成功後依然保持 useBalance: false
        set({
          loading: false,
          balance: newBal,
          useBalance: false,
          depositAmount: '',
        });
        return { ok: true };
      } catch (err: any) {
        set({ loading: false });
        return { ok: false, error: err.message };
      }
    },

    // ── Update Note ──

    updateNote: async (orderId, newNote) => {
      set((state) => ({
        summary: state.summary.map((o) =>
          o.id === String(orderId) || o.rowNumber === orderId ? { ...o, note: newNote } : o
        ),
      }));

      try {
        const fn = httpsCallable(functions, 'updateOrderNote');
        await fn({ orderId: String(orderId), newNote });
        return { ok: true };
      } catch (e: any) {
        await get().refreshSummary();
        return { ok: false, error: e.message };
      }
    },

    // ── Quick Orders ──

    getQuickOrders: () => get().frequentOrders,

    fetchFrequentOrders: async (employee, restaurantId) => {
      set({ frequentOrdersLoading: true });
      try {
        const fn = httpsCallable(functions, 'getFrequentOrders');
        const res: any = await fn({ employeeName: employee, restaurantId });
        set({ frequentOrders: res.data || [], frequentOrdersLoading: false });
      } catch {
        set({ frequentOrders: [], frequentOrdersLoading: false });
      }
    },

    applyFrequentOrder: (fo) => {
      const state = get();
      // 名稱與餐廳比對
      const item = state.menuPayload?.items.find(
        (i) =>
          (String(i.id) === String(fo.itemId) || i.name === fo.itemName) &&
          i.restaurantId === state.selectedRestaurant
      );
      if (!item) return;

      let defaultFlavor: string[] = [];
      if (item.flavors) {
        const fArr = item.flavors
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
        if (fArr.length > 0) defaultFlavor = [fArr[0]];
      }

      let parsedPortion = item.portions?.[0]?.name || '';
      let parsedFlavors = defaultFlavor;
      let parsedExtras: string[] = [];
      let parsedSingleExtras: Record<string, string> = {};
      let remainingNotes: string[] = [];

      if (fo.note) {
        const parts = fo.note.split(/;\s*/);
        parts.forEach((p) => {
          const trimmed = p.trim();
          if (!trimmed) return;

          if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
            const portionName = trimmed.slice(1, -1).trim();
            if (item.portions?.some((x) => x.name === portionName)) {
              parsedPortion = portionName;
            } else {
              remainingNotes.push(trimmed);
            }
          } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            const flavorsStr = trimmed.slice(1, -1).trim();
            parsedFlavors = flavorsStr
              .split('/')
              .map((x) => x.trim())
              .filter(Boolean);
          } else if (trimmed.startsWith('加點:')) {
            const extrasStr = trimmed.substring(3).trim();
            const names = extrasStr
              .split('、')
              .map((x) => x.trim())
              .filter(Boolean);
            const allExtras =
              state.menuPayload?.extras.filter(
                (e) => e.restaurantId === state.selectedRestaurant
              ) || [];

            names.forEach((name) => {
              const matchedExtra = allExtras.find((e) => e.name === name);
              if (matchedExtra) {
                if (matchedExtra.type === 'single') {
                  parsedSingleExtras[matchedExtra.group] = String(matchedExtra.id);
                } else {
                  parsedExtras.push(String(matchedExtra.id));
                }
              }
            });
          } else {
            remainingNotes.push(trimmed);
          }
        });
      }

      set({
        selectedItem: item,
        selectedPortion: parsedPortion,
        selectedFlavors: parsedFlavors,
        selectedExtras: parsedExtras,
        selectedSingleExtras: parsedSingleExtras,
        quantity: 1,
        sweetness: fo.sweetness || '正常',
        ice: fo.ice || '正常',
        note: remainingNotes.join('; '),
      });
    },

    lockCategoryRestaurant: async (category, restaurantId) => {
      set({ loading: true });
      try {
        const fn = httpsCallable(functions, 'lockCategoryRestaurant');
        const res: any = await fn({
          date: get().date,
          category,
          restaurantId,
          lockedBy: get().selectedEmployee,
        });
        set({ locks: res.data?.locks || {}, loading: false });
        await get().refreshSummary();
        return { ok: true };
      } catch (e: any) {
        set({ loading: false });
        return { ok: false, error: e.message };
      }
    },

    unlockCategory: async (category) => {
      set({ loading: true });
      try {
        const fn = httpsCallable(functions, 'unlockCategory');
        const res: any = await fn({
          date: get().date,
          category,
        });
        set({ locks: res.data?.locks || {}, loading: false, selectedRestaurant: '' });
        await get().refreshSummary();
        return { ok: true };
      } catch (e: any) {
        set({ loading: false });
        return { ok: false, error: e.message };
      }
    },

    // ── Admin & Firebase Auth Actions ──

    loginWithGoogle: async () => {
      try {
        const provider = new GoogleAuthProvider();
        const res = await signInWithPopup(auth, provider);
        set({ adminUser: res.user, userRole: 'admin' });
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err.message };
      }
    },

    loginWithEmail: async (email: string, pass: string) => {
      try {
        const res = await signInWithEmailAndPassword(auth, email, pass);
        set({ adminUser: res.user, userRole: 'admin' });
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err.message };
      }
    },

    logoutAdmin: async () => {
      await signOut(auth);
      set({ adminUser: null, userRole: 'user', activeTab: 'order' });
    },

    checkUserRole: async (emp) => {
      if (get().adminUser) {
        set({ userRole: 'admin' });
        return;
      }
      try {
        const fn = httpsCallable(functions, 'getUserRoleCallable');
        const res: any = await fn({ name: emp });
        set({ userRole: res.data === 'admin' ? 'admin' : 'user' });
      } catch {
        set({ userRole: 'user' });
      }
    },

    loadAdminData: async () => {
      set({ adminLoading: true });
      try {
        const fn = httpsCallable(functions, 'getAdminData');
        const res: any = await fn({ adminName: get().selectedEmployee });
        set({ adminData: res.data, adminLoading: false });
      } catch (e) {
        set({ adminLoading: false });
      }
    },

    adminAddItem: async (data) => {
      set({ adminLoading: true });
      try {
        const fn = httpsCallable(functions, 'addMenuItem');
        await fn({ ...data, adminName: get().selectedEmployee });
        set({ adminLoading: false });
        await get().loadAdminData();
        await get().init(get().date);
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminAddRestaurant: async (data) => {
      set({ adminLoading: true });
      try {
        const fn = httpsCallable(functions, 'addRestaurant');
        await fn({ ...data, adminName: get().selectedEmployee });
        set({ adminLoading: false });
        await get().loadAdminData();
        await get().init(get().date);
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminUpdateItem: async (data) => {
      set({ adminLoading: true });
      try {
        const fn = httpsCallable(functions, 'updateMenuItem');
        await fn({ ...data, adminName: get().selectedEmployee });
        set({ adminLoading: false });
        await get().loadAdminData();
        await get().init(get().date);
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminDeactivateItem: async (restaurantId, itemId) => {
      set({ adminLoading: true });
      try {
        const fn = httpsCallable(functions, 'deactivateMenuItem');
        await fn({ restaurantId, itemId, adminName: get().selectedEmployee });
        set({ adminLoading: false });
        await get().loadAdminData();
        await get().init(get().date);
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminReactivateItem: async (restaurantId, itemId) => {
      set({ adminLoading: true });
      try {
        const fn = httpsCallable(functions, 'reactivateMenuItem');
        await fn({ restaurantId, itemId, adminName: get().selectedEmployee });
        set({ adminLoading: false });
        await get().loadAdminData();
        await get().init(get().date);
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminApplyChanges: async (restaurantId, changes) => {
      set({ adminLoading: true });
      try {
        const fn = httpsCallable(functions, 'applyMenuChanges');
        await fn({ restaurantId, changes, adminName: get().selectedEmployee });
        set({ adminLoading: false });
        await get().loadAdminData();
        await get().init(get().date);
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminSetSpecialPrice: async (data) => {
      set({ adminLoading: true });
      try {
        const fn = httpsCallable(functions, 'setSpecialPrice');
        await fn({ ...data, adminName: get().selectedEmployee });
        set({ adminLoading: false });
        await get().loadAdminData();
        await get().init(get().date);
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminRemoveSpecialPrice: async (restaurantId, itemId, portionName) => {
      set({ adminLoading: true });
      try {
        const fn = httpsCallable(functions, 'removeSpecialPrice');
        await fn({ restaurantId, itemId, portionName, adminName: get().selectedEmployee });
        set({ adminLoading: false });
        await get().loadAdminData();
        await get().init(get().date);
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminUpdateNewItemDisplayDays: async (days) => {
      try {
        const fn = httpsCallable(functions, 'updateNewItemDisplayDays');
        await fn({ days, adminName: get().selectedEmployee });
        set({ newItemDisplayDays: days });
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },
  };
});
