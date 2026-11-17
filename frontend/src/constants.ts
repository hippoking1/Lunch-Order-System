import type { Category } from './types';

export const CATEGORIES: Category[] = ['正餐', '飲料', '甜點'];

export const SWEETNESS_OPTIONS = [
  '正常',
  '7分糖',
  '5分糖',
  '3分糖',
  '1分糖',
  '無糖',
] as const;

export const ICE_OPTIONS = ['正常', '少冰', '微冰', '去冰', '熱'] as const;

// localStorage keys
export const LS_THEME_KEY = 'lunch-order-theme';
export const LS_QUICK_ORDER_KEY = 'lunch-order-quick';
export const LS_MENU_CACHE_KEY = 'lunch-order-menu-cache-v2';
export const LS_EMP_CACHE_KEY = 'lunch-order-emp-cache-v2';
export const LS_LAST_EMPLOYEE_KEY = 'lunch-order-last-emp';
