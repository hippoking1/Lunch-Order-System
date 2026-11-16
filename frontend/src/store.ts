import { create } from 'zustand';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import type { Unsubscribe } from 'firebase/firestore';
import { auth } from './firebase';
import {
  getTodayDateString,
  loadCatalogWithCache,
  filterActiveMenuForDate,
  subscribeDailyRealtime,
  fetchDailyStateOnce,
  getEmployeeInfoApi,
  getUserRoleApi,
  submitOrderApi,
  deleteOrderApi,
  performDepositApi,
  saveEmployeePaymentApi,
  updateOrderNoteApi,
  getFrequentOrdersApi,
  lockCategoryRestaurantApi,
  unlockCategoryApi,
  confirmRestaurantOrderApi,
  cancelRestaurantConfirmationApi,
  readFullMenuFromCollections,
  rebuildCatalogBundleFromFirestore,
  addRestaurantApi,
  updateRestaurantApi,
  toggleRestaurantActiveApi,
  updateRestaurantCustomOptionsApi,
  addOrUpdateMenuItemApi,
  setMenuItemActiveApi,
  applyMenuChangesApi,
  setSpecialPriceApi,
  removeSpecialPriceApi,
  updateNewItemDisplayDaysApi,
  cleanupDuplicateMenuItemsApi,
} from './services/firestoreApi';
import type {
  AdminData,
  AppTab,
  Confirmation,
  Extra,
  FrequentOrderEntry,
  LockRecord,
  MenuItem,
  MenuPayload,
  OrderPayload,
  OrderRecord,
  Restaurant,
  RestaurantTelephone,
} from './types';

// 解析「X選Y」規則的 Helper 函數
export function getFreeExtrasCount(itemName: string): number | null {
  const chineseToNum: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  const match = itemName.match(
    /(?:配料區)?([一二三四五六七八九十\d]+)選([一二三四五六七八九十\d]+)/,
  );
  if (match) {
    const selectStr = match[2];
    const count = chineseToNum[selectStr] || parseInt(selectStr, 10);
    if (!isNaN(count)) return count;
  }
  return null;
}

// 判斷餐廳或餐點是否為「飲料」（只有餐廳是飲料店，或該餐點本身/子分類屬於飲料時才顯示甜度與冰塊）
export function isDrinkItem(
  item: MenuItem | null | undefined,
  restaurant: Restaurant | null | undefined,
  selectedCategory?: string,
): boolean {
  const restCat = (restaurant?.category || selectedCategory || '').trim();
  if (restCat === '飲料') return true;
  if (!item) return false;
  const sub = (item.subCategory || '').trim();
  const cat = (item.category || '').trim();
  if (sub) {
    return /^(飲料|飲品)$/.test(sub);
  }
  return cat === '飲料' || cat === '飲品';
}

// ── Types ──────────────────────────────────────────

