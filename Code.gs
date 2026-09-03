/**** Web App入口 ****/
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}

/**** Helpers ****/
function _ss() { return SpreadsheetApp.getActive(); }
function _orders() { const sh = _ss().getSheetByName('Orders'); if (!sh) throw new Error('缺少 Orders 工作表'); return sh; }
function _menu() { const sh = _ss().getSheetByName('MenuItems'); if (!sh) throw new Error('缺少 MenuItems 工作表'); return sh; }
function _restaurants() { const sh = _ss().getSheetByName('Restaurants'); if (!sh) throw new Error('缺少 Restaurants 工作表'); return sh; }
function _users() { const sh = _ss().getSheetByName('Users'); if (!sh) throw new Error('缺少 Users 工作表'); return sh; }

// 新增: 份量獨立工作表 (加入 RestaurantID)
function _portions() { 
  const ss = _ss(); 
  let sh = ss.getSheetByName('ItemPortions'); 
  if (!sh) { 
    sh = ss.insertSheet('ItemPortions'); 
    // 欄位定義更新：加入 RestaurantID
    sh.appendRow(['RestaurantID', 'ItemID', 'PortionName', 'Price']); 
  } 
  return sh; 
}
function _confirmSheet() {
  const ss = _ss(); let sh = ss.getSheetByName('Confirmations');
  if (!sh) { sh = ss.insertSheet('Confirmations'); sh.appendRow(['Date', 'RestaurantID', 'ConfirmedBy', 'ConfirmedAt']); }
  return sh;
}
function _settings() {
  const ss = _ss(); let sh = ss.getSheetByName('Settings');
  if (!sh) { sh = ss.insertSheet('Settings'); sh.appendRow(['Key', 'Value']); sh.appendRow(['NewItemDisplayDays', 7]); }
  return sh;
}

function getTodayDateString() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function _normDate(val) {
  const tz = Session.getScriptTimeZone();
  if (val instanceof Date && !isNaN(val)) return Utilities.formatDate(val, tz, 'yyyy-MM-dd');
  const s = String(val || ''); const m = s.match(/^(\d{4}-\d{2}-\d{2})/); return m ? m[1] : s;
}
function _ts(dt) { return Utilities.formatDate(dt instanceof Date ? dt : new Date(dt), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"); }

/**** 初始資料打包 ****/
function getInitialData(dateStr) {
  const date = dateStr ? _normDate(dateStr) : getTodayDateString();
  return {
    date: date,
    telephones: getAllRestaurantTelephones(),
    employees: getEmployeeNames(),
    summary: getOrderSummary(date),
    menuPayload: getFullMenuPayload(),
    confirmations: getConfirmations(date),
    locks: getCategoryLocks(date)
  };
}

// 新增功能: 一次性抓取所有餐廳與菜單，加速前端
function getFullMenuPayload() {
  const shRest = _restaurants();
  const rowsRest = shRest.getDataRange().getValues(); const headRest = rowsRest.shift();
  const HR = Object.fromEntries(headRest.map((k, i) => [k, i]));
  const outRest = [];
  rowsRest.forEach(r => {
    const active = (r[HR.IsActive] === true || String(r[HR.IsActive]).toLowerCase() === 'true' || Number(r[HR.IsActive]) === 1);
    if(active) {
      outRest.push({
        id: String(r[HR.RestaurantID]),
        name: String(r[HR.Name] || ''),
        category: String(r[HR.Category] || '').trim(),
        createdAt: (HR.CreatedAt != null && r[HR.CreatedAt]) ? (r[HR.CreatedAt] instanceof Date ? _ts(r[HR.CreatedAt]) : String(r[HR.CreatedAt] || '')) : ''
      });
    }
  });

  const shPortions = _portions();
  const rowsPortions = shPortions.getDataRange().getValues(); const headPortions = rowsPortions.shift();
  const HP = Object.fromEntries(headPortions.map((k, i) => [k, i]));
  const portionsMap = {};
  const hasRidInPortion = (HP.RestaurantID != null);
  rowsPortions.forEach(r => {
    const rid = hasRidInPortion ? String(r[HP.RestaurantID] || '') : '';
    const iid = String(r[HP.ItemID] || '');
    if(!iid) return;
    const key = rid ? `${rid}_${iid}` : iid;
    if(!portionsMap[key]) portionsMap[key] = [];
    portionsMap[key].push({ name: String(r[HP.PortionName] || ''), price: Number(r[HP.Price] || 0) });
  });

  const shMenu = _menu();
  const rowsMenu = shMenu.getDataRange().getValues(); const headMenu = rowsMenu.shift();
  const HM = Object.fromEntries(headMenu.map((k, i) => [k, i]));
  const outMenu = [];
  const outExtras = [];
  
  var today = getTodayDateString();
  rowsMenu.forEach(r => {
    const rid = String(r[HM.RestaurantID] || '');
    const iid = String(r[HM.ItemID] || '');
    if(!rid || !iid) return;
    // 過濾停用品項
    if (HM.IsActive != null) {
      var itemActive = (r[HM.IsActive] === true || String(r[HM.IsActive]).toLowerCase() === 'true' || r[HM.IsActive] === '' || r[HM.IsActive] == null);
      if (!itemActive) return;
    }

    // 讀取限定欄位
    var limitedType = HM.LimitedType != null ? String(r[HM.LimitedType] || '').trim() : '';
    var itemStartDate = HM.StartDate != null ? _normDate(r[HM.StartDate]) : '';
    var itemEndDate = HM.EndDate != null ? _normDate(r[HM.EndDate]) : '';

    // 過濾不在販賣區間的限定品項
    if (limitedType) {
      if (itemStartDate && today < itemStartDate) return;
      if (itemEndDate && today > itemEndDate) return;
    }

    const isExtra = String(r[HM.IsExtra] || '').toLowerCase() === 'true' || Number(r[HM.IsExtra]) === 1;
    if (!isExtra) {
      let rawUrl = HM.Image ? String(r[HM.Image] || '').trim() : '';
      let directUrl = _convertDriveUrl(rawUrl);
      let itemPortions = portionsMap[`${rid}_${iid}`] || portionsMap[iid] || [];

      outMenu.push({
        id: iid,
        restaurantId: rid,
        name: String(r[HM.ItemName] || ''),
        price: Number(r[HM.Price] || 0),
        category: String(r[HM.Category] || ''),
        image: directUrl,
        subCategory: HM.SubCategory ? String(r[HM.SubCategory] || '').trim() : '',
        flavors: HM.Flavors ? String(r[HM.Flavors] || '').trim() : '',
        portions: itemPortions,
        limitedType: limitedType,
        startDate: itemStartDate,
        endDate: itemEndDate,
        createdAt: (HM.CreatedAt != null && r[HM.CreatedAt]) ? (r[HM.CreatedAt] instanceof Date ? _ts(r[HM.CreatedAt]) : String(r[HM.CreatedAt] || '')) : ''
      });
    } else {
      const group = String(r[HM.ExtraGroup] || '').trim();
      const typeRaw = String(r[HM.ExtraType] || '').toLowerCase();
      const type = (typeRaw === 'package' || typeRaw === 'single') ? 'single' : 'extra';
      outExtras.push({
        id: iid,
        restaurantId: rid,
        name: String(r[HM.ItemName] || ''),
        price: Number(r[HM.Price] || 0),
        type: type,
        group: group || (type === 'single' ? '套餐' : '加點')
      });
    }
  });

  // 過濾停用品項
  var activeMenu = outMenu;
  // 載入特價資料
  var specials = getActiveSpecialPrices();

  // 讀取新品展示天數設定
  var settingsDays = 7;
  try {
    var shSettings = _settings();
    var settingsData = shSettings.getDataRange().getValues();
    for (var si = 1; si < settingsData.length; si++) {
      if (String(settingsData[si][0]).trim() === 'NewItemDisplayDays') {
        settingsDays = Number(settingsData[si][1]) || 7;
        break;
      }
    }
  } catch(e) { /* ignore */ }

  return { restaurants: outRest, items: activeMenu, extras: outExtras, specialPrices: specials, newItemDisplayDays: settingsDays };
}

function getAllRestaurantTelephones() {
  const sh = _restaurants();
  const rows = sh.getDataRange().getValues(); const head = rows.shift();
  const H = Object.fromEntries(head.map((k, i) => [k, i]));
  const map = {};
  rows.forEach(r => {
    const id = String(r[H.RestaurantID] || '').trim(); if (!id) return;
    map[id] = { name: String(r[H.Name] || ''), telephone: String(r[H.Telephone] || '') };
  });
  return map;
}

/**** 供前端: 員工姓名 ****/
function getEmployeeNames() {
  const sh = _users();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const names = sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0] || '').trim()).filter(Boolean);
  const set = new Set(names);
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
}

