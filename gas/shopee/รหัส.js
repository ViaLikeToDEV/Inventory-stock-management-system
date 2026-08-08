// ═══════════════════════════════════════════════════════════════════
//  ISMS ShopeeDB — Google Apps Script
//  doPost handler + initializeSheets + batchInsert + Index management
// ═══════════════════════════════════════════════════════════════════

// ─── CONSTANTS ────────────────────────────────────────────────────

const CONFIG = {
  MASTER_SHEET: "Master",
  INDEX_SHEET:  "Index",
  LOCK_TIMEOUT: 10000, // ms — doPost waits max 10s for lock
};

// Column positions in Master Sheet (1-indexed, maps to A-H)
const COL = {
  TRACKING:   1,  // A — Primary Key
  ORDER_SN:   2,  // B — indexed
  SKU:        3,  // C — JSON string
  TIMESTAMP:  4,  // D — ISO 8601 (inserted at)
  IS_PACKED:  5,  // E — 0 | 1
  PACKED_AT:  6,  // F — ISO 8601 | "" (null)
  IS_ACTIVE:  7,  // G — 1 = active, 0 = soft-deleted
  YEAR_MONTH: 8,  // H — derived "YYYY-MM", partition key for queries
};

// Master Sheet header row (must match COL positions above)
const MASTER_HEADERS = [
  "tracking_number",
  "order_sn",
  "product_info_sku",
  "TimeStamp",
  "IsPacked",
  "PackedAt",
  "IsActive",
  "YearMonth",
];

// Index Sheet header row
const INDEX_HEADERS = [
  "tracking_number",  // A — lookup key
  "row_index",        // B — row number in Master Sheet (1-indexed)
  "YearMonth",        // C — for month-based queries
  "order_sn",
];


// ═══════════════════════════════════════════════════════════════════
//  ENTRY POINT: doPost
// ═══════════════════════════════════════════════════════════════════

function doPost(e) {
  // ── 1. Parse incoming payload ──────────────────────────────────
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, error: "Invalid JSON payload: " + err.message });
  }

  const action = (payload.action || "").toLowerCase();

  // ── 2. Route by action ─────────────────────────────────────────
  switch (action) {
    case "insert":
      return handleInsert(payload);

    case "pack":
      return handlePack(payload);

    case "query_unpacked":
      return handleQueryUnpacked();

    case "deactivate":
      return handleDeactivate(payload);

    case "query":
      return handleQuery(payload);

    case "rebuild_index":
      return handleRebuildIndex();

    case "query_single":
      return handleQuerySingleOptimized(payload);

    case "query_daily_summary":
      return handleQueryDailySummary(payload);

    case "query_daily":
      return handleQueryDaily(payload);
      
    case "query_sku_summary":
      return handleQuerySkuSummary(payload);

    default:
      return jsonResponse({ success: false, error: `Unknown action: "${action}"` });
  }
}


// ═══════════════════════════════════════════════════════════════════
//  INIT: Create sheet structure if it doesn't exist (idempotent)
// ═══════════════════════════════════════════════════════════════════

/**
 * Creates Master + Index sheets with correct headers if absent.
 * Safe to call multiple times — checks existence before creating.
 * MUST be called inside a LockService lock (handled by callers).
 */
function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── Master Sheet ──────────────────────────────────────────────
  let master = ss.getSheetByName(CONFIG.MASTER_SHEET);
  if (!master) {
    master = ss.insertSheet(CONFIG.MASTER_SHEET);
    const headerRange = master.getRange(1, 1, 1, MASTER_HEADERS.length);
    headerRange.setValues([MASTER_HEADERS]);

    // Style: freeze header row, bold, background
    master.setFrozenRows(1);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#E8F5E9"); // light green — matches teal theme

    // Column widths for readability
    master.setColumnWidth(COL.TRACKING,   180);
    master.setColumnWidth(COL.ORDER_SN,   160);
    master.setColumnWidth(COL.SKU,        300);
    master.setColumnWidth(COL.TIMESTAMP,  160);
    master.setColumnWidth(COL.IS_PACKED,   80);
    master.setColumnWidth(COL.PACKED_AT,  160);
    master.setColumnWidth(COL.IS_ACTIVE,   80);
    master.setColumnWidth(COL.YEAR_MONTH, 100);

    Logger.log("[initializeSheets] Master sheet created.");
  }

  // ── Index Sheet ───────────────────────────────────────────────
  let idx = ss.getSheetByName(CONFIG.INDEX_SHEET);
  if (!idx) {
    idx = ss.insertSheet(CONFIG.INDEX_SHEET);
    const headerRange = idx.getRange(1, 1, 1, INDEX_HEADERS.length);
    headerRange.setValues([INDEX_HEADERS]);

    idx.setFrozenRows(1);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#EDE7F6"); // light purple

    idx.setColumnWidth(1, 180);
    idx.setColumnWidth(2,  80);
    idx.setColumnWidth(3, 100);

    Logger.log("[initializeSheets] Index sheet created.");
  }

  return { master, idx };
}


