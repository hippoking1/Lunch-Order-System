# 午餐訂餐系統 (Lifestyle Premium) - 完整部署教學手冊

本手冊指導如何將系統從舊有 Google Apps Script (GAS) 完整搬遷部署至 **GitHub Pages (前端靜態託管) + Firebase (Firestore 資料庫 + Cloud Functions 後端 + Firebase Auth 管理員認證)**。

---

## 📌 目錄
1. [前置準備與 Firebase 專案設定](#1-前置準備與-firebase-專案設定)
2. [舊有 Google Sheets 資料庫搬遷至 Firestore](#2-舊有-google-sheets-資料庫搬遷至-firestore)
3. [部署 Firebase Cloud Functions 後端](#3-部署-firebase-cloud-functions-後端)
4. [GitHub 建立 Repo 與推送程式碼](#4-github-建立-repo-與推送程式碼)
5. [GitHub Pages 啟用與自動部署 (CI/CD)](#5-github-pages-啟用與自動部署-cicd)
6. [建立後台管理員帳號](#6-建立後台管理員帳號)
7. [驗證清單與上線切換](#7-驗證清單與上線切換)

---

## 1. 前置準備與 Firebase 專案設定

### 步驟 1.1：建立專案與升級 Blaze
1. 前往 [Firebase Console](https://console.firebase.google.com/)。
2. 點擊 **「新增專案」**，專案名稱輸入：`Lunch-Order-system`（或自訂名稱，請記住專案 ID）。
3. Google Analytics 可視需求開啟或關閉。
4. 專案建立完成後，左下角升級計費方案至 **Blaze (隨用隨付)** 方案（每月享有 200 萬次免費調用額度，訂餐系統實際使用量月費為 $0）。

### 步驟 1.2：啟用 Firestore Database
1. 左側選單進入 **「建構 (Build)」>「Firestore Database」**。
2. 點擊 **「建立資料庫」**。
3. 位置請選擇 `asia-east1 (台灣)`。
4. 安全性規則先選擇 **以測試模式啟動**（後續部署會自動套用專案內的安全性規則）。

### 步驟 1.3：啟用 Firebase Authentication (管理員認證)
1. 左側選單進入 **「建構 (Build)」>「Authentication」**，點擊 **「開始使用」**。
2. 進入 **「登入方式 (Sign-in method)」**：
   - 啟用 **Google**：設定專案公開名稱與支援 Email。
   - 啟用 **電子郵件/密碼**：開啟「電子郵件/密碼」。
3. 進入 **「設定 (Settings)」>「已授權的網域 (Authorized domains)」**：
   - ⚠️ **極為重要**：請點擊「新增網域」，將 GitHub Pages 網域（例如 `hippoking1.github.io`）或自訂網域名稱加入授權清單。若未加入，使用 Google 登入時彈窗會直接被拒絕並報錯 `auth/popup-closed-by-user`。

### 步驟 1.4：取得網頁設定參數 (Web Config)
1. 進入 **專案設定 (Project settings)** > **一般 (General)**。
2. 滑至最下方「你的應用程式」，點擊 **`</>` (網頁)** 圖示註冊應用程式（名稱可填 `Lunch Order Web`）。
3. 註冊後複製 `firebaseConfig` 物件中的金鑰內容備用：
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

---

## 2. 舊有 Google Sheets 資料庫搬遷至 Firestore

### 步驟 2.1：從 Google Sheets 匯出資料為 JSON
1. 開啟你原有的訂餐系統 Google 試算表。
2. 點擊頂部選單 **擴充功能 > Apps Script**。
3. 在專案中新建一個指令檔（例如 `ExportData.gs`），將專案中 `scripts/export-sheets.gs` 的完整內容貼入。
4. 頂部函數下拉選單選擇 `exportAllSheetsDataToJson`，點擊 **執行**（若跳出權限請求請點「審查權限」並同意）。
5. 執行完成後，開啟你的 Google Drive，下載根目錄下生成的 **`lunch-order-export.json`** 檔案。

### 步驟 2.2：使用本地腳本一鍵匯入 Firestore
1. 前往 Firebase Console > **專案設定** > **服務帳戶 (Service accounts)**。
2. 點擊 **「產生新的私密金鑰」**，會下載一個 `.json` 檔案。
3. 將該金鑰檔案重命名為 **`serviceAccountKey.json`**，放入本專案根目錄。
4. 將步驟 2.1 下載的 **`lunch-order-export.json`** 檔案也放在本專案根目錄。
5. 在本專案根目錄開啟終端機（PowerShell / CMD），執行：
   ```bash
   node scripts/import-local.mjs
   ```
6. 終端機會顯示各表匯入統計（Users, Restaurants, MenuItems, ItemPortions, Orders 等），並自動建立 `normalizedName`（去除空白/全形轉半形/小寫）的品項名稱比對索引！
7. 匯入完成後，請**刪除**本機的 `serviceAccountKey.json` 避免洩露金鑰。

> 原 Google 試算表建議保留並設為「僅供檢視」，最上方註明「⚠️ 此試算表僅供歷史存檔，新系統已遷移至網頁版」。

---

## 3. 部署 Firebase Cloud Functions 後端

### 步驟 3.1：安裝 Firebase CLI 並登入
```bash
npm install -g firebase-tools
firebase login
```

### 步驟 3.2：連結專案
在專案根目錄執行：
```bash
firebase use --add
```
選擇你建立的 `Lunch-Order-system` 專案，別名輸入 `default`。

### 步驟 3.3：部署 Functions 與 Firestore 索引/規則
```bash
cd firebase
firebase deploy --only firestore:rules,firestore:indexes,functions
cd ..
```
*部署完成後，所有的點餐 Callable API 以及 Cloud Scheduler 每日定時過期特價/限定商品任務即自動上線啟用！*

---

## 4. GitHub 建立 Repo 與推送程式碼

1. 前往 [GitHub](https://github.com/new) 建立一個新的 Repository（例如 `lunch-order-system`，設定為 Public 或 Private 皆可）。
2. 在本地專案根目錄執行：
   ```bash
   git init
   git add .
   git commit -m "feat: migrate ordering system to GitHub Pages + Firebase"
   git branch -M main
   git remote add origin https://github.com/<你的用戶名>/<你的Repo名稱>.git
   git push -u origin main
   ```

---

## 5. GitHub Pages 啟用與自動部署 (CI/CD)

### 步驟 5.1：設定 GitHub Secrets
為了安全管理 Firebase 金鑰，請在你的 GitHub Repo 設定中填入環境變數：
1. 進入你的 GitHub Repo > **Settings** > **Secrets and variables** > **Actions**。
2. 點擊 **New repository secret**，依序新增以下 6 個 Secret（內容對應步驟 1.4 的 Firebase 參數）：
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

### 步驟 5.2：開啟 GitHub Pages
1. 進入 GitHub Repo > **Settings** > **Pages**。
2. 在 **Build and deployment** 下的 **Source**，切換為 **`GitHub Actions`**。
3. 只要推送程式碼到 `main` 分支（或在 Actions 頁籤手動觸發 `Deploy to GitHub Pages`），GitHub Actions 即會自動執行編譯並發布至：
   `https://<你的用戶名>.github.io/<你的Repo名稱>/`

---

## 6. 建立後台管理員帳號

為了確保後台菜單管理的安全性，後台管理全面使用 Firebase Auth 認證：

1. **建立帳號**：
   - 方式 A (Google 登入)：直接在網站後台登入頁點擊「使用 Google 帳號一鍵登入」。
   - 方式 B (Email/密碼)：在 Firebase Console > **Authentication** > **Users** > 點擊「Add user」手動新增管理員 Email 與密碼。
2. **賦予管理員權限**：
   - 開啟 Firebase Console > **Firestore Database** > `users` 集合。
   - 找到對應的員工文件（或以管理員 Email / UID 建立文件），設定欄位：
     - `role`: `"admin"`
     - `email`: `"你的管理員Email"`
3. 進入前台網頁，點擊右上角 **「⚙️ 後台管理」**，使用該帳號登入即可存取完整菜單管理面板！

---

## 7. 驗證清單與上線切換

部署完成後，請依照以下檢查表進行全面驗證：

- [ ] **員工選取與餘額**：
  - 輸入員工姓名，餘額正確顯示。
  - 「使用餘額」預設為 **取消勾選**（Bug 8 修正），員工可自由決定是否扣餘額。
  - 當餘額為 0 或小於訂單金額時，點餐絕不報錯，自動切換現金支付。
- [ ] **點餐與連動選擇器**：
  - 正餐 / 飲料 / 甜點 種類切換正常。
  - 餐廳卡片點選後自動定位滾動至餐點。
  - 自填餐點與價格輸入正常。
  - 配料「X選Y」折抵金額計算 100% 正確。
- [ ] **刪單與找零退款**：
  - 餘額扣款訂單刪除時，款項正確退還至員工帳戶。
  - 現金付款訂單刪除時，不擅自回存至線上餘額，並提示現金退款。
- [ ] **餐廳鎖定機制**：
  - 點擊「鎖定此餐廳」後，跨裝置即時生效。
  - 對帳確認訂單後，後端自動解除鎖定。
- [ ] **菜單名稱比對更新 (需求 2)**：
  - 在後台「文字匯入」或「CSV 匯入」舊品項時，無論 ID 為何，只要名稱一致，系統皆正確判定為「價格/品項更新」而非重複新增。
- [ ] **管理員認證 (需求 1)**：
  - 點擊後台管理若未登入會彈出身分驗證卡片，登入後方可進入，並可安全登出。
- [ ] **跨裝置響應式介面**：
  - 電腦端雙欄並排（點餐 + 對帳總覽）。
  - 手機端底部導覽列切換流暢。