/**** 送出訂單 (含嚴格價格回寫) ****/
function submitOrder(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const item = (payload.items && payload.items[0]) || null;
    if (!item) throw new Error('缺少訂單項目');
    
    const totalPrice = Number(item.totalPrice || 0);
    const employeeName = payload.employeeName || '';
    const restaurantId = payload.restaurantId; // 取得餐廳 ID
    const useBalance = payload.useBalance === true;
    let isPaid = false;
    
    // 檢查餘額
    if (useBalance && totalPrice > 0) {
      const currentBal = getEmployeeBalance(employeeName);
      if (currentBal < totalPrice) {
        throw new Error('餘額不足! 目前餘額: $' + currentBal + ', 訂單金額: $' + totalPrice);
      }
      performDeposit(employeeName, -totalPrice);
      isPaid = true;
    }

    const sh = _orders();
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const H = Object.fromEntries(headers.map((k, i) => [k, i]));
    const row = new Array(headers.length).fill('');
    const created = _ts(new Date());

    if (H.Date != null) row[H.Date] = payload.date || getTodayDateString();
    if (H.EmployeeName != null) row[H.EmployeeName] = employeeName || '';
    if (H.RestaurantID != null) row[H.RestaurantID] = restaurantId || '';

    const isCustom = item.isCustom === true;
    let finalNote = item.note || '';

    if (isCustom) {
      if (H.ItemID != null) row[H.ItemID] = '_OTHER_';
      if (H.ItemName != null) row[H.ItemName] = item.customName || '';
      if (H.CustomItemName != null) row[H.CustomItemName] = item.customName || '';
      if (H.UnitPrice != null) row[H.UnitPrice] = Number(item.customPrice || 0);
    } else {
      if (H.ItemID != null) row[H.ItemID] = item.itemId;
      if (H.ItemName != null) row[H.ItemName] = item.itemName || '';
      if (H.UnitPrice != null) row[H.UnitPrice] = Number(item.unitPrice || 0);

      // --- 核心修改：價格回寫 ---
      // 判斷是否修改了價格
      if (item.originalPrice !== undefined && Number(item.unitPrice) !== Number(item.originalPrice)) {
        if (item.portionName) {
           // 情境A: 有份量 -> 更新 ItemPortions 表 (需同時比對 RestaurantID)
           updateItemPortionPrice(restaurantId, item.itemId, item.portionName, item.unitPrice);
        } else {
           // 情境B: 無份量 -> 更新 MenuItems 表 (需同時比對 RestaurantID)
           updateMenuItemBasePrice(restaurantId, item.itemId, item.unitPrice);
        }
      }
      // ------------------------
    }

    if (H.Quantity != null) row[H.Quantity] = Number(item.quantity || 0);
    if (H.TotalPrice != null) row[H.TotalPrice] = totalPrice;
    if (H.Sweetness != null) row[H.Sweetness] = item.sweetness || '';
    if (H.Ice != null) row[H.Ice] = item.ice || '';
    if (H.Note != null) row[H.Note] = finalNote;

    if (isPaid) {
      if (H.PaidAmount != null) row[H.PaidAmount] = totalPrice;
      if (H.ChangeAmount != null) row[H.ChangeAmount] = 0;
      if (H.IsChangeGiven != null) row[H.IsChangeGiven] = 'TRUE';
    } else {
      if (H.PaidAmount != null) row[H.PaidAmount] = '';
      if (H.ChangeAmount != null) row[H.ChangeAmount] = '';
      if (H.IsChangeGiven != null) row[H.IsChangeGiven] = '';
    }
    
    if (H.CreatedAt != null) row[H.CreatedAt] = created;
    sh.appendRow(row);
    
    // V7: 回傳新建的 order row 資料，讓前端差量更新
    const newRowNumber = sh.getLastRow();
    const finalItemName = isCustom ? (item.customName || '') : (item.itemName || '');
    const pAmt = isPaid ? totalPrice : '';
    const cAmt = isPaid ? 0 : '';
    
    return { 
      success: true, 
      newOrder: {
        rowNumber: newRowNumber,
        employee: employeeName,
        restaurantId: restaurantId || '',
        item: finalItemName,
        category: item.category || '',
        subCategory: '',
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        totalPrice: totalPrice,
        sweetness: item.sweetness || '',
        ice: item.ice || '',
        note: finalNote,
        paidAmount: pAmt,
        changeAmount: cAmt,
        isChangeGiven: isPaid,
        createdAt: created
      }
    };

  } catch (e) {
    throw e;
  } finally {
    lock.releaseLock();
  }
}