// ═══════════════════════════════════════════════════════════════════
//  INSERT HANDLER — accepts array of order objects or CSV-parsed rows
// ═══════════════════════════════════════════════════════════════════

/**
 * Payload shape (from WebApp after CSV parse):
 * {
 *   "action": "insert",
 *   "rows": [
 *     {
 *       "tracking_number": "TH267097911330J",
 *       "order_sn": "260505HYJKR5VT",
 *       "product_info_sku": "[{\"sku\":\"โจ๊กคละ 4 รส\",\"quantity\":5,\"price\":104}]"
 *     },
 *     ...
 *   ]
 * }
 */
function handleInsert(payload) {
  // ── Validate ──────────────────────────────────────────────────
  const rows = payload.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return jsonResponse({ success: false, error: "payload.rows must be a non-empty array" });
  }

  // ── Acquire script-level lock ─────────────────────────────────
  // Prevents two simultaneous doPost calls from creating duplicate rows
  // or initializing sheets twice
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT);
  } catch (err) {
    return jsonResponse({ success: false, error: "Server busy. Please retry." });
  }

  try {
    // ── Ensure sheets exist (idempotent) ─────────────────────────
    const { master, idx } = initializeSheets();

    // ── Load existing tracking numbers from Index for dedup ──────
    const existingKeys = loadExistingKeys(idx);

    // ── Build batch rows, skip duplicates ────────────────────────
    const now          = new Date();
    const masterRows   = [];  // rows to append to Master
    const indexRows    = [];  // rows to append to Index
    const skipped      = [];  // duplicate tracking_numbers
    const inserted     = [];  // successfully inserted

    // Next row number in Master after current data
    const startRow = master.getLastRow() + 1;
    let nextMasterRow = startRow;

    for (const item of rows) {
      // ── Required field validation ──────────────────────────────
      const tracking = sanitize(item.tracking_number);
      const orderSn  = sanitize(item.order_sn);
      const sku      = sanitize(item.product_info_sku);

      if (!tracking || !orderSn) {
        skipped.push({ tracking, reason: "missing required field" });
        continue;
      }

      // ── Dedup check ───────────────────────────────────────────
      if (existingKeys.has(tracking)) {
        skipped.push({ tracking, reason: "duplicate tracking_number" });
        continue;
      }

      // ── Derive YearMonth from payload timestamp or now ─────────
      const ts        = item.timestamp ? new Date(item.timestamp) : now;
      const yearMonth = Utilities.formatDate(ts, "UTC", "yyyy-MM");

      // ── Build Master row (must match MASTER_HEADERS order) ─────
      masterRows.push([
        tracking,
        orderSn,
        sku,
        ts.toISOString(),
        0,
        "",
        1,
        "'" + yearMonth,  // ← apostrophe บังคับ Sheets เก็บเป็น plain text
      ]);

      // ── Build Index row ────────────────────────────────────────
      indexRows.push([tracking, nextMasterRow, "'" + yearMonth, orderSn]); // ✅
      existingKeys.add(tracking);
      inserted.push(tracking);
      nextMasterRow++; // ✅
    }

    // ── Batch write to Master (single API call) ───────────────────
    if (masterRows.length > 0) {
      master
      .getRange(startRow, 1, masterRows.length, MASTER_HEADERS.length)
      .setValues(masterRows);
    }

    // ── Batch write to Index (single API call) ────────────────────
    if (indexRows.length > 0) {
      idx
        .getRange(idx.getLastRow() + 1, 1, indexRows.length, INDEX_HEADERS.length)
        .setValues(indexRows);
    }

    return jsonResponse({
      success:  true,
      inserted: inserted.length,
      skipped:  skipped.length,
      details: {
        inserted,
        skipped,
      },
    });

  } finally {
    // ALWAYS release lock — even if an error occurs
    lock.releaseLock();
  }
}

