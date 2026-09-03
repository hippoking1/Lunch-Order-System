/**
 * 請將此函數貼入 Google Apps Script (Code.gs) 中執行
 * 執行完成後會在你的 Google Drive 根目錄建立一個 lunch-order-export.json 檔案
 */
function exportAllSheetsDataToJson() {
  const ss = SpreadsheetApp.getActive();
  const targetSheets = [
    'Users',
    'Restaurants',
    'MenuItems',
    'ItemPortions',
    'Orders',
    'Confirmations',
    'SpecialPrices',
    'CategoryLocks',
    'Settings'
  ];

  const exportResult = {};

  targetSheets.forEach(sheetName => {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) {
      exportResult[sheetName] = [];
      return;
    }

    const data = sh.getDataRange().getValues();
    if (data.length < 1) {
      exportResult[sheetName] = [];
      return;
    }

    const headers = data.shift();
    exportResult[sheetName] = data.map(row => {
      const obj = {};
      headers.forEach((h, colIdx) => {
        let val = row[colIdx];
        if (val instanceof Date) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
        }
        obj[h] = val;
      });
      return obj;
    });
  });

  const jsonStr = JSON.stringify(exportResult, null, 2);
  const fileName = 'lunch-order-export.json';
  
  // 檢查是否已存在同名檔案，有則更新，無則建立
  const files = DriveApp.getFilesByName(fileName);
  let file;
  if (files.hasNext()) {
    file = files.next();
    file.setContent(jsonStr);
  } else {
    file = DriveApp.createFile(fileName, jsonStr, MimeType.PLAIN_TEXT);
  }

  Logger.log('=== 資料匯出成功 ===');
  Logger.log('檔案名稱: ' + fileName);
  Logger.log('檔案下載連結: ' + file.getDownloadUrl());
  Logger.log('可在 Drive 直接搜尋 lunch-order-export.json 下載');
  return file.getUrl();
}