// === 更新功能 1: 更新 MenuItems 的基礎價格 (雙重比對) ===
function updateMenuItemBasePrice(restaurantId, itemId, newPrice) {
  try {
    const sh = _menu();
    const data = sh.getDataRange().getValues();
    const H = Object.fromEntries(data[0].map((k, i) => [k, i]));
    
    if (H.RestaurantID == null || H.ItemID == null || H.Price == null) return;
    
    const tRid = String(restaurantId);
    const tIid = String(itemId);

    for (let i = 1; i < data.length; i++) {
      // 嚴格比對: RestaurantID AND ItemID
      if (String(data[i][H.RestaurantID]) === tRid && String(data[i][H.ItemID]) === tIid) {
        sh.getRange(i + 1, H.Price + 1).setValue(Number(newPrice));
        break;
      }
    }
  } catch(e) { console.error('Base Price Update Fail', e); }
}

// === 更新功能 2: 更新 ItemPortions 的份量價格 (三重比對) ===
function updateItemPortionPrice(restaurantId, itemId, portionName, newPrice) {
  try {
    const sh = _portions();
    const data = sh.getDataRange().getValues();
    const H = Object.fromEntries(data[0].map((k, i) => [k, i]));
    
    // 檢查是否有足夠欄位
    if (H.ItemID == null || H.PortionName == null || H.Price == null) return;
    
    const tRid = String(restaurantId);
    const tIid = String(itemId);
    const tPortion = String(portionName).trim();
    
    for (let i = 1; i < data.length; i++) {
      const rowIid = String(data[i][H.ItemID]);
      const rowPortion = String(data[i][H.PortionName]).trim();
      
      // 判斷邏輯：
      // 1. 如果 ItemPortions 有 RestaurantID 欄位，則必須匹配 (建議)
      // 2. 如果沒有，則只匹配 ItemID (兼容)
      let ridMatch = true;
      if (H.RestaurantID != null) {
        ridMatch = (String(data[i][H.RestaurantID]) === tRid);
      }
      
      if (ridMatch && rowIid === tIid && rowPortion === tPortion) {
        sh.getRange(i + 1, H.Price + 1).setValue(Number(newPrice));
        break;
      }
    }
  } catch(e) { console.error('Portion Price Update Fail', e); }
}

function deleteOrder(rowNumber){
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sh = _orders();
    if(rowNumber<2 || rowNumber>sh.getLastRow()) throw new Error('無效行號');
    const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
    const H=Object.fromEntries(headers.map((k,i)=>[k,i]));
    const range = sh.getRange(rowNumber, 1, 1, sh.getLastColumn());
    const rowData = range.getValues()[0];
    const empName = (H.EmployeeName!=null)? String(rowData[H.EmployeeName]||''): '';
    const paid = (H.PaidAmount!=null)? Number(rowData[H.PaidAmount]||0): 0;
    const change = (H.ChangeAmount!=null)? Number(rowData[H.ChangeAmount]||0): 0;
    const netPaid = paid - change;
    let refundMsg = '';
    if(empName && netPaid > 0){
      performDeposit(empName, netPaid);
      refundMsg = '(已退回款項 $'+ netPaid + ')';
    }
    sh.deleteRow(rowNumber);
    return {success: true, message: refundMsg};
  } catch(e) { throw e; } finally { lock.releaseLock(); }
}

function getEmployeeBalance(name){
  if(!name) return 0;
  const sh = _users();
  const data = sh.getDataRange().getValues();
  for(let i=1; i<data.length; i++){
    if(data[i][0] === name) return Number(data[i][1]||0);
  }
  return 0;
}

function updateOrderNote(rowNumber, newNote) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sh = _orders();
    if(rowNumber < 2 || rowNumber > sh.getLastRow()) throw new Error('無效行號');
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const H = Object.fromEntries(headers.map((k, i) => [k, i]));
    if (H.Note != null) {
      sh.getRange(rowNumber, H.Note + 1).setValue(newNote || '');
    }
    return { success: true };
  } catch(e) { throw e; } finally { lock.releaseLock(); }
}

function performDeposit(name, amount){
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sh = _users();
    const data = sh.getDataRange().getValues();
    let foundRow = -1;
    for(let i=1; i<data.length; i++){
      if(data[i][0] === name){ foundRow = i+1; break; }
    }
    const now = _ts(new Date());
    if(foundRow > 0){
      let currentBal = Number(sh.getRange(foundRow, 2).getValue()||0);
      let newBal = currentBal + Number(amount);
      sh.getRange(foundRow, 2).setValue(newBal);
      sh.getRange(foundRow, 3).setValue(now);
      return newBal;
    } else {
      sh.appendRow([name, Number(amount), now]);
      return Number(amount);
    }
  } catch(e) { throw e; } finally { lock.releaseLock(); }
}

function getConfirmations(dateString){
  const want=_normDate(dateString||getTodayDateString());
  const sh=_confirmSheet(); const rows=sh.getDataRange().getValues(); const head=rows.shift();
  const H=Object.fromEntries(head.map((k,i)=>[k,i]));
  const map={};
  rows.forEach(r=>{
    if(_normDate(r[H.Date])===want){
      map[String(r[H.RestaurantID])] = { confirmedBy: String(r[H.ConfirmedBy]||''), confirmedAt: r[H.ConfirmedAt]?_ts(r[H.ConfirmedAt]):'' }
    };
  });
  return map;
}