function handleQueryDaily(payload) {
  // 1. จัดการ Default Date ถ้าไม่ได้ส่งมา (ใช้ Server Date แบบ UTC)
  let targetDate = sanitize(payload.date);
  if (!targetDate) {
    targetDate = new Date().toISOString().split('T')[0];
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return jsonResponse({ success: false, error: "date must be YYYY-MM-DD format" });
  }

  const yearMonth = targetDate.substring(0, 7);

  const index = loadIndex();
  // หา Row ทั้งหมดในเดือนนั้นเพื่อบีบ Scope การดึงข้อมูล
  const targetRows = Object.values(index)
    .filter(e => e.yearMonth === yearMonth)
    .map(e => e.row);

  if (targetRows.length === 0) {
    return jsonResponse({ success: true, date: targetDate, count: 0, data: [] });
  }

  const minRow = Math.min(...targetRows);
  const maxRow = Math.max(...targetRows);
  const totalRowsToFetch = (maxRow - minRow) + 1;

  const master = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.MASTER_SHEET);
  // ดึง Chunk แบบ Batch API call รอบเดียว ประหยัดแรง Server
  const rawChunk = master.getRange(minRow, 1, totalRowsToFetch, MASTER_HEADERS.length).getValues();

  const targetRowsSet = new Set(targetRows);
  const results = [];

  for (let i = 0; i < rawChunk.length; i++) {
    const currentRowNum = minRow + i;
    
    if (targetRowsSet.has(currentRowNum)) {
      const rowData = rawChunk[i];

      // เช็กก่อนว่าออเดอร์ยัง Active อยู่ (ไม่โดน Soft-delete)
      if (isActiveRow(rowData)) {
        const timeStampStr = String(rowData[COL.TIMESTAMP - 1] || "");
        
        // กรองเฉพาะ Date ที่ตรงกัน
        if (timeStampStr.startsWith(targetDate)) {
          // ยัดเข้า helper rowToObject ของเดิมเลย ได้โครงสร้างข้อมูลแบบเดียวกันชัวร์ๆ
          results.push(rowToObject(rowData));
        }
      }
    }
  }

  return jsonResponse({ 
    success: true, 
    date: targetDate, 
    count: results.length, 
    data: results 
  });
}

function handleQuerySingleOptimized(payload) {
  if (!payload) return jsonResponse({ success: false, error: "Payload is required" });

  const rawInput = payload.tracking_number || payload.order_sn || payload.id;
  const inputKey = sanitize(rawInput);
  if (!inputKey) return jsonResponse({ success: false, error: "Missing identifier" });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const idx = ss.getSheetByName(CONFIG.INDEX_SHEET);
  const master = ss.getSheetByName(CONFIG.MASTER_SHEET);

  // 1. ค้นหาในคอลัมน์ Tracking (A) ก่อนด้วย TextFinder (ไวมาก)
  let foundCells = idx.getRange("A:A").createTextFinder(inputKey).matchEntireCell(true).findAll();
  
  // 2. ถ้าไม่เจอใน Tracking ให้ลองหาใน Order_SN (D)
  if (foundCells.length === 0) {
    foundCells = idx.getRange("D:D").createTextFinder(inputKey).matchEntireCell(true).findAll();
  }

  // 3. จัดการกรณีไม่เจอ
  if (foundCells.length === 0) {
    return jsonResponse({ success: false, error: `Order not found: ${inputKey}` });
  }

  // 4. จัดการกรณีเจอหลายออเดอร์ (Multiple Match จาก Order_SN)
  if (foundCells.length > 1) {
    const rowNums = foundCells.map(cell => cell.getRow());
    const minRow = Math.min(...rowNums);
    const maxRow = Math.max(...rowNums);
    
    // ตรงนี้ดึงจาก Master โดยอิงจาก Row ของ Index (เพราะเลข Row ใน Index ถูกเก็บไว้ในคอลัมน์ B)
    // แต่เพื่อความชัวร์และอิงตาม Logic เดิมของคุณ ต้องดึงเลข Row ของ Master ออกมาก่อน
    const masterRows = foundCells.map(cell => idx.getRange(cell.getRow(), 2).getValue());
    const minMasterRow = Math.min(...masterRows);
    const maxMasterRow = Math.max(...masterRows);
    
    const chunk = master
      .getRange(minMasterRow, 1, maxMasterRow - minMasterRow + 1, MASTER_HEADERS.length)
      .getValues();

    const rowNumSet = new Set(masterRows);
    const results = [];
    for (let i = 0; i < chunk.length; i++) {
      if (rowNumSet.has(minMasterRow + i) && isActiveRow(chunk[i])) {
        results.push(rowToObject(chunk[i]));
      }
    }

    return jsonResponse({
      success: true,
      multiple: true,
      count: results.length,
      data: results,
    });
  }

  // 5. จัดการกรณีเจอตัวเดียว (Single Match)
  const indexRow = foundCells[0].getRow();
  const masterRowNum = idx.getRange(indexRow, 2).getValue(); // ดึงค่าจากคอลัมน์ B (row_index)
  
  const rowData = master.getRange(masterRowNum, 1, 1, MASTER_HEADERS.length).getValues()[0];

  if (!isActiveRow(rowData)) {
    return jsonResponse({ success: false, error: `Order ${inputKey} has been deactivated.` });
  }

  return jsonResponse({ success: true, data: rowToObject(rowData) });
}

