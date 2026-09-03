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