function confirmRestaurantOrder(dateString, restaurantId, byName){
  const want=_normDate(dateString||getTodayDateString());
  const sh=_confirmSheet(); const rows=sh.getDataRange().getValues(); const head=rows.shift();
  const H=Object.fromEntries(head.map((k,i)=>[k,i]));
  const now=_ts(new Date());
  let found=-1;
  rows.forEach((r,i)=>{ if(_normDate(r[H.Date])===want && String(r[H.RestaurantID])===String(restaurantId)) found=i+2; });
  if(found>0){ sh.getRange(found, H.ConfirmedBy+1).setValue(byName||''); sh.getRange(found, H.ConfirmedAt+1).setValue(now); }
  else{ sh.appendRow([want, restaurantId, byName||'', now]); }

  // 解除該餐廳所屬類別的鎖定
  const category = _getRestaurantCategory(restaurantId);
  if (category) {
    _unlockCategoryInternal(want, category);
  }

  return {success:true, confirmedAt:now};
}

function cancelRestaurantConfirmation(dateString, restaurantId){
  const want=_normDate(dateString||getTodayDateString());
  const sh=_confirmSheet(); const rows=sh.getDataRange().getValues(); const head=rows.shift();
  const H=Object.fromEntries(head.map((k,i)=>[k,i]));
  for(let i=0;i<rows.length;i++){
    if(_normDate(rows[i][H.Date])===want && String(rows[i][H.RestaurantID])===String(restaurantId)){ sh.deleteRow(i+2); return {success:true}; }
  }
  return {success:false};
}

function getOrderSummary(dateString){
  const want = _normDate(dateString || getTodayDateString());
  const orderSh = _orders(); const orders = orderSh.getDataRange().getValues(); const oh = orders.shift();
  const O = Object.fromEntries(oh.map((k, i) => [k, i]));
  const menuSh = _menu(); const menus = menuSh.getDataRange().getValues(); const mh = menus.shift();
  const M = Object.fromEntries(mh.map((k, i) => [k, i]));
  const menuMap = {};
  menus.forEach(r => {
    const rid = String(r[M.RestaurantID] || '').trim(), iid = String(r[M.ItemID] || '').trim();
    if (rid && iid) {
      menuMap[rid + '-' + iid] = { name: String(r[M.ItemName] || ''), category: String(r[M.Category] || '其他'), subCategory: M.SubCategory ? String(r[M.SubCategory] || '').trim() : '' };
    }
  });
  const list = [];
  orders.forEach((r, idx) => {
    const d = _normDate(r[O.Date]); if (d !== want) return;
    const rid = r[O.RestaurantID], iid = r[O.ItemID];
    const k = String(rid) + '-' + String(iid);
    let createdAtStr = '';
    const raw = r[O.CreatedAt];
    if (raw instanceof Date && !isNaN(raw)) createdAtStr = _ts(raw);
    else if (raw) { const m = String(raw).match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}:\d{2}))?/); createdAtStr = m ? (m[1] + 'T' + (m[2] || '00:00:00')) : String(raw); }
    const orderItemName = O.ItemName >= 0 ? String(r[O.ItemName] || '') : '';
    const fromMenu = menuMap[k];
    const customName = O.CustomItemName >= 0 ? String(r[O.CustomItemName] || '') : '';
    const itemName = orderItemName || (fromMenu && fromMenu.name) || customName || '未知餐點';
    const category = (fromMenu && fromMenu.category) || '其他';
    const subCategory = (fromMenu && fromMenu.subCategory) || '';
    // 修正點：補上 .toLowerCase() 的點
    const isChangeGiven = O.IsChangeGiven >= 0 ? (Boolean(r[O.IsChangeGiven]) === true || String(r[O.IsChangeGiven]).toLowerCase() === 'true') : false;
    const pAmt = (r[O.PaidAmount] === '' || r[O.PaidAmount] == null) ? '' : Number(r[O.PaidAmount]);
    const cAmt = (r[O.ChangeAmount] === '' || r[O.ChangeAmount] == null) ? '' : Number(r[O.ChangeAmount]);
    list.push({ rowNumber: idx + 2, employee: String(r[O.EmployeeName] || ''), restaurantId: r[O.RestaurantID], item: itemName, category: category, subCategory: subCategory, quantity: Number(r[O.Quantity] || 0), unitPrice: Number(r[O.UnitPrice] || 0), totalPrice: Number(r[O.TotalPrice] || 0), sweetness: String(r[O.Sweetness] || ''), ice: String(r[O.Ice] || ''), note: String(r[O.Note] || ''), paidAmount: pAmt, changeAmount: cAmt, isChangeGiven: isChangeGiven, createdAt: createdAtStr });
  });
  return list;
}

function saveEmployeePayment(data) {
  const sh = _orders(); const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]; const H = Object.fromEntries(headers.map((k, i) => [k, i]));
  if (H.EmployeeName == null) return;
  const last = sh.getLastRow(); const empCol = H.EmployeeName + 1; const range = sh.getRange(2, empCol, Math.max(last - 1, 0), 1); const values = range.getValues();
  const paidCol = H.PaidAmount != null ? H.PaidAmount + 1 : -1; const chgCol = H.ChangeAmount != null ? H.ChangeAmount + 1 : -1; const givenCol = H.IsChangeGiven != null ? H.IsChangeGiven + 1 : -1; const dateCol = H.Date != null ? H.Date + 1 : -1;
  const want = _normDate(data.dateString || getTodayDateString());
  for (let i = 0; i < values.length; i++) {
    const r = i + 2; const isEmp = values[i][0] === data.employee;
    let isToday = true;
    if (dateCol > 0) { const dv = sh.getRange(r, dateCol).getValue(); isToday = _normDate(dv) === want; }
    if (isEmp && isToday) {
      if (paidCol > 0) sh.getRange(r, paidCol).setValue(data.paidAmount);
      if (chgCol > 0) sh.getRange(r, chgCol).setValue(data.changeAmount);
      if (givenCol > 0 && data.hasOwnProperty('isChangeGiven')) { sh.getRange(r, givenCol).setValue(data.isChangeGiven); }
    }
  }
}

function _convertDriveUrl(url){ if(!url)return ''; if(url.indexOf('drive.google.com')===-1)return url; let m=url.match(/\/d\/([a-zA-Z0-9_-]+)/)||url.match(/id=([a-zA-Z0-9_-]+)/); if(m&&m[1])return 'https://lh3.googleusercontent.com/d/'+m[1]; return url; }