// ═══════════════════════════════════════════════════════════════════
//  PACK HANDLER
// ═══════════════════════════════════════════════════════════════════

function handlePack(payload) {
  const tracking = sanitize(payload.tracking_number);
  if (!tracking) {
    return jsonResponse({ success: false, error: "tracking_number is required" });
  }

  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT); } 
  catch (e) { return jsonResponse({ success: false, error: "Server busy." }); }

  try {
    const index = loadIndex();
    const entry = index[tracking];
    if (!entry) {
      return jsonResponse({ success: false, error: `Not found: ${tracking}` });
    }

    const master = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.MASTER_SHEET);
    const now = new Date();

    // ดึง 3 columns: IS_PACKED (E), PACKED_AT (F), IS_ACTIVE (G)
    const snapshot = master.getRange(entry.row, COL.IS_PACKED, 1, 3).getValues()[0];
    const isPacked  = snapshot[0];
    const packedAt  = snapshot[1];
    const isActive  = snapshot[2];

    // เช็ค soft-delete ก่อนเสมอ
    if (isActive !== 1 && isActive !== "1" && isActive !== true) {
      return jsonResponse({ success: false, error: `Order ${tracking} has been deactivated.` });
    }

    // Idempotency check
    if (isPacked === 1 || isPacked === "1" || isPacked === true) {
      return jsonResponse({ success: true, tracking_number: tracking, already_packed: true, packed_at: packedAt });
    }

    // ปลอดภัยแล้ว → pack ได้
    master
      .getRange(entry.row, COL.IS_PACKED, 1, 2)
      .setValues([[1, now.toISOString()]]);

    return jsonResponse({ success: true, tracking_number: tracking, packed_at: now.toISOString() });

  } finally {
    lock.releaseLock();
  }
}


// ═══════════════════════════════════════════════════════════════════
//  DEACTIVATE HANDLER (soft delete)
// ═══════════════════════════════════════════════════════════════════

function handleDeactivate(payload) {
  const tracking = sanitize(payload.tracking_number);
  if (!tracking) {
    return jsonResponse({ success: false, error: "tracking_number is required" });
  }

  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT); } 
  catch (e) { return jsonResponse({ success: false, error: "Server busy." }); }

  try {
    const index = loadIndex();
    const entry = index[tracking];
    if (!entry) {
      return jsonResponse({ success: false, error: `Not found: ${tracking}` });
    }

    SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.MASTER_SHEET)
      .getRange(entry.row, COL.IS_ACTIVE)
      .setValue(0);

    return jsonResponse({ success: true, tracking_number: tracking, status: "deactivated" });

  } finally {
    lock.releaseLock();
  }
}

function handleQueryDailySummary(payload) {
  const targetDate = sanitize(payload.date);
  
  // เช็กว่าฟอร์แมตวันที่ส่งมาเป็น YYYY-MM-DD ตามมาตรฐานไหม
  if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return jsonResponse({ success: false, error: "date must be YYYY-MM-DD format" });
  }

  // หั่นเอาแค่ YYYY-MM เพื่อไปควานหา Index ของเดือนนั้น
  const yearMonth = targetDate.substring(0, 7); 

  const index = loadIndex();
  const targetRows = Object.values(index)
    .filter(e => e.yearMonth === yearMonth)
    .map(e => e.row);

  // ถ้าเดือนนั้นทั้งเดือนไม่มีออเดอร์เลย ก็คืนค่า 0 สวยๆ ไม่ต้องสืบต่อ
  if (targetRows.length === 0) {
    return jsonResponse({ success: true, date: targetDate, total: 0, packed: 0 });
  }

  const minRow = Math.min(...targetRows);
  const maxRow = Math.max(...targetRows);
  const totalRowsToFetch = (maxRow - minRow) + 1;

  const master = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.MASTER_SHEET);
  const rawChunk = master.getRange(minRow, 1, totalRowsToFetch, MASTER_HEADERS.length).getValues();
  
  const targetRowsSet = new Set(targetRows);
  
  let totalOrders = 0;
  let packedOrders = 0;

  for (let i = 0; i < rawChunk.length; i++) {
    const currentRowNum = minRow + i;
    if (targetRowsSet.has(currentRowNum)) {
      const rowData = rawChunk[i];
      
      // เช็กก่อนว่าออเดอร์ยัง Active อยู่ (ไม่โดน Soft-delete)
      const isActive = rowData[COL.IS_ACTIVE - 1];
      if (isActive === 1 || isActive === "1" || isActive === true) {
        
        // TimeStamp เก็บเป็น ISO 8601 (เช่น 2026-06-05T14:48:00.000Z)
        // เลยใช้ startsWith เช็กวันที่ได้เลยตรงๆ
        const timeStampStr = String(rowData[COL.TIMESTAMP - 1] || "");
        if (timeStampStr.startsWith(targetDate)) {
          totalOrders++; // นับ Total
          
          const isPacked = rowData[COL.IS_PACKED - 1];
          if (isPacked === 1 || isPacked === "1" || isPacked === true) {
            packedOrders++; // นับจำนวนที่แพ็คแล้ว
          }
        }
      }
    }
  }

  return jsonResponse({ 
    success: true, 
    date: targetDate, 
    total: totalOrders, 
    packed: packedOrders 
  });
}

