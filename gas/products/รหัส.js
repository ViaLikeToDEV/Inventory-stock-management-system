function doGet(e) {
  if (e.parameter.action === "version") return getVersion()
}

const SHEET_ID = '1oLI-lw2pDaMuo5B8lXEicIzcZycI7nDWmyjwy7s6P1U';


function doPost(e) {
  try {
    // ปิด initSheets() ออกไปซะ รันมือครั้งเดียวพอเพื่อประหยัดเวลาต่อ Request
    // initSheets(); 

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    if (!action) {
      return respond({ status: 'error', message: 'Missing action parameter' });
    }
    
    if (action === 'productsinfolists')   return handleproductsinfolists(payload);

    //เพิ่ม
    if (action === 'get_products_joined') return getAllProductsJoined();
    if (action === 'edit_product_full') return handleEditProductFull(payload);
    if (action === 'add_product_full') return handleAddProductFull(payload);
    
    return respond({ error: 'Unknown action' }, 400);
  } catch (err) {
    return respond({ error: err.message }, 500);
  }
}



function handleproductsinfolists(payload){
  const ss     = SpreadsheetApp.openById(SHEET_ID);
  const products = ss.getSheetByName('Products');
  const variants  = ss.getSheetByName('Variants');
  const meta  = ss.getSheetByName('meta');

let missingSheets = [];

if (!products) {
  missingSheets.push("Products");
  
  // สร้าง sheet "Products" และใส่ header ของ product
  products_sheet = ss.insertSheet("Products");
  const products_headers = [["product_id", "product_name", "is_active"]];
  const products_headerRange = products_sheet.getRange(1, 1, 1, products_headers[0].length);
  products_headerRange.setValues(products_headers);
  products_headerRange.setFontWeight("bold");
}

if (!variants) {
  missingSheets.push("Variants");
  
  // สร้าง sheet "Variants" (หรือจะใส่โลจิกสร้างเพิ่มตรงนี้)
  // สมมติต้องใส่ header ของ variants
  const variants_sheet = ss.insertSheet("Variants"); 
  const variants_headers = [["sku", "product_id", "variant_name", "barcode", "is_active", "bundle"]];
  const variants_headerRange = variants_sheet.getRange(1, 1, 1, variants_headers[0].length);
  variants_headerRange.setValues(variants_headers);
  variants_headerRange.setFontWeight("bold");
}

if (!meta) {
  missingSheets.push("Meta");
  ss.insertSheet("meta"); 

}

// 2. ถ้ามีอันใดอันหนึ่งหาย (Array ไม่ว่าง) ให้ส่ง Warning กลับไป
if (missingSheets.length > 0) {
  // join ด้วย ', ' เช่น "Products, Variants" หรือจะเป็นแค่อันเดียวก็ได้
  const warningSheet = missingSheets.join(" and "); 
  
  return respond({
    status: 'warning',
    message: `${warningSheet} sheet not found`,
  });
}

  const readProducts = products.getDataRange().getValues().slice(1);
  const readVariants = variants.getDataRange().getValues().slice(1);
  const currentVersion = meta.getRange("A1").getValue();
  
  return respond({
    status: 'success',
    version: currentVersion,
    sheets: {
      Products: {
        rows: readProducts
      },
      Variants: {
        rows: readVariants
      },
    }
  })
}


function getVersion() {
  const version = SpreadsheetApp.openById(SHEET_ID)
    .getSheetByName("meta")
    .getRange("A1").getValue()
  return ContentService.createTextOutput(version)
    .setMimeType(ContentService.MimeType.TEXT)
}

