// ── 餐廳 ──
export type Category = '正餐' | '飲料' | '甜點';

export interface Restaurant {
  id: string;
  name: string;
  category: Category;
  telephone?: string;
  isActive?: boolean;
  sweetnessOptions?: string[] | null;
  iceOptions?: string[] | null;
  createdAt?: string;
}

export interface RestaurantTelephone {
  name: string;
  telephone: string;
}

// ── 菜單 ──
export interface Portion {
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  price: number;
  category: string;
  image: string;
  subCategory: string;
  flavors: string;
  portions: Portion[];
  // Limited item fields
  limitedType?: string;
  startDate?: string;
  endDate?: string;
  // Virtual fields for custom items
  isCustom?: boolean;
  customName?: string;
  customPrice?: number;
  createdAt?: string;
}

export interface Extra {
  id: string;
  restaurantId: string;
  name: string;
  price: number;
  type: 'single' | 'extra';
  group: string;
}

export interface MenuPayload {
  restaurants: Restaurant[];
  items: MenuItem[];
  extras: Extra[];
  specialPrices?: SpecialPrice[];
  newItemDisplayDays?: number;
}

// ── 訂單 ──
export interface OrderRecord {
  id: string;
  rowNumber: number | string;
  employee: string;
  restaurantId: string;
  item: string;
  category: string;
  subCategory: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sweetness: string;
  ice: string;
  note: string;
  paidAmount: number | '';
  changeAmount: number | '';
  isChangeGiven: boolean;
  isPaidByBalance?: boolean;
  createdAt: string;
}

export interface Confirmation {
  confirmedBy: string;
  confirmedAt: string;
}

export interface LockRecord {
  restaurantId: string;
  lockedBy: string;
  lockedAt: string;
}

// ── 初始資料 ──
export interface InitialData {
  date: string;
  telephones: Record<string, RestaurantTelephone>;
  employees: string[];
  summary: OrderRecord[];
  menuPayload: MenuPayload;
  confirmations: Record<string, Confirmation>;
  locks?: Record<string, LockRecord>;
}

// ── 送出訂單 ──
export interface OrderPayloadItem {
  itemId: string;
  itemName: string;
  quantity: number;
  originalPrice: number;
  unitPrice: number;
  portionName: string;
  totalPrice: number;
  sweetness: string;
  ice: string;
  note: string;
  isCustom?: boolean;
  customName?: string;
  customPrice?: number;
}

export interface OrderPayload {
  date: string;
  employeeName: string;
  restaurantId: string;
  useBalance: boolean;
  items: OrderPayloadItem[];
}

// ── 對帳 ──
export interface PaymentData {
  employee: string;
  paidAmount?: number;
  changeAmount?: number;
  isChangeGiven?: boolean;
  dateString: string;
}

// ── UI 狀態 ──
export type AppTab = 'order' | 'summary' | 'recon' | 'admin';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

// ── 管理功能 ──

export interface SpecialPrice {
  id?: string;
  restaurantId: string;
  itemId?: string;
  itemName: string;
  portionName: string;
  originalPrice: number;
  specialPrice: number;
  startDate: string;
  endDate: string;
  label: string;
  isActive: boolean;
}

export interface AdminData {
  menuPayload: MenuPayload;
  specialPrices: SpecialPrice[];
}

export interface FieldDiff {
  field: string;
  label: string;
  oldVal: string | number;
  newVal: string | number;
}

export interface ParsedMenuItem {
  itemId?: string;
  restaurantId?: string;
  name: string;
  price: number;
  category: string;
  subCategory: string;
  flavors?: string;
  portions: Portion[];
  changeType: 'add' | 'update' | 'remove' | 'sale' | 'unchanged';
  oldPrice?: number;
  oldSubCategory?: string;
  oldFlavors?: string;
  oldPortions?: Portion[];
  matchedItemId?: string;
  limitedType?: string;
  saleLabel?: string;
  fieldDiffs?: FieldDiff[];
}

// ── 常用點餐記錄 (from server) ──
export interface FrequentOrderEntry {
  itemId: string;
  itemName: string;
  unitPrice: number;
  note: string;
  sweetness: string;
  ice: string;
  count: number;
}