/**
 * SINGLE ORDER QUERY HANDLER
 * Payload format: { "action": "query_single", "tracking_number": "TH267097911330J" }
 */
function handleQuerySingle(payload) {
  if (!payload) {
    return jsonResponse({ success: false, error: "Payload is required" });
  }

  const rawInput = payload.tracking_number || payload.order_sn || payload.id;
  const inputKey = sanitize(rawInput);

  if (!inputKey) {
    return jsonResponse({ success: false, error: "Missing identifier (tracking_number, order_sn, or id)" });
  }

  const index = loadIndex();
  let entry = index[inputKey];

  // ── Auto-detect: fallback ไป _orderSnMap ถ้าหา tracking ตรงๆ ไม่เจอ ──
  if (!entry && index._orderSnMap) {
    const entries = index._orderSnMap[inputKey];

    if (entries && entries.length > 0) {
      if (entries.length === 1) {
        // single match → ไหลต่อด้านล่างปกติ
        entry = entries[0];

      } else {
        // multiple match → batch fetch แล้วคืนเลย
        const master = SpreadsheetApp.getActiveSpreadsheet()
                         .getSheetByName(CONFIG.MASTER_SHEET);

        // ✅ batch: หา minRow/maxRow แล้วดึงครั้งเดียว
        const rowNums = entries.map(e => e.row);
        const minRow  = Math.min(...rowNums);
        const maxRow  = Math.max(...rowNums);
        const chunk   = master
          .getRange(minRow, 1, maxRow - minRow + 1, MASTER_HEADERS.length)
          .getValues();

        const rowNumSet = new Set(rowNums);
        const results   = [];
        for (let i = 0; i < chunk.length; i++) {
          if (rowNumSet.has(minRow + i) && isActiveRow(chunk[i])) {
            results.push(rowToObject(chunk[i]));
          }
        }

        return jsonResponse({
          success:  true,
          multiple: true,
          count:    results.length,
          data:     results,
        });
      }
    }
  }

  if (!entry || !entry.row) {
    return jsonResponse({ success: false, error: `Order not found: ${inputKey}` });
  }

  try {
    const master  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.MASTER_SHEET);
    const maxRows = master.getLastRow();

    if (entry.row > maxRows) {
      return jsonResponse({ success: false, error: "Index mismatch. Please rebuild index." });
    }

    const rowData = master.getRange(entry.row, 1, 1, MASTER_HEADERS.length).getValues()[0];

    // ✅ ใช้ helper เดียวกันทั้ง codebase
    if (!isActiveRow(rowData)) {
      return jsonResponse({ success: false, error: `Order ${inputKey} has been deactivated.` });
    }

    return jsonResponse({ success: true, data: rowToObject(rowData) });

  } catch (err) {
    console.error(`[handleQuerySingle] ${err.message}`);
    return jsonResponse({ success: false, error: "Internal server error." });
  }
}

function isActiveRow(rowData) {
  const v = rowData[COL.IS_ACTIVE - 1];
  return v === 1 || v === "1" || v === true;
}


// ═══════════════════════════════════════════════════════════════════
//  QUERY HANDLER
// ═══════════════════════════════════════════════════════════════════

/**
 * Payload: { "action": "query", "yearMonth": "2026-06" }
 * Returns all active rows for that month.
 */