//เพิ่มดึง Products และ Variants มามัดรวมกัน
function getAllProductsJoined() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const productSheet = ss.getSheetByName('Products');
  const variantSheet = ss.getSheetByName('Variants');
  const metaSheet = ss.getSheetByName('meta');

  if (!productSheet || !variantSheet) {
    return respond({ status: 'error', message: 'หาชีต Products หรือ Variants ไม่เจอ' });
  }

  const currentVersion = metaSheet ? metaSheet.getRange("A1").getValue() : 0;
  const prodData = productSheet.getDataRange().getValues().slice(1);
  const varData = variantSheet.getDataRange().getValues().slice(1);

  let resultList = [];

  for (let p of prodData) {
    const pId = p[0];
    const pName = p[1];
    const pIsActive = p[2];

    if (!pId || pIsActive === false || pIsActive === "FALSE" || pIsActive === "") continue;

    let matchingVariants = [];
    
    for (let v of varData) {
      const vSku = v[0];
      const vProdId = v[1];
      const vName = v[2];
      const vBarcode = v[3];
      const vIsActive = v[4];
      const vBundle = v[5];

      // 🚨 จุดที่แก้: ใส่ String() ครอบ vProdId กับ pId เพื่อบังคับให้มันเทียบตัวอักษรตรงๆ!
      if (String(vProdId) === String(pId) && vIsActive !== false && vIsActive !== "FALSE" && vIsActive !== "") {
        matchingVariants.push({
          sku: String(vSku || ''),
          variantName: String(vName || ''),
          barcode: String(vBarcode || ''),
          bundle: String(vBundle || '')
        });
      }
    }

    if (matchingVariants.length > 0) {
      resultList.push({
        id: pId,
        productName: pName,
        variants: matchingVariants
      });
    }
  }

  return respond({ status: 'success', version: currentVersion, data: resultList });
}

// เพิ่มฟังก์ชันแก้ไขข้อมูลเฉพาะจุด และอัปเดต Meta
function handleEditProductFull(payload) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const pSheet = ss.getSheetByName('Products');
  const vSheet = ss.getSheetByName('Variants');
  const metaSheet = ss.getSheetByName('meta');

  if (!pSheet || !vSheet) {
    return respond({ status: 'error', message: 'หาชีต Products หรือ Variants ไม่เจอ' });
  }

  const targetProductId = payload.id;
  
  // =======================================
  // 1. อัปเดตชื่อสินค้าหลัก (ชีต Products)
  // =======================================
  const pData = pSheet.getDataRange().getValues();
  for (let i = 1; i < pData.length; i++) {
    if (String(pData[i][0]) === String(targetProductId)) {
      pSheet.getRange(i + 1, 2).setValue(payload.productName);
      break; 
    }
  }

  // =======================================
  // 2. อัปเดตสินค้าย่อย (ชีต Variants)
  // =======================================
  const vData = vSheet.getDataRange().getValues();
  
  payload.variants.forEach(variantPayload => {
    let isFound = false;
    let isActive = variantPayload.is_active !== false; 

    // เก็บชื่อเก่ามาค้นหา
    let searchSku = variantPayload.original_sku ? String(variantPayload.original_sku).trim() : String(variantPayload.sku).trim();

    for (let i = 1; i < vData.length; i++) {
      if (String(vData[i][0]).trim() === searchSku && String(vData[i][1]) === String(targetProductId)) {
        
        vSheet.getRange(i + 1, 1).setValue(variantPayload.sku); 

        vSheet.getRange(i + 1, 3).setValue(variantPayload.variantName); // Variant Name
        vSheet.getRange(i + 1, 4).setValue(variantPayload.barcode);     // Barcode
        
        // แก้ไขเป็น Checkbox และตั้งค่าตามสถานะ (Soft Delete = false)
        vSheet.getRange(i + 1, 5).insertCheckboxes().setValue(isActive); 
        
        vSheet.getRange(i + 1, 6).setValue(variantPayload.bundle);      // Bundle
        isFound = true;
        break;
      }
    }

    // ถ้าเป็น SKU ใหม่ และ "ยังไม่ถูกลบ" ให้เพิ่มบรรทัดใหม่
    if (!isFound && variantPayload.sku && variantPayload.sku.trim() !== '' && isActive) {
      vSheet.appendRow([
        variantPayload.sku,
        targetProductId,
        variantPayload.variantName,
        variantPayload.barcode,
        true, 
        variantPayload.bundle || ''
      ]);
      // Checkbox 
      vSheet.getRange(vSheet.getLastRow(), 5).insertCheckboxes().setValue(true);
    }

    // ========================================================
    // เปลี่ยน SKU ใน Bundle ของสินค้าตัวอื่น
    // ========================================================
      const oldSku = String(variantPayload.original_sku).trim();
      const newSku = String(variantPayload.sku).trim();
      
      // ดึง Data ล่าสุดมาไล่เช็คคอลัมน์ Bundle (คอลัมน์ F) ทุกบรรทัดบนแผ่นชีต
      const latestVData = vSheet.getDataRange().getValues();
      
      for (let j = 1; j < latestVData.length; j++) {
        let bundleStr = latestVData[j][5]; // คอลัมน์ F (index 5)
        
        if (bundleStr && bundleStr.trim() !== '' && bundleStr !== '[]') {
          try {
            let bundleItems = JSON.parse(bundleStr);
            let isBundleUpdated = false;
            
            if (Array.isArray(bundleItems)) {
              bundleItems.forEach(item => {
                // ถ้าในเซ็ตแพ็คอันไหน แอบอ้างถึง SKU เก่าตัวนี้อยู่...
                if (item.type === 'origin_sku' && String(item.sku).trim() === oldSku) {
                  item.sku = newSku; // สลับเปลี่ยนเป็นรหัสใหม่ให้ทันที
                  item.display_product_name = payload.productName; // อัปเดตชื่อสินค้าให้ตรงกันด้วย
                  item.display_variant = variantPayload.variantName; // อัปเดตตัวเลือกให้ตรงกันด้วย
                  isBundleUpdated = true;
                }
              });
              
              // ถ้าเจอและแก้เสร็จ ให้เขียนทับก้อน JSON บรรทัดนั้นกลับลงแผ่นชีต
              if (isBundleUpdated) {
                vSheet.getRange(j + 1, 6).setValue(JSON.stringify(bundleItems));
              }
            }
          } catch(e) {
            // ข้ามแถวที่ JSON พัง
          }
        }
      }
    

  });

  // =======================================
  // 3. อัปเดตเลข Meta
  // =======================================
  let newMetaVersion = 1;
  if (metaSheet) {
    const currentMeta = metaSheet.getRange("A1").getValue() || 0;
    newMetaVersion = Number(currentMeta) + 1;
    metaSheet.getRange("A1").setValue(newMetaVersion);
  }

  return respond({ 
    status: 'success', 
    message: 'อัปเดตข้อมูลและ Meta เรียบร้อย',
    new_version: newMetaVersion
  });
}

