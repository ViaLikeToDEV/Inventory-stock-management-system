// 🚨 ใส่ Sheet ID ของ Google Sheet ที่จะใช้เก็บสต็อกก่อน Deploy
const SHEET_ID = '1eN7U5gyH5Q4khVKGbng4DKVkWa809aoxR84tq9ARv4c';

const STOCK_SHEET_NAME = 'Stocks';
const STOCK_HEADERS = ['barcode', 'product_name', 'count', 'updated_at'];

function doGet(e) {
  if (e.parameter.action === 'get-stocks') return handleGetStocks();
  return respond({ status: 'error', message: 'Unknown action' }, 400);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || e.parameter.action;

    if (!action) {
      return respond({ status: 'error', message: 'Missing action parameter' });
    }

    if (action === 'add-stock') return handleAddStock(payload);
    if (action === 'edit-stock') return handleEditStock(payload);
    if (action === 'delete-stock') return handleDeleteStock(payload);
    if (action === 'decrement-stock') return handleDecrementStock(payload);
    if (action === 'bulk-upsert-stock') return handleBulkUpsertStock(payload);

    return respond({ status: 'error', message: 'Unknown action' }, 400);
  } catch (err) {
    return respond({ status: 'error', message: err.message }, 500);
  }
}

// ─── Sheet access ───────────────────────────────────────────
function getStockSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(STOCK_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(STOCK_SHEET_NAME);
    const headerRange = sheet.getRange(1, 1, 1, STOCK_HEADERS.length);
    headerRange.setValues([STOCK_HEADERS]);
    headerRange.setFontWeight('bold');
  }

  return sheet;
}

// หาแถวของ barcode ที่ต้องการ (คืน row index แบบ 1-based ของ getDataRange, หรือ -1 ถ้าไม่เจอ)
function findStockRow_(sheet, barcode) {
  const data = sheet.getDataRange().getValues();
  const target = String(barcode).trim();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === target) return i + 1; // +1 เพราะ getRange เป็น 1-based
  }

  return -1;
}

// ─── Actions ────────────────────────────────────────────────
function handleGetStocks() {
  const sheet = getStockSheet_();
  const rows = sheet.getDataRange().getValues().slice(1);

  const data = rows
    .filter(r => String(r[0]).trim() !== '')
    .map(r => ({
      barcode: String(r[0]),
      productName: String(r[1] || ''),
      count: Number(r[2]) || 0,
    }));

  return respond({ success: true, data });
}

function handleAddStock(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getStockSheet_();
    const barcode = String(payload.barcode || '').trim();

    if (!barcode) {
      return respond({ status: 'error', message: 'ต้องระบุ Barcode' }, 400);
    }

    if (findStockRow_(sheet, barcode) !== -1) {
      return respond({ status: 'error', message: 'Barcode นี้มีอยู่ในระบบแล้ว' }, 400);
    }

    sheet.appendRow([
      barcode,
      payload.productName || '',
      Number(payload.count) || 0,
      new Date().toISOString(),
    ]);

    return respond({ status: 'success', message: 'เพิ่มสต็อกเรียบร้อย' });
  } finally {
    lock.releaseLock();
  }
}

function handleEditStock(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getStockSheet_();
    const barcode = String(payload.barcode || '').trim();
    const row = findStockRow_(sheet, barcode);

    if (row === -1) {
      return respond({ status: 'error', message: 'ไม่พบ Barcode นี้ในระบบ' }, 404);
    }

    sheet.getRange(row, 2).setValue(payload.productName || '');
    sheet.getRange(row, 3).setValue(Number(payload.count) || 0);
    sheet.getRange(row, 4).setValue(new Date().toISOString());

    return respond({ status: 'success', message: 'อัปเดตเรียบร้อย' });
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteStock(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getStockSheet_();
    const barcode = String(payload.barcode || '').trim();

    if (!barcode) {
      return respond({ status: 'error', message: 'ต้องระบุ Barcode' }, 400);
    }

    const row = findStockRow_(sheet, barcode);

    if (row === -1) {
      return respond({ status: 'error', message: 'ไม่พบ Barcode นี้ในระบบ' }, 404);
    }

    sheet.deleteRow(row);

    return respond({ status: 'success', message: 'ลบสต็อกเรียบร้อย' });
  } finally {
    lock.releaseLock();
  }
}

// ใช้โดย Laravel ตอนแพ็คออเดอร์สำเร็จ เพื่อตัดสต็อกตาม barcode/quantity
function handleDecrementStock(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getStockSheet_();
    const barcode = String(payload.barcode || '').trim();
    const quantity = Number(payload.quantity) || 0;
    const row = findStockRow_(sheet, barcode);

    if (row === -1) {
      return respond({ success: false, error: 'not_found', message: 'ไม่พบ Barcode นี้ในระบบสต็อก' }, 200);
    }

    const countCell = sheet.getRange(row, 3);
    const newCount = Math.max(0, (Number(countCell.getValue()) || 0) - quantity);
    countCell.setValue(newCount);
    sheet.getRange(row, 4).setValue(new Date().toISOString());

    return respond({ success: true, status: 'success', barcode, count: newCount });
  } finally {
    lock.releaseLock();
  }
}

// ใช้โดยหน้า Stocks admin ตอนกด "Save" หลังเทียบ catalog สินค้าจาก Shopee กับสต็อกปัจจุบัน:
// เพิ่ม barcode ใหม่ที่ยังไม่มีในสต็อก (count ตามที่ส่งมา), ส่วน barcode ที่มีอยู่แล้วจะอัปเดตแค่ product_name (ไม่แตะ count)
function handleBulkUpsertStock(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const items = payload.items;

    if (!Array.isArray(items) || items.length === 0) {
      return respond({ status: 'error', message: 'ต้องระบุ items เป็น array' }, 400);
    }

    const sheet = getStockSheet_();
    const now = new Date().toISOString();
    let inserted = 0;
    let updated = 0;

    items.forEach(item => {
      const barcode = String(item.barcode || '').trim();
      if (!barcode) return;

      const row = findStockRow_(sheet, barcode);

      if (row === -1) {
        sheet.appendRow([barcode, item.productName || '', Number(item.count) || 0, now]);
        inserted++;
      } else {
        sheet.getRange(row, 2).setValue(item.productName || '');
        sheet.getRange(row, 4).setValue(now);
        updated++;
      }
    });

    return respond({ status: 'success', message: 'ซิงก์สต็อกเรียบร้อย', inserted, updated });
  } finally {
    lock.releaseLock();
  }
}

// ─── HELPER ───────────────────────────────────────────────
function respond(data, status = 200) {
  return ContentService
    .createTextOutput(JSON.stringify({ status, ...data }))
    .setMimeType(ContentService.MimeType.JSON);
}