/**** Sheet Helpers（新工作表） ****/

function _specialPrices() {
  const ss = _ss();
  let sh = ss.getSheetByName('SpecialPrices');
  if (!sh) {
    sh = ss.insertSheet('SpecialPrices');
    sh.appendRow(['RestaurantID', 'ItemID', 'PortionName', 'OriginalPrice', 'SpecialPrice', 'StartDate', 'EndDate', 'Label', 'IsActive']);
  }
  return sh;
}

/**** Admin Check（管理員驗證） ****/
function _checkAdmin(employeeName) {
  if (!employeeName) throw new Error('未指定管理員');
  const sh = _users();
  const data = sh.getDataRange().getValues();
  if (data.length < 2) throw new Error('使用者資料表為空');
  
  const H = {};
  data[0].forEach((k, i) => {
    H[String(k || '').trim().toLowerCase()] = i;
  });
  
  let roleIdx = null;
  const candidates = ['role', '角色', '權限', '身分', '身份', 'admin', '管理'];
  for (let i = 0; i < candidates.length; i++) {
    if (H[candidates[i]] !== undefined) {
      roleIdx = H[candidates[i]];
      break;
    }
  }
  
  // Fallback to column 3 (index 2) if there are 3 or more columns
  if (roleIdx == null && data[0].length >= 3) {
    roleIdx = 2;
  }
  
  if (roleIdx == null) {
    // Under backwards compatibility, if role column doesn't exist, we don't block
    return;
  }
  
  const targetName = String(employeeName).trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    const rowName = String(data[i][0] || '').trim().toLowerCase();
    if (rowName === targetName) {
      const role = String(data[i][roleIdx] || '').trim().toLowerCase();
      if (role === 'admin') return;
      throw new Error('權限不足：' + employeeName + ' 不是管理員');
    }
  }
  throw new Error('找不到使用者：' + employeeName);
}

function getUserRole(employeeName) {
  if (!employeeName) return 'user';
  try {
    const sh = _users();
    const data = sh.getDataRange().getValues();
    if (data.length < 2) return 'user';
    
    const H = {};
    data[0].forEach((k, i) => {
      H[String(k || '').trim().toLowerCase()] = i;
    });
    
    let roleIdx = null;
    const candidates = ['role', '角色', '權限', '身分', '身份', 'admin', '管理'];
    for (let i = 0; i < candidates.length; i++) {
      if (H[candidates[i]] !== undefined) {
        roleIdx = H[candidates[i]];
        break;
      }
    }
    
    if (roleIdx == null && data[0].length >= 3) {
      roleIdx = 2;
    }
    
    if (roleIdx == null) return 'user';
    
    const targetName = String(employeeName).trim().toLowerCase();
    for (let i = 1; i < data.length; i++) {
      const rowName = String(data[i][0] || '').trim().toLowerCase();
      if (rowName === targetName) {
        const val = String(data[i][roleIdx] || '').trim().toLowerCase();
        return (val === 'admin') ? 'admin' : 'user';
      }
    }
  } catch (e) {
    Logger.log('getUserRole error: ' + e.message);
    return 'error: ' + e.message;
  }
  return 'user';
}

/**** Restaurant CRUD（餐廳管理） ****/
function addRestaurant(data) {
  _checkAdmin(data.adminName);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = _restaurants();
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const H = Object.fromEntries(headers.map((k, i) => [k, i]));

    const restId = 'REST_' + new Date().getTime();
    const row = new Array(headers.length).fill('');

    if (H.RestaurantID != null) row[H.RestaurantID] = restId;
    if (H.Name != null) row[H.Name] = data.name || '';
    if (H.Category != null) row[H.Category] = data.category || '';
    if (H.IsActive != null) row[H.IsActive] = true;
    if (H.Telephone != null) row[H.Telephone] = data.telephone || '';
    // 自動寫入建立時間
    if (H.CreatedAt != null) {
      row[H.CreatedAt] = _ts(new Date());
    } else {
      var newCol = headers.length + 1;
      sh.getRange(1, newCol).setValue('CreatedAt');
      row.push(_ts(new Date()));
    }

    sh.appendRow(row);
    return { success: true, restaurantId: restId };
  } catch(e) { throw e; } finally { lock.releaseLock(); }
}

/**** Menu CRUD（品項管理） ****/
function addMenuItem(data) {
  _checkAdmin(data.adminName);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = _menu();
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const H = Object.fromEntries(headers.map((k, i) => [k, i]));
    
    // 自動生成或使用傳入之 ItemID
    const itemId = data.itemId ? String(data.itemId) : ('ITEM_' + new Date().getTime());
    const row = new Array(headers.length).fill('');
    
    if (H.RestaurantID != null) row[H.RestaurantID] = data.restaurantId || '';
    if (H.ItemID != null) row[H.ItemID] = itemId;
    if (H.ItemName != null) row[H.ItemName] = data.itemName || '';
    if (H.Price != null) row[H.Price] = Number(data.price || 0);
    if (H.Category != null) row[H.Category] = data.category || '';
    if (H.SubCategory != null) row[H.SubCategory] = data.subCategory || '';
    if (H.Image != null) row[H.Image] = data.image || '';
    if (H.Flavors != null) row[H.Flavors] = data.flavors || '';
    if (H.IsExtra != null) row[H.IsExtra] = data.isExtra || false;
    if (H.IsActive != null) row[H.IsActive] = true;
    if (H.LimitedType != null) row[H.LimitedType] = data.limitedType || '';
    if (H.StartDate != null) row[H.StartDate] = data.startDate || '';
    if (H.EndDate != null) row[H.EndDate] = data.endDate || '';
    // 自動寫入建立時間
    if (H.CreatedAt != null) {
      row[H.CreatedAt] = _ts(new Date());
    } else {
      // 自動新增 CreatedAt 欄位
      var newCol = headers.length + 1;
      sh.getRange(1, newCol).setValue('CreatedAt');
      row.push(_ts(new Date()));
    }
    
    sh.appendRow(row);
    
    // 如果有份量資料，同時寫入 ItemPortions
    if (data.portions && data.portions.length > 0) {
      const psh = _portions();
      data.portions.forEach(function(p) {
        psh.appendRow([data.restaurantId, itemId, p.name, Number(p.price || 0)]);
      });
    }
    
    return { success: true, itemId: itemId };
  } catch(e) { throw e; } finally { lock.releaseLock(); }
}

