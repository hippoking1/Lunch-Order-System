import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupePortions,
  formatPortionsSummary,
  buildPortionDocId,
  planPortionSync,
  planDuplicatePortionsCleanup,
} from '../normalize.ts';
import { parseCsvMenuText } from '../csvMenuParser.ts';
import { parseMenuText } from '../menuParser.ts';

test('dedupePortions 去除重複份量並維持首次出現順序與最新價格', () => {
  const input = [
    { name: '杯', price: 55 },
    { name: '杯 ', price: 55 },
    { name: '瓶', price: 175 },
    { name: '瓶', price: 180 },
    { name: '  ', price: 10 },
  ];
  assert.deepEqual(dedupePortions(input), [
    { name: '杯', price: 55 },
    { name: '瓶', price: 180 },
  ]);
});

test('planPortionSync 清理舊隨機 ID、legacyItemId 與改名前 normalizedName 殘留並寫入確定性 ID', () => {
  const existingPortionDocs = [
    { id: 'rand_old_1', restaurantId: '4', menuItemId: 'item_903', normalizedName: '招牌奶茶', portionName: '杯', price: 55 },
    { id: 'rand_old_2', restaurantId: '4', menuItemId: 'item_903', normalizedName: '招牌奶茶', portionName: '瓶', price: 175 },
    { id: 'legacy_1', restaurantId: '4', legacyItemId: '903', portionName: '杯', price: 55 },
    { id: 'legacy_2', restaurantId: '4', legacyItemId: '903', portionName: '瓶', price: 175 },
    { id: 'other_item', restaurantId: '4', menuItemId: 'item_401', normalizedName: '老賴紅茶', portionName: '杯', price: 40 },
  ];

  const plan = planPortionSync({
    restaurantId: '4',
    menuItemId: 'item_903',
    itemName: '招牌奶茶(推薦)',
    previousItemName: '招牌奶茶',
    previousNormalizedName: '招牌奶茶',
    legacyItemId: '903',
    nextPortions: [
      { name: '杯', price: 55 },
      { name: '瓶', price: 185 },
    ],
    existingPortionDocs,
  });

  assert.deepEqual(plan.toDeleteIds.sort(), [
    'legacy_1',
    'legacy_2',
    'rand_old_1',
    'rand_old_2',
  ]);
  assert.equal(plan.toUpsert.length, 2);
  assert.equal(plan.toUpsert[0].docId, buildPortionDocId('4', 'item_903', '杯'));
  assert.equal(plan.toUpsert[1].price, 185);
});

test('planDuplicatePortionsCleanup 同步清除孤兒與重複 itemPortions 文件', () => {
  const plan = planDuplicatePortionsCleanup({
    survivingItems: [
      { id: 'doc_keep', restaurantId: '4', itemName: '招牌奶茶', normalizedName: '招牌奶茶', isActive: true },
    ],
    deletedMenuItemIds: new Set(['doc_dup']),
    portionDocs: [
      { id: 'p_keep_cup', restaurantId: '4', menuItemId: 'doc_keep', normalizedName: '招牌奶茶', portionName: '杯', price: 55 },
      { id: 'p_keep_cup_dup', restaurantId: '4', normalizedName: '招牌奶茶', portionName: '杯', price: 55 },
      { id: 'p_dup_item_cup', restaurantId: '4', menuItemId: 'doc_dup', normalizedName: '招牌奶茶', portionName: '杯', price: 55 },
      { id: 'p_orphan', restaurantId: '4', menuItemId: 'doc_gone', normalizedName: '已不存在品項', portionName: '大', price: 90 },
    ],
  });

  assert.deepEqual(plan.toDeleteIds.sort(), [
    'p_dup_item_cup',
    'p_keep_cup_dup',
    'p_orphan',
  ]);
});

test('parseCsvMenuText 能偵測重複份量修復、份量價格更新、以及雙表 CSV 移除份量', () => {
  const existingItems = [
    {
      id: 'doc_903',
      restaurantId: '4',
      name: '招牌奶茶',
      price: 55,
      category: '飲料',
      image: '',
      subCategory: '醇奶茶',
      flavors: '',
      portions: [
        { name: '杯', price: 55 },
        { name: '杯', price: 55 },
        { name: '瓶', price: 175 },
        { name: '瓶', price: 175 },
      ],
    },
    {
      id: 'doc_401',
      restaurantId: '4',
      name: '老賴紅茶',
      price: 40,
      category: '飲料',
      image: '',
      subCategory: '老賴招牌',
      flavors: '',
      portions: [
        { name: '杯', price: 40 },
        { name: '瓶', price: 130 },
      ],
    },
  ];

  // 雙表格 CSV：招牌奶茶修正為單組杯/瓶（且 CSV 刻意重複一行驗證去重）；老賴紅茶從份量表移除代表改為單一固定價
  const csv = `RestaurantID,ItemID,SubCategory,ItemName,Flavors,Price
1,903,醇奶茶,招牌奶茶,,55
1,401,老賴招牌,老賴紅茶,,40

RestaurantID,ItemID,PortionName,Price
1,903,杯,55
1,903,杯,55
1,903,瓶,175`;

  const parsed = parseCsvMenuText(csv, existingItems, '4', '飲料');
  const milkTea = parsed.find((x) => x.name === '招牌奶茶');
  const blackTea = parsed.find((x) => x.name === '老賴紅茶');

  assert.ok(milkTea);
  assert.equal(milkTea.changeType, 'update');
  assert.deepEqual(milkTea.portions, [
    { name: '杯', price: 55 },
    { name: '瓶', price: 175 },
  ]);

  assert.ok(blackTea);
  assert.equal(blackTea.changeType, 'update');
  assert.deepEqual(blackTea.portions, []);
  assert.ok(blackTea.fieldDiffs?.some((d) => d.field === 'portions'));
});

test('parseCsvMenuText 單表格 CSV（無 PortionName 表）保留既有份量不誤刪', () => {
  const existingItems = [
    {
      id: 'doc_903',
      restaurantId: '4',
      name: '招牌奶茶',
      price: 55,
      category: '飲料',
      image: '',
      subCategory: '醇奶茶',
      flavors: '',
      portions: [
        { name: '杯', price: 55 },
        { name: '瓶', price: 175 },
      ],
    },
  ];

  const csvOnlyItems = `RestaurantID,ItemID,SubCategory,ItemName,Flavors,Price
1,903,醇奶茶,招牌奶茶,,55`;

  const parsed = parseCsvMenuText(csvOnlyItems, existingItems, '4', '飲料');
  assert.equal(parsed[0].changeType, 'unchanged');
  assert.deepEqual(parsed[0].portions, [
    { name: '杯', price: 55 },
    { name: '瓶', price: 175 },
  ]);
});

test('parseMenuText 支援 杯/瓶 單位解析與去重', () => {
  const parsed = parseMenuText(
    '招牌奶茶 杯$55 瓶$175',
    [],
    '4',
    '飲料',
  );
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, '招牌奶茶');
  assert.deepEqual(parsed[0].portions, [
    { name: '杯', price: 55 },
    { name: '瓶', price: 175 },
  ]);
  assert.equal(formatPortionsSummary(parsed[0].portions), '杯:$55, 瓶:$175');
});
