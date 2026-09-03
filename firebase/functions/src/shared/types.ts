export type Category = '正餐' | '飲料' | '甜點';

export interface Portion {
  name: string;
  price: number;
}

export interface MenuItemDoc {
  id?: string;
  restaurantId: string;
  itemName: string;
  normalizedName: string;
  price: number;
  category: string;
  subCategory?: string;
  image?: string;
  flavors?: string;
  isExtra?: boolean;
  extraGroup?: string;
  extraType?: 'single' | 'extra';
  isActive: boolean;
  limitedType?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  legacyItemId?: string;
}

export interface RestaurantDoc {
  id: string;
  name: string;
  category: Category;
  telephone?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface OrderDoc {
  id?: string;
  date: string;
  employeeName: string;
  restaurantId: string;
  itemName: string;
  category?: string;
  subCategory?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sweetness?: string;
  ice?: string;
  note?: string;
  paidAmount: number | null;
  changeAmount: number | null;
  isChangeGiven: boolean;
  isPaidByBalance: boolean;
  createdAt: string;
  legacyItemId?: string;
  legacyRowNumber?: number;
}

export interface UserDoc {
  name: string;
  balance: number;
  role: 'admin' | 'user';
  email?: string;
  updatedAt?: string;
}

export interface SpecialPriceDoc {
  id?: string;
  restaurantId: string;
  menuItemId?: string;
  itemName: string;
  portionName?: string;
  originalPrice: number;
  specialPrice: number;
  startDate?: string;
  endDate?: string;
  label?: string;
  isActive: boolean;
}

export interface ConfirmationDoc {
  date: string;
  restaurantId: string;
  confirmedBy: string;
  confirmedAt: string;
}

export interface CategoryLockDoc {
  date: string;
  category: string;
  restaurantId: string;
  lockedBy: string;
  lockedAt: string;
}