function updateMenuItem(data) {
  _checkAdmin(data.adminName);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = _menu();
    const allData = sh.getDataRange().getValues();
    const H = Object.fromEntries(allData[0].map((k, i) => [k, i]));
    
    const tRid = String(data.restaurantId);
    const tIid = String(data.itemId);
    
    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][H.RestaurantID]) === tRid && String(allData[i][H.ItemID]) === tIid) {
        const rowNum = i + 1;
        if (data.itemName !== undefined && H.ItemName != null) sh.getRange(rowNum, H.ItemName + 1).setValue(data.itemName);
        if (data.price !== undefined && H.Price != null) sh.getRange(rowNum, H.Price + 1).setValue(Number(data.price));
        if (data.category !== undefined && H.Category != null) sh.getRange(rowNum, H.Category + 1).setValue(data.category);
        if (data.subCategory !== undefined && H.SubCategory != null) sh.getRange(rowNum, H.SubCategory + 1).setValue(data.subCategory);
        if (data.image !== undefined && H.Image != null) sh.getRange(rowNum, H.Image + 1).setValue(data.image);
        if (data.flavors !== undefined && H.Flavors != null) sh.getRange(rowNum, H.Flavors + 1).setValue(data.flavors);
        if (data.limitedType !== undefined && H.LimitedType != null) sh.getRange(rowNum, H.LimitedType + 1).setValue(data.limitedType);
        if (data.startDate !== undefined && H.StartDate != null) sh.getRange(rowNum, H.StartDate + 1).setValue(data.startDate);
        if (data.endDate !== undefined && H.EndDate != null) sh.getRange(rowNum, H.EndDate + 1).setValue(data.endDate);
        break;
      }
    }
    return { success: true };
  } catch(e) { throw e; } finally { lock.releaseLock(); }
}

function deactivateMenuItem(restaurantId, itemId, adminName) {
  _checkAdmin(adminName);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = _menu();
    const data = sh.getDataRange().getValues();
    const H = Object.fromEntries(data[0].map((k, i) => [k, i]));
    
    // 確保有 IsActive 欄位
    if (H.IsActive == null) {
      // 新增欄位
      const col = data[0].length + 1;
      sh.getRange(1, col).setValue('IsActive');
      // 預設所有現有品項為 TRUE
      const last = sh.getLastRow();
      if (last > 1) {
        const range = sh.getRange(2, col, last - 1, 1);
        const vals = [];
        for (let i = 0; i < last - 1; i++) vals.push([true]);
        range.setValues(vals);
      }
      H.IsActive = col - 1;
    }
    
    const tRid = String(restaurantId);
    const tIid = String(itemId);
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][H.RestaurantID]) === tRid && String(data[i][H.ItemID]) === tIid) {
        sh.getRange(i + 1, H.IsActive + 1).setValue(false);
        break;
      }
    }
    return { success: true };
  } catch(e) { throw e; } finally { lock.releaseLock(); }
}

function reactivateMenuItem(restaurantId, itemId, adminName) {
  _checkAdmin(adminName);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = _menu();
    const data = sh.getDataRange().getValues();
    const H = Object.fromEntries(data[0].map((k, i) => [k, i]));
    if (H.IsActive == null) return { success: true };
    
    const tRid = String(restaurantId);
    const tIid = String(itemId);
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][H.RestaurantID]) === tRid && String(data[i][H.ItemID]) === tIid) {
        sh.getRange(i + 1, H.IsActive + 1).setValue(true);
        break;
      }
    }
    return { success: true };
  } catch(e) { throw e; } finally { lock.releaseLock(); }
}

/**** Portion CRUD（份量管理） ****/
function addItemPortion(data) {
  _checkAdmin(data.adminName);
  const sh = _portions();
  sh.appendRow([data.restaurantId, data.itemId, data.portionName, Number(data.price || 0)]);
  return { success: true };
}

function updateItemPortion(data) {
  _checkAdmin(data.adminName);
  const sh = _portions();
  const allData = sh.getDataRange().getValues();
  const H = Object.fromEntries(allData[0].map((k, i) => [k, i]));
  
  for (let i = 1; i < allData.length; i++) {
    let ridMatch = true;
    if (H.RestaurantID != null) ridMatch = String(allData[i][H.RestaurantID]) === String(data.restaurantId);
    if (ridMatch && String(allData[i][H.ItemID]) === String(data.itemId) && String(allData[i][H.PortionName]).trim() === String(data.oldPortionName).trim()) {
      if (data.portionName !== undefined) sh.getRange(i + 1, H.PortionName + 1).setValue(data.portionName);
      if (data.price !== undefined) sh.getRange(i + 1, H.Price + 1).setValue(Number(data.price));
      break;
    }
  }
  return { success: true };
}

function deleteItemPortion(restaurantId, itemId, portionName, adminName) {
  _checkAdmin(adminName);
  const sh = _portions();
  const data = sh.getDataRange().getValues();
  const H = Object.fromEntries(data[0].map((k, i) => [k, i]));
  
  for (let i = data.length - 1; i >= 1; i--) {
    let ridMatch = true;
    if (H.RestaurantID != null) ridMatch = String(data[i][H.RestaurantID]) === String(restaurantId);
    if (ridMatch && String(data[i][H.ItemID]) === String(itemId) && String(data[i][H.PortionName]).trim() === String(portionName).trim()) {
      sh.deleteRow(i + 1);
      break;
    }
  }
  return { success: true };
}

function _updateItemPortions(restaurantId, itemId, portions) {
  if (!portions || !Array.isArray(portions)) return;
  const psh = _portions();
  const data = psh.getDataRange().getValues();
  if (data.length > 1) {
    const H = Object.fromEntries(data[0].map((k, i) => [k, i]));
    const tRid = String(restaurantId);
    const tIid = String(itemId);
    for (let i = data.length - 1; i >= 1; i--) {
      let ridMatch = true;
      if (H.RestaurantID != null) ridMatch = String(data[i][H.RestaurantID]) === tRid;
      if (ridMatch && String(data[i][H.ItemID]) === tIid) {
        psh.deleteRow(i + 1);
      }
    }
  }
  portions.forEach(function(p) {
    psh.appendRow([restaurantId, itemId, p.name, Number(p.price || 0)]);
  });
}