function handleQuery(payload) {
  const yearMonth = sanitize(payload.yearMonth);
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return jsonResponse({ success: false, error: "yearMonth must be YYYY-MM format" });
  }

  const index = loadIndex();
  // หา Row range ที่ต่ำที่สุดและสูงที่สุดที่ต้องใช้ เพื่อบีบขอบเขตการดึงข้อมูล
  const targetRows = Object.values(index)
    .filter(e => e.yearMonth === yearMonth)
    .map(e => e.row);

  if (targetRows.length === 0) {
    return jsonResponse({ success: true, yearMonth, data: [] });
  }

  const minRow = Math.min(...targetRows);
  const maxRow = Math.max(...targetRows);
  const totalRowsToFetch = (maxRow - minRow) + 1;

  const master = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.MASTER_SHEET);
  
  // 🔥 แฮกประสิทธิภาพ: ดึงข้อมูลเป็น Chunk ก้อนเดียวจาก minRow ถึง maxRow (API Call ครั้งเดียว!)
  const rawChunk = master.getRange(minRow, 1, totalRowsToFetch, MASTER_HEADERS.length).getValues();
  
  // แปลง targetRows ให้เป็น Set เพื่อให้ค้นหาได้ไวขึ้น ($O(1)$)
  const targetRowsSet = new Set(targetRows);
  const results = [];

  for (let i = 0; i < rawChunk.length; i++) {
    const currentRowNum = minRow + i;
    if (targetRowsSet.has(currentRowNum)) {
      const rowData = rawChunk[i];
      if (isActiveRow(rowData)) {
        results.push(rowToObject(rowData));
      }
    }
  }

  return jsonResponse({ success: true, yearMonth, count: results.length, data: results });
}

/**
 * REBUILD INDEX — ปรับปรุงให้ดึงเฉพาะคอลัมน์ที่จำเป็น ไม่โหลด SKU (JSON) มาให้หนักแรม
 */
function rebuildIndex() {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const master = ss.getSheetByName(CONFIG.MASTER_SHEET);
  const idx    = ss.getSheetByName(CONFIG.INDEX_SHEET);
  if (!master || !idx) throw new Error("Sheets not initialized.");

  const lastRow = master.getLastRow();
  if (lastRow < 2) return;

  // 🔥 ดึงเฉพาะคอลัมน์ Tracking (A) และ YearMonth (H) ไม่ดึงคอลัมน์อื่น! ประหยัดแรมมหาศาล
  const trackingData = master.getRange(1, COL.TRACKING, lastRow, 1).getValues();
  const yearMonthData = master.getRange(1, COL.YEAR_MONTH, lastRow, 1).getValues();
  const orderSnData = master.getRange(1, COL.ORDER_SN, lastRow, 1).getValues();

  idx.clearContents();
  idx.getRange(1, 1, 1, INDEX_HEADERS.length).setValues([INDEX_HEADERS]);

  const newRows = [];
  for (let i = 1; i < lastRow; i++) { // i=0 คือ Header
    const tracking  = trackingData[i][0];
    const yearMonth = yearMonthData[i][0];
    const orderSn = orderSnData[i][0];
    if (tracking) {
      newRows.push([tracking, i + 1, "'" + yearMonth, orderSn]);
    }
  }

  if (newRows.length > 0) {
    idx.getRange(2, 1, newRows.length, INDEX_HEADERS.length).setValues(newRows);
  }

  Logger.log(`[rebuildIndex] Rebuilt ${newRows.length} entries.`);
}


// ═══════════════════════════════════════════════════════════════════
//  REBUILD INDEX
// ═══════════════════════════════════════════════════════════════════

function handleRebuildIndex() {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT); } 
  catch (e) { return jsonResponse({ success: false, error: "Server busy." }); }

  try {
    rebuildIndex();
    return jsonResponse({ success: true, message: "Index rebuilt." });
  } finally {
    lock.releaseLock();
  }
}

// ═══════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════

/** Load Index Sheet into a JS Object for O(1) lookup. */
/** Load Index Sheet into a JS Object for O(1) lookup. */
function loadIndex() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const idx = ss.getSheetByName(CONFIG.INDEX_SHEET);
  if (!idx) return {};

  // ── ไม่ใช้ Cache เพราะ Index ใหญ่เกิน 100KB limit ──
  const data  = idx.getDataRange().getValues();
  const index = {};

  Object.defineProperty(index, '_orderSnMap', {
    value: {}, writable: true, enumerable: false, configurable: true
  });

  if (data.length < 2) return index;

  for (let i = 1; i < data.length; i++) {
    const tracking = data[i][0];
    const rowNum   = data[i][1];
    const orderSn  = String(data[i][3] || "").trim();

    const rawYM     = data[i][2];
    const yearMonth = rawYM instanceof Date
      ? Utilities.formatDate(rawYM, "UTC", "yyyy-MM")
      : String(rawYM).substring(0, 7);

    if (tracking) {
      const entry = { row: rowNum, yearMonth, orderSn };
      index[tracking] = entry;

      if (orderSn) {
        if (!index._orderSnMap[orderSn]) index._orderSnMap[orderSn] = [];
        index._orderSnMap[orderSn].push(entry);
      }
    }
  }

  return index;
}

