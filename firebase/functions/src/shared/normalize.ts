/**
 * 品項名稱正規化
 * 1. 移除所有空白字元
 * 2. 全形英數轉半形
 * 3. 全形括號、標點轉半形 (（）-> (), 【】-> [], ，-> ,, ：-> :)
 * 4. 轉小寫
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .replace(/\s+/g, '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 65248)
    )
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/【/g, '[')
    .replace(/】/g, ']')
    .replace(/，/g, ',')
    .replace(/：/g, ':')
    .toLowerCase();
}

/**
 * 提取品項核心名稱（去除品名後方或內部的括號 ()、（） 及其說明文字）
 * 例如：
 * "紅心芭樂烏龍 (最低微冰)" -> "紅心芭樂烏龍"
 * "青檸青茶（最低微糖微冰）" -> "青檸青茶"
 * "玄米蕎麥 (固定無糖)" -> "玄米蕎麥"
 */
export function getBaseItemName(name: string): string {
  if (!name) return '';
  return name.replace(/[（(].*?[）)]/g, '').trim();
}
