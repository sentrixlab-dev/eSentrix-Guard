# AI Customer Data Checker - 24/7 Harvester & Multi-Source Scraper Plan

This document outlines the detailed strategy for updating the AI Customer Data Checker with a 24/7 background crawler (integrating EliteMart and FraudChecker.link), a generic Courier API key rotation/pooling mechanism, SQLite scans database transition, user data isolation, dynamic Excel export, and the integration of a premium v0.app-designed UI.

## User Review Required

> [!IMPORTANT]
> **Planning Mode Active**: No code changes will be made to the project files until you review and approve this plan.
> 
> **v0.app UI Integration**:
> - We will integrate the premium HTML/CSS code generated from v0.app into [public/index.html](file:///c:/laragon/www/Ai-Customer-Data-Checker/public/index.html) and [public/style.css](file:///c:/laragon/www/Ai-Customer-Data-Checker/public/style.css).
> - We will map all dynamic elements: circular percentage gauge, stats cards, the CRT scanner screen (digit spin animation & equalizer waveform), controls (run, loop, upload), and the Live Results table.
> - **API Configuration Tab:** Add a new "API" tab in the desktop navigation rail (placed between *Analytics* and *User Profile*). This tab will allow adding multiple API keys for **any** courier or third-party verification service (e.g., BD Courier, Steadfast, etc.). Added keys will be shown in a table/list above with their courier name, connection status, and daily usage counters (which reset daily).
> 
> **Sound Effects Integration**:
> - We will implement HTML5 Audio triggers for standard sound files (provided by the user):
>   - *Generate Sound*: Plays when a new number is generated for scanning.
>   - *Success/Match Sound*: Plays when a valid customer record is found (Orders > 0).
>   - *Failed/No-Data Sound*: Plays when a checked number has no delivery history (Orders = 0).
>   - *Scan End Sound*: Plays when the queue scan completes.
> 
> **Multi-Source Scraper & API Key Rotation**:
> - **EliteMart Scraper:** Reuses the existing selector binding to search `https://elitemart.com.bd/fraud-check-2`.
> - **FraudChecker.link Scraper:** Adds support for scraping `https://fraudchecker.link` using Puppeteer stealth. It will input the phone number, trigger search, and extract orders, delivery success, and cancellation numbers.
> - **Generic API Key Rotation (Random Pooling):** Instead of using a single key, we will store a pool of API keys for various couriers in the SQLite database. For every API request to a specific courier (e.g. BD Courier), the crawler will randomly select an active key belonging to that courier to spread the load. Each key's usage counter will increment in real-time and reset daily.
> - **Fallback & Aggregation:** If public sources fail or return empty records, the system rotates to the configured courier API using a randomly selected key for that courier.
> 
> **User Data Isolation & Database Migration**:
> - All scan data and the generic API keys pool (with search counters and reset times) will be stored in the SQLite database, isolated by `user_id`. Excel exports will be generated dynamically on-the-fly from this user-specific data.

---

## Proposed Changes

### 1. UI Integration & Asset Binding

#### [MODIFY] [public/index.html](file:///c:/laragon/www/Ai-Customer-Data-Checker/public/index.html)
- Integrate the v0.app structure containing the premium header, left sidebar navigation, main dashboard, and bottom footer badges.
- **Add API Nav Item & Tab Screen:** Insert the API navigation button between Analytics and Profile tabs. Create the corresponding `<section id="tab-api" class="tab-content">` containing:
  - An API key addition form: Courier Select dropdown (BD Courier, Steadfast, etc., or Custom name field), Key input field, and "Add Key" button.
  - A table/list displaying all registered keys, showing: Courier Name, Key Value (masked), Status (Connected/Disconnected), Daily Usage Count, and Action (Delete).
- Map the circular progress gauge circle dash-offset and gradients.
- Bind the Socket.io listeners to update the CRT scanner UI.
- Add `<audio>` tags for sound effects (`generate.mp3`, `success.mp3`, `fail.mp3`, `complete.mp3`).

#### [MODIFY] [public/style.css](file:///c:/laragon/www/Ai-Customer-Data-Checker/public/style.css)
- Replace with the premium stylesheet from v0.app. Add custom CSS rules for circular percentage transitions, 3D text styling, and equalizer keyframes.

---

### 2. SQLite Database Schema Migration

#### [MODIFY] [sqlite_db.js](file:///c:/laragon/www/Ai-Customer-Data-Checker/sqlite_db.js)
- Add column migration step to add the `courier` column to the `scans` table.
- Create a new `api_keys` table to store `id`, `user_id`, `courier_name`, `key_value`, `status`, `usage_count`, and `last_reset_time`.

---

### 3. SQLite Scan Operations & User Isolation

#### [MODIFY] [database.js](file:///c:/laragon/www/Ai-Customer-Data-Checker/database.js)
- Update `saveCustomerData(data, userId)` to insert into SQLite `scans` table instead of writing directly to the global Excel file.
- Update `getAllData(userId)` to query `SELECT * FROM scans WHERE user_id = ?` grouped by scan date.
- Update `deleteCustomerRecord(phone, userId)` to delete from `scans`.
- Implement `generateUserExcel(userId)` to query SQLite and write to a dynamic Excel stream using arrays in ExcelJS.
- Implement API key database operations: `addApiKey(userId, courierName, key)`, `getApiKeys(userId)`, `incrementKeyUsage(keyId)`, `deleteApiKey(keyId)`, and `resetDailyUsageIfNeeded(userId)`.

---

### 4. Crawling Engine, Sounds & Socket.io

#### [MODIFY] [index.js](file:///c:/laragon/www/Ai-Customer-Data-Checker/index.js)
- Update Socket.io listeners to pass `req.session.userId` to all database operations.
- Add Socket.io listeners for API key management (`add_api_key`, `get_api_keys`, `delete_api_key`).
- Trigger Socket.io progress/result events to include sound trigger signals (e.g. `{ sound: 'success' }` or `{ sound: 'fail' }`).
- Implement the generic API key pool rotation inside `courierApiManager.js` using a random key selection strategy for the required courier.
- Integrate the Multi-Source Scraper logic in `fraudChecker.js` to query both EliteMart and FraudChecker.link using Puppeteer stealth.

---

## Verification Plan

### Manual Verification
- Verify the v0.app layout renders correctly on desktop and mobile browsers.
- Verify the circular progress gauge updates and changes color dynamically depending on the success rate.
- Test the new API tab: add multiple keys for different couriers (BD Courier, Steadfast), verify they appear in the list, and check that daily usage counts increment when they are used.
- Verify that daily counters reset correctly after 24 hours.
- Confirm that the crawler selects keys randomly from the pool when fetching from the selected courier APIs.
- Test the phone number digit spin transition and the equalizer wave animation.
- Verify that the sound effects play at the correct moments (generation, success, failure, completion).
- Test user data isolation (database tab and Excel export).