/**** Batch Apply Menu Changes（批次套用菜單變更） ****/
function applyMenuChanges(restaurantId, changes, adminName) {
  _checkAdmin(adminName);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var applied = 0;
    changes.forEach(function(change) {
      const targetRestId = change.restaurantId || restaurantId;
      switch(change.type) {
        case 'add':
          addMenuItem({
            adminName: adminName,
            restaurantId: targetRestId,
            itemId: change.itemId,
            itemName: change.itemName,
            price: change.price,
            category: change.category || '',
            subCategory: change.subCategory || '',
            flavors: change.flavors || '',
            limitedType: change.limitedType || '',
            portions: change.portions || []
          });
          applied++;
          break;
        case 'update':
          if (change.itemId) {
            updateMenuItem({
              adminName: adminName,
              restaurantId: targetRestId,
              itemId: change.itemId,
              itemName: change.itemName,
              price: change.price,
              subCategory: change.subCategory,
              flavors: change.flavors,
              limitedType: change.limitedType
            });
            if (change.portions && change.portions.length > 0) {
              _updateItemPortions(targetRestId, change.itemId, change.portions);
            }
          }
          applied++;
          break;
        case 'remove':
          if (change.itemId) {
            deactivateMenuItem(targetRestId, change.itemId, adminName);
          }
          applied++;
          break;
      }
    });
    return { success: true, applied: applied };
  } catch(e) { throw e; } finally { lock.releaseLock(); }
}

/**** Special Price Management（特價管理） ****/
function setSpecialPrice(data) {
  _checkAdmin(data.adminName);
  const sh = _specialPrices();
  const allData = sh.getDataRange().getValues();
  const H = Object.fromEntries(allData[0].map((k, i) => [k, i]));
  
  // 檢查是否已有相同的特價設定
  var found = -1;
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][H.RestaurantID]) === String(data.restaurantId) &&
        String(allData[i][H.ItemID]) === String(data.itemId) &&
        String(allData[i][H.PortionName] || '').trim() === String(data.portionName || '').trim()) {
      found = i + 1;
      break;
    }
  }
  
  if (found > 0) {
    // 更新現有
    sh.getRange(found, H.SpecialPrice + 1).setValue(Number(data.specialPrice));
    sh.getRange(found, H.StartDate + 1).setValue(data.startDate || '');
    sh.getRange(found, H.EndDate + 1).setValue(data.endDate || '');
    sh.getRange(found, H.Label + 1).setValue(data.label || '');
    sh.getRange(found, H.IsActive + 1).setValue(true);
  } else {
    // 新增
    sh.appendRow([
      data.restaurantId,
      data.itemId,
      data.portionName || '',
      Number(data.originalPrice || 0),
      Number(data.specialPrice),
      data.startDate || '',
      data.endDate || '',
      data.label || '',
      true
    ]);
  }
  return { success: true };
}

function removeSpecialPrice(restaurantId, itemId, portionName, adminName) {
  _checkAdmin(adminName);
  const sh = _specialPrices();
  const data = sh.getDataRange().getValues();
  const H = Object.fromEntries(data[0].map((k, i) => [k, i]));
  
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][H.RestaurantID]) === String(restaurantId) &&
        String(data[i][H.ItemID]) === String(itemId) &&
        String(data[i][H.PortionName] || '').trim() === String(portionName || '').trim()) {
      sh.deleteRow(i + 1);
      break;
    }
  }
  return { success: true };
}

function getActiveSpecialPrices() {
  var sh;
  try { sh = _specialPrices(); } catch(e) { return []; }
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const H = Object.fromEntries(data[0].map((k, i) => [k, i]));
  const today = getTodayDateString();
  var result = [];
  
  for (var i = 1; i < data.length; i++) {
    var isActive = data[i][H.IsActive] === true || String(data[i][H.IsActive]).toLowerCase() === 'true';
    if (!isActive) continue;
    
    var startDate = _normDate(data[i][H.StartDate]);
    var endDate = _normDate(data[i][H.EndDate]);
    
    // 檢查日期範圍
    if (startDate && today < startDate) continue;
    if (endDate && today > endDate) continue;
    
    result.push({
      restaurantId: String(data[i][H.RestaurantID] || ''),
      itemId: String(data[i][H.ItemID] || ''),
      portionName: String(data[i][H.PortionName] || '').trim(),
      originalPrice: Number(data[i][H.OriginalPrice] || 0),
      specialPrice: Number(data[i][H.SpecialPrice] || 0),
      startDate: startDate,
      endDate: endDate,
      label: String(data[i][H.Label] || ''),
      isActive: true
    });
  }
  return result;
}

// GAS Time-driven Trigger 呼叫：到期自動停用
function expireSpecialPrices() {
  var sh;
  try { sh = _specialPrices(); } catch(e) { return; }
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return;
  const H = Object.fromEntries(data[0].map((k, i) => [k, i]));
  const today = getTodayDateString();
  
  for (var i = 1; i < data.length; i++) {
    var isActive = data[i][H.IsActive] === true || String(data[i][H.IsActive]).toLowerCase() === 'true';
    if (!isActive) continue;
    
    var endDate = _normDate(data[i][H.EndDate]);
    if (endDate && today > endDate) {
      sh.getRange(i + 1, H.IsActive + 1).setValue(false);
    }
  }
}

// GAS Time-driven Trigger: 過期限定商品自動停用
function expireLimitedItems() {
  const sh = _menu();
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return;
  const H = Object.fromEntries(data[0].map((k, i) => [k, i]));
  if (H.LimitedType == null || H.EndDate == null || H.IsActive == null) return;
  const today = getTodayDateString();

  for (var i = 1; i < data.length; i++) {
    var lt = String(data[i][H.LimitedType] || '').trim();
    if (!lt) continue;
    var isActive = data[i][H.IsActive] === true || String(data[i][H.IsActive]).toLowerCase() === 'true';
    if (!isActive) continue;
    var endDate = _normDate(data[i][H.EndDate]);
    if (endDate && today > endDate) {
      sh.getRange(i + 1, H.IsActive + 1).setValue(false);
    }
  }
}