// ฟังก์ชันเพิ่มสินค้าใหม่ (Variants อัปเดต Meta)
function handleAddProductFull(payload) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const pSheet = ss.getSheetByName('Products');
  const vSheet = ss.getSheetByName('Variants');
  const metaSheet = ss.getSheetByName('meta');

  if (!pSheet || !vSheet) return respond({ status: 'error', message: 'หาชีตไม่เจอ' });

  // =======================================
  // 1. หา Product ID ล่าสุด เพื่อรันเลขต่อไป (Auto Increment)
  // =======================================
  const pData = pSheet.getDataRange().getValues();
  let maxId = 0;
  for (let i = 1; i < pData.length; i++) {
    let currentId = Number(pData[i][0]);
    if (!isNaN(currentId) && currentId > maxId) {
      maxId = currentId;
    }
  }
  const newProductId = maxId + 1;

  // =======================================
  // 2. บันทึกสินค้าหลักลงชีต Products
  // =======================================
  pSheet.appendRow([newProductId, payload.productName, true]);
  // บังคับคอลัมน์ is_active ให้เป็น Checkbox
  pSheet.getRange(pSheet.getLastRow(), 3).insertCheckboxes().setValue(true);

  // =======================================
  // 3. บันทึกสินค้าย่อยลงชีต Variants
  // =======================================
  payload.variants.forEach(v => {
    if (v.sku && v.sku.trim() !== '') {
      vSheet.appendRow([
        v.sku,
        newProductId,
        v.variantName || '',
        v.barcode || '',
        true,
        v.bundle || ''
      ]);
      // บังคับคอลัมน์ is_active ให้เป็น Checkbox
      vSheet.getRange(vSheet.getLastRow(), 5).insertCheckboxes().setValue(true);
    }
  });

  // =======================================
  // 4. อัปเดตเลข Meta (บวก 1)
  // =======================================
  let newMetaVersion = 1;
  if (metaSheet) {
    const currentMeta = metaSheet.getRange("A1").getValue() || 0;
    newMetaVersion = Number(currentMeta) + 1;
    metaSheet.getRange("A1").setValue(newMetaVersion);
  }

  return respond({ 
    status: 'success', 
    message: 'เพิ่มสินค้าและ Meta เรียบร้อย',
    new_version: newMetaVersion
  });
}

// ─── HELPER ───────────────────────────────────────────────
function respond(data, status = 200) {
  return ContentService
    .createTextOutput(JSON.stringify({ status, ...data }))
    .setMimeType(ContentService.MimeType.JSON);
}