interface AdminMutationOptions {
  skipSync?: boolean;
}

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
  allRestaurants: Restaurant[];

  // Actions
  init: (dateStr?: string) => Promise<void>;
  cleanupRealtime: () => void;
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
  lockCategoryRestaurant: (
    category: string,
    restaurantId: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  unlockCategory: (
    category: string,
  ) => Promise<{ ok: boolean; error?: string }>;

  // Admin & Auth actions
  loginWithGoogle: () => Promise<{ ok: boolean; error?: string; code?: string }>;
  loginWithGoogleRedirect: () => Promise<void>;
  loginWithEmail: (
    email: string,
    pass: string,
  ) => Promise<{ ok: boolean; error?: string; code?: string }>;
  logoutAdmin: () => Promise<void>;
  checkUserRole: (emp: string) => Promise<void>;
  loadAdminData: () => Promise<void>;
  syncCatalogCache: () => Promise<void>;
  adminAddItem: (
    data: Record<string, unknown>,
    opts?: AdminMutationOptions,
  ) => Promise<{ ok: boolean; error?: string }>;
  adminAddRestaurant: (data: {
    name: string;
    category: string;
    telephone?: string;
  }) => Promise<{ ok: boolean; restaurantId?: string; error?: string }>;
  adminUpdateRestaurant: (data: {
    restaurantId: string;
    name?: string;
    category?: string;
    telephone?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  adminToggleRestaurantActive: (
    restaurantId: string,
    isActive: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  adminUpdateItem: (
    data: Record<string, unknown>,
  ) => Promise<{ ok: boolean; error?: string }>;
  adminDeactivateItem: (
    restaurantId: string,
    itemId: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  adminReactivateItem: (
    restaurantId: string,
    itemId: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  adminApplyChanges: (
    restaurantId: string,
    changes: unknown[],
  ) => Promise<{ ok: boolean; error?: string }>;
  adminSetSpecialPrice: (
    data: Record<string, unknown>,
  ) => Promise<{ ok: boolean; error?: string }>;
  adminRemoveSpecialPrice: (
    restaurantId: string,
    itemId: string,
    portionName: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  adminUpdateNewItemDisplayDays: (
    days: number,
  ) => Promise<{ ok: boolean; error?: string }>;
  adminAddExtra: (
    data: {
      restaurantId: string;
      name: string;
      price: number;
      group?: string;
      type?: 'extra' | 'single';
    },
    opts?: AdminMutationOptions,
  ) => Promise<{ ok: boolean; error?: string }>;
  adminUpdateExtra: (data: {
    id: string;
    restaurantId?: string;
    name?: string;
    price?: number;
    group?: string;
    type?: 'extra' | 'single';
  }) => Promise<{ ok: boolean; error?: string }>;
  adminDeleteExtra: (
    id: string,
    restaurantId?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  adminUpdateRestaurantCustomOptions: (data: {
    restaurantId: string;
    sweetnessOptions?: string[];
    iceOptions?: string[];
  }) => Promise<{ ok: boolean; error?: string }>;
  adminCleanupDuplicates: (
    restaurantId?: string,
  ) => Promise<{ ok: boolean; deletedCount?: number; error?: string }>;
}

// ── Realtime Subscription Tracker ─────────────────────

let activeDailyUnsubscribe: Unsubscribe | null = null;
let activeSubscribedDate = '';

// ── Store ─────────────────────────────────────────────

export const useStore = create<AppState>((set, get) => {
  onAuthStateChanged(auth, (user) => {
    set({ adminUser: user });
    if (user) {
      set({ userRole: 'admin' });
    }
  });

  getRedirectResult(auth)
    .then((res) => {
      if (res?.user) {
        set({ adminUser: res.user, userRole: 'admin' });
      }
    })
    .catch((err) => {
      console.warn('[Auth] getRedirectResult failed:', err);
    });

  const applyRebuiltCatalog = async () => {
    const { raw } = await rebuildCatalogBundleFromFirestore();
    const filtered = filterActiveMenuForDate(
      raw,
      get().date || getTodayDateString(),
    );
    set({
      menuPayload: filtered.menuPayload,
      allRestaurants: filtered.allRestaurants,
      telephones: filtered.telephones,
      newItemDisplayDays: filtered.newItemDisplayDays,
      adminData: {
        menuPayload: filtered.menuPayload,
        specialPrices: filtered.menuPayload.specialPrices || [],
      },
    });
  };

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
    useBalance: false,
    customItemName: '',
    customItemPrice: '',

    userRole: 'user',
    adminUser: null,
    adminData: null,
    adminLoading: false,
    newItemDisplayDays: 7,
    allRestaurants: [],
    frequentOrders: [],
    frequentOrdersLoading: false,

    // ── Init & Realtime Subscription ──

    init: async (dateStr?: string) => {
      const targetDate = dateStr || getTodayDateString();
      set({ loading: true, date: targetDate });

      try {
        const catalog = await loadCatalogWithCache(targetDate);
        const defaultCategory = get().selectedCategory || '正餐';

        set({
          initialized: true,
          loading: false,
          date: targetDate,
          telephones: catalog.telephones,
          employees: catalog.employees,
          menuPayload: catalog.menuPayload,
          allRestaurants: catalog.allRestaurants,
          newItemDisplayDays: catalog.newItemDisplayDays,
          selectedCategory: defaultCategory,
        });

        // 切換日期或首次啟動時建立當日即時監聽 (onSnapshot)
        if (!activeDailyUnsubscribe || activeSubscribedDate !== targetDate) {
          if (activeDailyUnsubscribe) {
            activeDailyUnsubscribe();
            activeDailyUnsubscribe = null;
          }
          activeSubscribedDate = targetDate;

          let isFirstLocksSnapshot = true;
          activeDailyUnsubscribe = subscribeDailyRealtime(targetDate, {
            onOrders: (orders) => {
              if (get().date === targetDate) {
                set({ summary: orders });
              }
            },
            onConfirmations: (confirmations) => {
              if (get().date === targetDate) {
                set({ confirmations });
              }
            },
            onLocks: (locks) => {
              if (get().date === targetDate) {
                const updates: Partial<AppState> = { locks };
                if (isFirstLocksSnapshot && !get().selectedRestaurant) {
                  const cat = get().selectedCategory || '正餐';
                  const lockedId = locks[cat]?.restaurantId || '';
                  if (lockedId) updates.selectedRestaurant = lockedId;
                }
                isFirstLocksSnapshot = false;
                set(updates);
              }
            },
            onError: (err) => {
              console.error('[subscribeDailyRealtime] error:', err);
            },
          });
        }
      } catch (err) {
        console.error('[init] failed:', err);
        set({ initialized: true, loading: false });
      }
    },

    cleanupRealtime: () => {
      if (activeDailyUnsubscribe) {
        activeDailyUnsubscribe();
        activeDailyUnsubscribe = null;
        activeSubscribedDate = '';
      }
    },

    setLoading: (l) => set({ loading: l }),
    setActiveTab: (tab) => set({ activeTab: tab }),
    setSearchQuery: (q) => set({ searchQuery: q }),
    setDepositAmount: (v) => set({ depositAmount: v }),

    // ── Employee ──

    setEmployee: async (emp) => {
      const trimmedEmp = emp.trim();
      set({ selectedEmployee: emp, balance: null, useBalance: false });

      if (trimmedEmp && get().employees.includes(trimmedEmp)) {
        try {
          const info = await getEmployeeInfoApi(
            trimmedEmp,
            get().adminUser?.email,
          );
          if (get().selectedEmployee.trim() === trimmedEmp) {
            const role =
              info.role === 'admin' || get().adminUser !== null
                ? 'admin'
                : 'user';
            set({ balance: info.balance, useBalance: false, userRole: role });
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
      const emp = get().selectedEmployee.trim();
      if (emp && restId && get().employees.includes(emp)) {
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
      if (
        !state.selectedEmployee ||
        !state.selectedRestaurant ||
        !state.selectedItem
      ) {
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
        state.menuPayload?.extras.filter(
          (e) => e.restaurantId === state.selectedRestaurant,
        ) || [];

      Object.values(state.selectedSingleExtras).forEach((eid) => {
        if (!eid) return;
        const e = allExtras.find((x) => String(x.id) === String(eid));
        if (e) {
          extrasTotal += e.price;
          extrasNames.push(e.name);
        }
      });

      const multipleExtrasList: { id: string; name: string; price: number }[] =
        [];
      state.selectedExtras.forEach((eid) => {
        const e = allExtras.find((x) => String(x.id) === String(eid));
        if (e) {
          multipleExtrasList.push({
            id: String(e.id),
            name: e.name,
            price: e.price,
          });
          extrasNames.push(e.name);
        }
      });

      const freeCount = getFreeExtrasCount(item.name);
      if (freeCount !== null) {
        const sortedList = [...multipleExtrasList].sort(
          (a, b) => b.price - a.price,
        );
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
      if (state.selectedFlavors.length > 0)
        noteArr.push(`[${state.selectedFlavors.join('/')}]`);
      if (state.note) noteArr.push(state.note);
      if (extrasNames.length > 0)
        noteArr.push(`加點:${extrasNames.join('、')}`);

      const currentRest = state.menuPayload?.restaurants.find(
        (r) => r.id === state.selectedRestaurant,
      );
      const isDrink = isDrinkItem(item, currentRest, state.selectedCategory);

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
            sweetness: isDrink ? state.sweetness : '',
            ice: isDrink ? state.ice : '',
            note: noteArr.join('; '),
            isCustom: item.isCustom,
            customName: item.customName,
            customPrice: item.customPrice,
          },
        ],
      };

      set({ loading: true });
      try {
        const res = await submitOrderApi(payload, {
          category: item.category || currentRest?.category || state.selectedCategory,
          subCategory: item.subCategory || '',
        });

        set({
          selectedRestaurant: '',
          selectedItem: null,
          customItemName: '',
          customItemPrice: '',
          quantity: 1,
          useBalance: false,
          loading: false,
          ...(res.newBalance !== null ? { balance: res.newBalance } : {}),
        });
        return { ok: true };
      } catch (e: any) {
        set({ loading: false });
        return { ok: false, error: e.message };
      }
    },

    // ── Summary (輕量當日刷新，不再重讀菜單與員工) ──

    refreshSummary: async () => {
      try {
        const targetDate = get().date || getTodayDateString();
        const daily = await fetchDailyStateOnce(targetDate);
        set({
          summary: daily.summary,
          confirmations: daily.confirmations,
          locks: daily.locks,
        });
      } catch (err) {
        console.error('[refreshSummary] failed:', err);
      }
    },

    // ── Payment ──

    savePayment: async (emp, paid, change) => {
      set((state) => ({
        summary: state.summary.map((o) =>
          o.employee === emp
            ? { ...o, paidAmount: paid, changeAmount: change }
            : o,
        ),
      }));

      try {
        await saveEmployeePaymentApi({
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
          o.employee === emp ? { ...o, isChangeGiven: isGiven } : o,
        ),
      }));

      try {
        await saveEmployeePaymentApi({
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
        const restCat = get().menuPayload?.restaurants.find(
          (r) => r.id === restId,
        )?.category;
        await confirmRestaurantOrderApi(
          get().date,
          restId,
          get().selectedEmployee || '系統',
          restCat,
        );
      } finally {
        set({ loading: false });
      }
    },

    cancelConfirm: async (restId) => {
      set({ loading: true });
      try {
        await cancelRestaurantConfirmationApi(get().date, restId);
      } finally {
        set({ loading: false });
      }
    },

    // ── Delete ──

    deleteOrder: async (orderId) => {
      set({ loading: true });
      try {
        const res = await deleteOrderApi(String(orderId));
        if (
          res.refundedEmployee &&
          res.refundedEmployee === get().selectedEmployee.trim() &&
          get().balance !== null &&
          res.refundAmount
        ) {
          set({ balance: (get().balance ?? 0) + res.refundAmount });
        }
        set({ loading: false });
        return { message: res.message };
      } catch (e: any) {
        set({ loading: false });
        return { message: '刪除失敗: ' + e.message };
      }
    },

    // ── Deposit ──

    depositBalance: async (amount) => {
      const emp = get().selectedEmployee.trim();
      if (!emp) return { ok: false, error: '未選擇員工' };
      set({ loading: true });

      try {
        const res = await performDepositApi(emp, amount, get().employees);
        set({
          loading: false,
          balance: res.newBalance,
          useBalance: false,
          depositAmount: '',
          ...(res.updatedEmployees ? { employees: res.updatedEmployees } : {}),
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
          o.id === String(orderId) || o.rowNumber === orderId
            ? { ...o, note: newNote }
            : o,
        ),
      }));

      try {
        await updateOrderNoteApi(String(orderId), newNote);
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
        const list = await getFrequentOrdersApi(employee, restaurantId);
        set({ frequentOrders: list, frequentOrdersLoading: false });
      } catch {
        set({ frequentOrders: [], frequentOrdersLoading: false });
      }
    },

    applyFrequentOrder: (fo) => {
      const state = get();
      const item = state.menuPayload?.items.find(
        (i) =>
          (String(i.id) === String(fo.itemId) || i.name === fo.itemName) &&
          i.restaurantId === state.selectedRestaurant,
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
      const remainingNotes: string[] = [];

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
                (e) => e.restaurantId === state.selectedRestaurant,
              ) || [];

            names.forEach((name) => {
              const matchedExtra = allExtras.find((e) => e.name === name);
              if (matchedExtra) {
                if (matchedExtra.type === 'single') {
                  parsedSingleExtras[matchedExtra.group] = String(
                    matchedExtra.id,
                  );
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
        await lockCategoryRestaurantApi(
          get().date,
          category,
          restaurantId,
          get().selectedEmployee,
        );
        set({ loading: false });
        return { ok: true };
      } catch (e: any) {
        set({ loading: false });
        return { ok: false, error: e.message };
      }
    },

    unlockCategory: async (category) => {
      set({ loading: true });
      try {
        await unlockCategoryApi(get().date, category);
        set({ loading: false, selectedRestaurant: '' });
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
        provider.setCustomParameters({ prompt: 'select_account' });
        const res = await signInWithPopup(auth, provider);
        set({ adminUser: res.user, userRole: 'admin' });
        return { ok: true };
      } catch (err: any) {
        let msg = err.message || 'Google 登入失敗';
        if (err.code === 'auth/popup-closed-by-user') {
          msg =
            '登入視窗已關閉或取消。若非您主動關閉，可能是瀏覽器阻擋了彈窗或第三方 Cookie，建議點擊下方「改用網頁重新導向登入」或使用 Email 登入。';
        } else if (err.code === 'auth/popup-blocked') {
          msg =
            '瀏覽器封鎖了彈出式登入視窗，請允許本網站的彈出視窗，或點擊下方「改用網頁重新導向登入」。';
        } else if (err.code === 'auth/unauthorized-domain') {
          msg =
            '當前網址未加入 Firebase 授權網域 (Authorized Domains)！請至 Firebase Console > Authentication > Settings 新增。';
        } else if (err.code === 'auth/cancelled-popup-request') {
          msg = '已開啟新的登入請求，前一個視窗已關閉。';
        }
        return { ok: false, error: msg, code: err.code };
      }
    },

    loginWithGoogleRedirect: async () => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithRedirect(auth, provider);
    },

    loginWithEmail: async (email: string, pass: string) => {
      try {
        const res = await signInWithEmailAndPassword(auth, email, pass);
        set({ adminUser: res.user, userRole: 'admin' });
        return { ok: true };
      } catch (err: any) {
        let msg = err.message || '登入失敗';
        if (
          err.code === 'auth/invalid-credential' ||
          err.code === 'auth/wrong-password' ||
          err.code === 'auth/user-not-found'
        ) {
          msg = '管理員帳號或密碼錯誤，請確認後重試。';
        } else if (err.code === 'auth/invalid-email') {
          msg = 'Email 格式不正確。';
        } else if (err.code === 'auth/user-disabled') {
          msg = '此管理員帳號已被停用。';
        }
        return { ok: false, error: msg, code: err.code };
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
        const role = await getUserRoleApi(emp, null);
        set({ userRole: role });
      } catch {
        set({ userRole: 'user' });
      }
    },

    loadAdminData: async () => {
      set({ adminLoading: true });
      try {
        const raw = await readFullMenuFromCollections();
        const filtered = filterActiveMenuForDate(
          raw,
          get().date || getTodayDateString(),
        );
        set({
          adminData: {
            menuPayload: filtered.menuPayload,
            specialPrices: filtered.menuPayload.specialPrices || [],
          },
          allRestaurants: raw.allRestaurants,
          newItemDisplayDays: raw.newItemDisplayDays,
          adminLoading: false,
        });
      } catch (e) {
        console.error('[loadAdminData] failed:', e);
        set({ adminLoading: false });
      }
    },

    syncCatalogCache: async () => {
      await applyRebuiltCatalog();
    },

    adminAddItem: async (data, opts) => {
      if (!opts?.skipSync) set({ adminLoading: true });
      try {
        await addOrUpdateMenuItemApi(data);
        if (!opts?.skipSync) {
          await applyRebuiltCatalog();
          set({ adminLoading: false });
        }
        return { ok: true };
      } catch (e: any) {
        if (!opts?.skipSync) set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminAddRestaurant: async (data) => {
      set({ adminLoading: true });
      try {
        const restaurantId = await addRestaurantApi(data);
        await applyRebuiltCatalog();
        set({ adminLoading: false });
        return { ok: true, restaurantId };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminUpdateRestaurant: async (data) => {
      set({ adminLoading: true });
      try {
        await updateRestaurantApi(data);
        await applyRebuiltCatalog();
        set({ adminLoading: false });
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminToggleRestaurantActive: async (restaurantId, isActive) => {
      set({ adminLoading: true });
      try {
        await toggleRestaurantActiveApi(restaurantId, isActive);
        await applyRebuiltCatalog();
        set({ adminLoading: false });
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminUpdateItem: async (data) => {
      set({ adminLoading: true });
      try {
        await addOrUpdateMenuItemApi(data);
        await applyRebuiltCatalog();
        set({ adminLoading: false });
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminDeactivateItem: async (restaurantId, itemId) => {
      set({ adminLoading: true });
      try {
        await setMenuItemActiveApi(restaurantId, itemId, false);
        await applyRebuiltCatalog();
        set({ adminLoading: false });
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminReactivateItem: async (restaurantId, itemId) => {
      set({ adminLoading: true });
      try {
        await setMenuItemActiveApi(restaurantId, itemId, true);
        await applyRebuiltCatalog();
        set({ adminLoading: false });
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminApplyChanges: async (restaurantId, changes) => {
      set({ adminLoading: true });
      try {
        await applyMenuChangesApi(
          restaurantId,
          changes as Array<Record<string, any>>,
          get().allRestaurants,
        );
        await applyRebuiltCatalog();
        set({ adminLoading: false });
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminSetSpecialPrice: async (data) => {
      set({ adminLoading: true });
      try {
        const itemId = String(data.itemId || '');
        const restId = String(data.restaurantId || '');
        const matchedItem = get().menuPayload?.items.find(
          (i) => i.id === itemId && i.restaurantId === restId,
        );
        await setSpecialPriceApi({
          ...(data as any),
          itemName: String(data.itemName || matchedItem?.name || ''),
        });
        await applyRebuiltCatalog();
        set({ adminLoading: false });
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminRemoveSpecialPrice: async (restaurantId, itemId, portionName) => {
      set({ adminLoading: true });
      try {
        await removeSpecialPriceApi(restaurantId, itemId, portionName);
        await applyRebuiltCatalog();
        set({ adminLoading: false });
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminUpdateNewItemDisplayDays: async (days) => {
      try {
        await updateNewItemDisplayDaysApi(days);
        await applyRebuiltCatalog();
        set({ newItemDisplayDays: days });
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },

    adminAddExtra: async (data, opts) => {
      if (!opts?.skipSync) set({ adminLoading: true });
      try {
        await addOrUpdateMenuItemApi({
          restaurantId: data.restaurantId,
          itemName: data.name,
          price: data.price,
          isExtra: true,
          extraGroup: data.group || '加點',
          extraType: data.type || 'extra',
          category: '加點',
        });
        if (!opts?.skipSync) {
          await applyRebuiltCatalog();
          set({ adminLoading: false });
        }
        return { ok: true };
      } catch (e: any) {
        if (!opts?.skipSync) set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminUpdateExtra: async (data) => {
      set({ adminLoading: true });
      try {
        await addOrUpdateMenuItemApi({
          restaurantId: data.restaurantId,
          itemId: data.id,
          itemName: data.name,
          price: data.price,
          isExtra: true,
          extraGroup: data.group,
          extraType: data.type,
        });
        await applyRebuiltCatalog();
        set({ adminLoading: false });
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminDeleteExtra: async (id, restaurantId) => {
      set({ adminLoading: true });
      try {
        await setMenuItemActiveApi(restaurantId, id, false);
        await applyRebuiltCatalog();
        set({ adminLoading: false });
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminUpdateRestaurantCustomOptions: async (data) => {
      set({ adminLoading: true });
      try {
        await updateRestaurantCustomOptionsApi(data);
        await applyRebuiltCatalog();
        set({ adminLoading: false });
        return { ok: true };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },

    adminCleanupDuplicates: async (restaurantId) => {
      set({ adminLoading: true });
      try {
        const res = await cleanupDuplicateMenuItemsApi(restaurantId);
        await applyRebuiltCatalog();
        set({ adminLoading: false });
        return { ok: true, deletedCount: res.deletedCount };
      } catch (e: any) {
        set({ adminLoading: false });
        return { ok: false, error: e.message };
      }
    },
  };
});