/** Load only the tracking_number column from Index into a Set (for dedup). */
function loadExistingKeys(idxSheet) {
  const lastRow = idxSheet.getLastRow();
  if (lastRow < 2) return new Set(); // only header or empty
  const data = idxSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  return new Set(data.flat().filter(Boolean));
}

/** Map a raw Master Sheet row array → named object. */
function rowToObject(r) {
  let skuData = r[COL.SKU - 1];
  
  // ลองแกะ JSON String ออกมา ถ้าแกะไม่ได้ (เช่น ค่าว่าง หรือ ฟอร์แมตพัง) ให้ Fallback เป็นค่าเดิม
  try {
    if (skuData) {
      skuData = JSON.parse(skuData);
    }
  } catch (e) {
    Logger.log("[rowToObject] Failed to parse SKU JSON: " + e.message);
    skuData = r[COL.SKU - 1]; // พังก็ปล่อยไหลเป็นสตริงดิบไปก่อน
  }

  return {
    tracking_number:  r[COL.TRACKING   - 1],
    order_sn:          r[COL.ORDER_SN   - 1],
    product_info_sku: skuData, // คืนค่าที่เป็น Object/Array ที่สมบูรณ์แล้ว
    TimeStamp:        r[COL.TIMESTAMP  - 1],
    IsPacked:          r[COL.IS_PACKED  - 1],
    PackedAt:          r[COL.PACKED_AT  - 1],
    IsActive:          r[COL.IS_ACTIVE  - 1],
    YearMonth:        r[COL.YEAR_MONTH - 1],
  };
}

/**
 * Strip Excel CSV artifacts:
 * - UTF-8 BOM (\uFEFF)
 * - Windows CRLF (\r)
 * - leading/trailing whitespace
 * Returns "" if value is null/undefined.
 */
function sanitize(value) {
  if (value == null) return "";
  return String(value)
    .replace(/^\uFEFF/, "")  // BOM
    .replace(/\r/g, "")      // Windows CRLF
    .trim();
}

/** Wrap any response object as ContentService JSON. */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


function handleQueryUnpacked() {
  const index = loadIndex();
  
  // ดึงรายการ Row ทั้งหมดที่มีจาก Index เพื่อนำมาหาขอบเขต min/max
  const targetRows = Object.values(index).map(e => e.row);

  if (targetRows.length === 0) {
    return jsonResponse({ success: true, count: 0, data: [] });
  }

  const minRow = Math.min(...targetRows);
  const maxRow = Math.max(...targetRows);
  const totalRowsToFetch = (maxRow - minRow) + 1;

  const master = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.MASTER_SHEET);
  
  // 🔥 ดึงข้อมูลเป็น Chunk ก้อนเดียวจาก Master (ประหยัด API Call ของ Google)
  const rawChunk = master.getRange(minRow, 1, totalRowsToFetch, MASTER_HEADERS.length).getValues();
  
  const targetRowsSet = new Set(targetRows);
  const results = [];

  for (let i = 0; i < rawChunk.length; i++) {
    const currentRowNum = minRow + i;
    
    if (targetRowsSet.has(currentRowNum)) {
      const rowData = rawChunk[i];
      
      // 1. เช็กก่อนว่าออเดอร์ยัง Active อยู่ (ไม่โดน Soft-delete)
      if (isActiveRow(rowData)) {
        const isPacked = rowData[COL.IS_PACKED - 1];
        
        // 2. กรองเฉพาะออเดอร์ที่ยังไม่ถูกแพ็ค (IsPacked === 0 หรือค่าว่าง/false)
        if (isPacked === 0 || isPacked === "0" || isPacked === false || isPacked === "") {
          
          // ใช้ helper rowToObject ของเดิมเพื่อแปลงฟอร์แมต JSON SKU ให้ถูกต้องอัตโนมัติ
          results.push(rowToObject(rowData));
        }
      }
    }
  }

  return jsonResponse({ 
    success: true, 
    count: results.length, 
    data: results 
  });
}