/**** Admin Data Endpoint（管理員資料端點） ****/
function getAdminData(adminName) {
  _checkAdmin(adminName);
  return {
    menuPayload: getFullMenuPayload(),
    specialPrices: getActiveSpecialPrices()
  };
}

/**** Category Locks Helper & API（餐廳鎖定輔助與 API） ****/

function _locksSheet() {
  const ss = _ss();
  let sh = ss.getSheetByName('CategoryLocks');
  if (!sh) {
    sh = ss.insertSheet('CategoryLocks');
    sh.appendRow(['Date', 'Category', 'RestaurantID', 'LockedBy', 'LockedAt']);
  }
  return sh;
}

function getCategoryLocks(dateString) {
  const want = _normDate(dateString || getTodayDateString());
  const sh = _locksSheet();
  const rows = sh.getDataRange().getValues();
  if (rows.length < 2) return {};
  const head = rows.shift();
  const H = Object.fromEntries(head.map((k, i) => [k, i]));
  const map = {};
  rows.forEach(r => {
    if (_normDate(r[H.Date]) === want) {
      map[String(r[H.Category])] = {
        restaurantId: String(r[H.RestaurantID]),
        lockedBy: String(r[H.LockedBy] || ''),
        lockedAt: r[H.LockedAt] ? _ts(r[H.LockedAt]) : ''
      };
    }
  });
  return map;
}

function lockCategoryRestaurant(dateString, category, restaurantId, lockedBy) {
  const want = _normDate(dateString || getTodayDateString());
  const sh = _locksSheet();
  const rows = sh.getDataRange().getValues();
  const head = rows.shift();
  const H = Object.fromEntries(head.map((k, i) => [k, i]));
  const now = _ts(new Date());
  
  let found = -1;
  rows.forEach((r, i) => {
    if (_normDate(r[H.Date]) === want && String(r[H.Category]) === String(category)) {
      found = i + 2;
    }
  });
  
  if (found > 0) {
    sh.getRange(found, H.RestaurantID + 1).setValue(restaurantId);
    sh.getRange(found, H.LockedBy + 1).setValue(lockedBy || '');
    sh.getRange(found, H.LockedAt + 1).setValue(now);
  } else {
    sh.appendRow([want, category, restaurantId, lockedBy || '', now]);
  }
  
  return getInitialData(want);
}

function unlockCategory(dateString, category) {
  const want = _normDate(dateString || getTodayDateString());
  _unlockCategoryInternal(want, category);
  return getInitialData(want);
}

function _unlockCategoryInternal(dateString, category) {
  const want = _normDate(dateString || getTodayDateString());
  const sh = _locksSheet();
  const rows = sh.getDataRange().getValues();
  if (rows.length < 2) return;
  const head = rows.shift();
  const H = Object.fromEntries(head.map((k, i) => [k, i]));
  
  for (let i = 0; i < rows.length; i++) {
    if (_normDate(rows[i][H.Date]) === want && String(rows[i][H.Category]) === String(category)) {
      sh.deleteRow(i + 2);
      break;
    }
  }
}

function _getRestaurantCategory(restaurantId) {
  const sh = _restaurants();
  const rows = sh.getDataRange().getValues();
  const head = rows.shift();
  const H = Object.fromEntries(head.map((k, i) => [k, i]));
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][H.RestaurantID]) === String(restaurantId)) {
      return String(rows[i][H.Category] || '').trim();
    }
  }
  return null;
}

function getFrequentOrders(employeeName, restaurantId) {
  const sh = _orders();
  const rows = sh.getDataRange().getValues();
  const head = rows.shift();
  const H = Object.fromEntries(head.map((k, i) => [k, i]));
  
  // 載入菜單以供名稱對照
  const menuSh = _menu();
  const menus = menuSh.getDataRange().getValues();
  const mh = menus.shift();
  const M = Object.fromEntries(mh.map((k, i) => [k, i]));
  const menuMap = {};
  menus.forEach(r => {
    const rid = String(r[M.RestaurantID] || '').trim();
    const iid = String(r[M.ItemID] || '').trim();
    if (rid && iid) {
      menuMap[rid + '-' + iid] = String(r[M.ItemName] || '').trim();
    }
  });
  
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  
  const freq = {};
  rows.forEach(r => {
    if (String(r[H.EmployeeName] || '').trim() !== String(employeeName).trim()) return;
    if (String(r[H.RestaurantID] || '').trim() !== String(restaurantId).trim()) return;
    
    const d = r[H.Date];
    let orderDate;
    if (d instanceof Date) { orderDate = d; }
    else { orderDate = new Date(String(d)); }
    if (isNaN(orderDate.getTime()) || orderDate < cutoff) return;
    
    const itemId = String(r[H.ItemID] || '').trim();
    const orderItemName = H.ItemName >= 0 ? String(r[H.ItemName] || '').trim() : '';
    const customName = H.CustomItemName >= 0 ? String(r[H.CustomItemName] || '').trim() : '';
    const menuName = menuMap[restaurantId + '-' + itemId] || '';
    const itemName = orderItemName || menuName || customName || '未知餐點';
    
    const note = H.Note >= 0 ? String(r[H.Note] || '').trim() : '';
    const sweetness = H.Sweetness >= 0 ? String(r[H.Sweetness] || '').trim() : '';
    const ice = H.Ice >= 0 ? String(r[H.Ice] || '').trim() : '';
    const unitPrice = H.UnitPrice >= 0 ? Number(r[H.UnitPrice] || 0) : 0;
    
    if (!itemId || itemId === '_OTHER_') return;
    
    const key = itemId + '|' + note + '|' + sweetness + '|' + ice;
    if (!freq[key]) {
      freq[key] = { itemId: itemId, itemName: itemName, note: note, sweetness: sweetness, ice: ice, unitPrice: unitPrice, count: 0 };
    }
    freq[key].count++;
  });
  
  const sorted = Object.values(freq).sort((a, b) => b.count - a.count);
  return sorted.slice(0, 5);
}

/**** 新品展示天數設定 ****/
function updateNewItemDisplayDays(days, adminName) {
  _checkAdmin(adminName);
  const sh = _settings();
  const data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === 'NewItemDisplayDays') {
      sh.getRange(i + 1, 2).setValue(Number(days) || 7);
      return { success: true };
    }
  }
  sh.appendRow(['NewItemDisplayDays', Number(days) || 7]);
  return { success: true };
}