function handleQuerySkuSummary(payload) {
  // Optional filter: date (YYYY-MM-DD) หรือ yearMonth (YYYY-MM)
  const filterDate       = sanitize(payload.date);       // e.g. "2026-06-27"
  const filterYearMonth  = sanitize(payload.yearMonth);  // e.g. "2026-06"

  const index = loadIndex();
  let targetRows = Object.values(index).map(e => e.row);

  // ── กรองตาม yearMonth ก่อน (ถ้ามี) ──
  if (filterYearMonth) {
    targetRows = Object.values(index)
      .filter(e => e.yearMonth === filterYearMonth)
      .map(e => e.row);
  } else if (filterDate) {
    // date → หา yearMonth จาก date แล้วกรอง
    const ym = filterDate.substring(0, 7);
    targetRows = Object.values(index)
      .filter(e => e.yearMonth === ym)
      .map(e => e.row);
  }

  if (targetRows.length === 0) {
    return jsonResponse({ success: true, summary: {} });
  }

  const minRow = Math.min(...targetRows);
  const maxRow = Math.max(...targetRows);
  const master = SpreadsheetApp.getActiveSpreadsheet()
                   .getSheetByName(CONFIG.MASTER_SHEET);
  const rawChunk = master
    .getRange(minRow, 1, maxRow - minRow + 1, MASTER_HEADERS.length)
    .getValues();

  const targetRowsSet = new Set(targetRows);

  // skuMap: { "โจ๊กคละ 4 รส": { packed: 0, unpacked: 0, total: 0 } }
  const skuMap = {};

  for (let i = 0; i < rawChunk.length; i++) {
    const currentRowNum = minRow + i;
    if (!targetRowsSet.has(currentRowNum)) continue;

    const rowData = rawChunk[i];
    if (!isActiveRow(rowData)) continue;

    // กรองตามวัน (ถ้าระบุมา)
    if (filterDate) {
      const ts = String(rowData[COL.TIMESTAMP - 1] || "");
      if (!ts.startsWith(filterDate)) continue;
    }

    const isPacked = rowData[COL.IS_PACKED - 1];
    const packed   = isPacked === 1 || isPacked === "1" || isPacked === true;

    // Parse SKU JSON
    let skuList = [];
    try {
      const raw = rowData[COL.SKU - 1];
      if (raw) skuList = JSON.parse(raw);
    } catch (e) {
      continue; // row พัง → ข้ามไป
    }

    // Aggregate ทีละ SKU ใน order นั้น
    for (const item of skuList) {
      const skuName = sanitize(item.sku);
      const qty     = Number(item.quantity) || 0;
      if (!skuName || qty <= 0) continue;

      if (!skuMap[skuName]) {
        skuMap[skuName] = { packed: 0, unpacked: 0, total: 0 };
      }

      skuMap[skuName].total += qty;
      if (packed) {
        skuMap[skuName].packed   += qty;
      } else {
        skuMap[skuName].unpacked += qty;
      }
    }
  }

  // แปลงเป็น Array เรียง unpacked มากสุดก่อน (ด่วนที่สุด)
  const summaryArray = Object.entries(skuMap)
    .map(([sku, v]) => ({ sku, ...v }))
    .sort((a, b) => b.unpacked - a.unpacked);

  return jsonResponse({
    success:    true,
    filter:     filterDate || filterYearMonth || "all",
    sku_count:  summaryArray.length,
    summary:    summaryArray,
  });
}


function debugIndexAndQuery() {
  // 1. ดู Index 5 แถวแรก — ตรวจ format จริงๆ ที่เก็บอยู่
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const idx = ss.getSheetByName(CONFIG.INDEX_SHEET);
  const idxData = idx.getRange(1, 1, Math.min(6, idx.getLastRow()), 4).getValues();
  Logger.log("=== INDEX SAMPLE ===");
  Logger.log(JSON.stringify(idxData));

  // 2. ดู Master 2 แถวแรก — ตรวจ YearMonth และ Timestamp ที่เก็บจริง
  const master = ss.getSheetByName(CONFIG.MASTER_SHEET);
  const masterData = master.getRange(1, 1, Math.min(3, master.getLastRow()), 8).getValues();
  Logger.log("=== MASTER SAMPLE ===");
  Logger.log(JSON.stringify(masterData));

  // 3. จำลอง loadIndex แล้วดูว่า yearMonth ใน entry เป็นอะไร
  const index = loadIndex();
  const entries = Object.values(index).slice(0, 3);
  Logger.log("=== LOADED INDEX ENTRIES (first 3) ===");
  Logger.log(JSON.stringify(entries));

  // 4. ดูว่า yearMonth ที่จะ query ตรงกับในนั้นไหม
  const testYearMonth = "2026-06"; // ← เปลี่ยนเป็นเดือนที่มีข้อมูลจริง
  const matched = Object.values(index).filter(e => e.yearMonth === testYearMonth);
  Logger.log(`=== MATCHED for ${testYearMonth}: ${matched.length} entries ===`);
  Logger.log(JSON.stringify(matched.slice(0, 3)));
}

function clearIndexCache() {
  CacheService.getScriptCache().remove('index_data');
  Logger.log("Cache cleared.");
}