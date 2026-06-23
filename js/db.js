/* =========================================================
   EMS Stock Manager — db.js
   IndexedDB wrapper with seeded EMS inventory data
   ========================================================= */

const DB_NAME = 'EMSStockDB';
const DB_VERSION = 1;

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;

      // Items store
      if (!db.objectStoreNames.contains('items')) {
        const items = db.createObjectStore('items', { keyPath: 'item_id', autoIncrement: true });
        items.createIndex('barcode', 'barcode', { unique: false });
        items.createIndex('category', 'category', { unique: false });
        items.createIndex('location', 'location', { unique: false });
        items.createIndex('qr_code', 'qr_code', { unique: false });
      }

      // Transactions store
      if (!db.objectStoreNames.contains('transactions')) {
        const tx = db.createObjectStore('transactions', { keyPath: 'transaction_id', autoIncrement: true });
        tx.createIndex('item_id', 'item_id', { unique: false });
        tx.createIndex('datetime', 'datetime', { unique: false });
        tx.createIndex('transaction_type', 'transaction_type', { unique: false });
        tx.createIndex('user_name', 'user_name', { unique: false });
      }

      // Users store
      if (!db.objectStoreNames.contains('users')) {
        const users = db.createObjectStore('users', { keyPath: 'user_id', autoIncrement: true });
        users.createIndex('email', 'email', { unique: true });
        users.createIndex('role', 'role', { unique: false });
      }

      // Notifications store
      if (!db.objectStoreNames.contains('notifications')) {
        const notif = db.createObjectStore('notifications', { keyPath: 'notification_id', autoIncrement: true });
        notif.createIndex('item_id', 'item_id', { unique: false });
        notif.createIndex('status', 'status', { unique: false });
      }

      // Checklists store
      if (!db.objectStoreNames.contains('checklists')) {
        const cl = db.createObjectStore('checklists', { keyPath: 'checklist_id', autoIncrement: true });
        cl.createIndex('date', 'date', { unique: false });
        cl.createIndex('location', 'location', { unique: false });
      }

      // Sync queue store
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    req.onsuccess = e => {
      _db = e.target.result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

/* ── Generic helpers ── */
export async function dbGetAll(storeName, indexName, query) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = indexName ? store.index(indexName).getAll(query) : store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGet(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbPut(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbAdd(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbDelete(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbCount(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ── Settings ── */
export async function getSetting(key) {
  const row = await dbGet('settings', key);
  return row ? row.value : null;
}
export async function setSetting(key, value) {
  return dbPut('settings', { key, value });
}

/* ── Seed Data ── */
export async function seedDatabase() {
  const count = await dbCount('users');

  // Seed users if not yet created
  if (count === 0) {
    const users = [
      { full_name: 'Admin EMS', role: 'Administrator', email: 'admin@ems.local', password: 'admin1234', active: true },
      { full_name: 'Staff Nurse', role: 'Staff', email: 'staff@ems.local', password: 'staff1234', active: true },
      { full_name: 'Viewer EMS', role: 'Viewer', email: 'viewer@ems.local', password: 'viewer1234', active: true },
    ];
    for (const u of users) await dbAdd('users', u);
  }

  // Check if we already migrated to v2 (new 100-item list)
  const v2Flag = await getSetting('seeded_v2');
  if (v2Flag) return; // Already migrated

  // --- Migration: clear old data stores ---
  const db = await openDB();
  const storesToClear = ['items', 'transactions', 'notifications', 'checklists', 'sync_queue'];
  await new Promise((resolve, reject) => {
    const tx = db.transaction(storesToClear, 'readwrite');
    for (const name of storesToClear) {
      tx.objectStore(name).clear();
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  console.log('🔄 Cleared old data for v2 migration');

  // Seed items
  const now = new Date().toISOString();

  const items = [
    { barcode: 'EMS01', qr_code: 'EMS01', item_name: 'Endotracheal tube No.2.5', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS02', qr_code: 'EMS02', item_name: 'Endotracheal tube No.3', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS03', qr_code: 'EMS03', item_name: 'Endotracheal tube No.3.5', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS04', qr_code: 'EMS04', item_name: 'Endotracheal tube No.4', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS05', qr_code: 'EMS05', item_name: 'Endotracheal tube No.4.5', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS06', qr_code: 'EMS06', item_name: 'Endotracheal tube 5.0 มีcuff', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS07', qr_code: 'EMS07', item_name: 'Endotracheal tube No.5.5 มี Cuff', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS08', qr_code: 'EMS08', item_name: 'Endotracheal tube No.6 มี Cuff', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS09', qr_code: 'EMS09', item_name: 'Endotracheal tube No.6.5 มี CuffชนิดHighVolumeLow', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS10', qr_code: 'EMS10', item_name: 'Endotracheal tube No.7 มี CuffชนิดHighVolumeLow', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS11', qr_code: 'EMS11', item_name: 'Endotracheal tube No.7.5 มีCuffชนิดHighVolumeLow', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS12', qr_code: 'EMS12', item_name: 'Endotracheal tube No.8 มีCuff ชนิด High Volume Low', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS13', qr_code: 'EMS13', item_name: 'Endotracheal tube No.8.5 มีCuff', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS14', qr_code: 'EMS14', item_name: 'ท่อเปิดทางเดินหายใจทางจมูก (Nasalphalyngeal airway) ขนาด 7.0 mm', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS15', qr_code: 'EMS15', item_name: 'ท่อเปิดทางเดินหายใจทางจมูก (Nasalphalyngeal airway) ขนาด 7.5 mm', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS16', qr_code: 'EMS16', item_name: 'Stylet Endotracheal Tube Guide ขนาด 14 FR. (ผู้ใหญ่)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS17', qr_code: 'EMS17', item_name: 'Stylet Endotracheal Tube Guide ขนาด 10 FR. (เด็กโต)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS18', qr_code: 'EMS18', item_name: 'Stylet Endotracheal tube Guide No.8 (เด็กกลาง)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS19', qr_code: 'EMS19', item_name: 'Stylet Endotracheal Tube Guide No.6 (เด็กเล็ก)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS20', qr_code: 'EMS20', item_name: 'Oropharyngeal airway ขนาด 100 มม. (สีแดง)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS21', qr_code: 'EMS21', item_name: 'Oropharyngeal Air way ขนาด 90 มม. (สีเหลือง)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS22', qr_code: 'EMS22', item_name: 'Oropharyngeal airway ขนาด 80 มม. (สีเขียว)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS23', qr_code: 'EMS23', item_name: 'Oropharyngeal airway ขนาด 70 มม. (สีขาว)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS24', qr_code: 'EMS24', item_name: 'Oropharygeal Air Way 60 mm (สีดำ)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS25', qr_code: 'EMS25', item_name: 'Oropharyngeal airway ขนาด 50 มม (สีน้ำเงิน)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS26', qr_code: 'EMS26', item_name: 'Oro pharyngeal airway 40 mm (สีชมพู)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS28', qr_code: 'EMS28', item_name: 'อ๊อกซิเยนแคนนูล่า', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS29', qr_code: 'EMS29', item_name: 'Oxygen Mask ผู้ใหญ่ (adult)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS30', qr_code: 'EMS30', item_name: 'Oxygen Mask เด็ก(ped)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS31', qr_code: 'EMS31', item_name: 'สายซักชั่น เบอร์ 6', category: 'Suction Equipment', subcategory: 'Suction', unit: 'ชิ้น', current_stock: 10, minimum_stock: 4, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS32', qr_code: 'EMS32', item_name: 'สายซักชั่น เบอร์ 8', category: 'Suction Equipment', subcategory: 'Suction', unit: 'ชิ้น', current_stock: 10, minimum_stock: 4, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS33', qr_code: 'EMS33', item_name: 'สายซักชั่น เบอร์ 10', category: 'Suction Equipment', subcategory: 'Suction', unit: 'ชิ้น', current_stock: 10, minimum_stock: 4, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS34', qr_code: 'EMS34', item_name: 'สายซักชั่น เบอร์ 12', category: 'Suction Equipment', subcategory: 'Suction', unit: 'ชิ้น', current_stock: 10, minimum_stock: 4, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS35', qr_code: 'EMS35', item_name: 'สายซักชั่น เบอร์ 14', category: 'Suction Equipment', subcategory: 'Suction', unit: 'ชิ้น', current_stock: 10, minimum_stock: 4, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS36', qr_code: 'EMS36', item_name: 'สายซักชั่น เบอร์ 16', category: 'Suction Equipment', subcategory: 'Suction', unit: 'ชิ้น', current_stock: 10, minimum_stock: 4, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS37', qr_code: 'EMS37', item_name: '*กระบอกฉีดยาชนิดใช้แล้วทิ้ง 3 ซีซี.', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS38', qr_code: 'EMS38', item_name: '*กระบอกฉีดยาชนิดใช้แล้วทิ้ง 5 ซีซี.', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS39', qr_code: 'EMS39', item_name: '*กระบอกฉีดยาชนิดใช้แล้วทิ้ง 10 ซีซี', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS40', qr_code: 'EMS40', item_name: 'กระบอกฉีดยาดีสโพสเซเบิ้ล 20 ซีซี.', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS41', qr_code: 'EMS41', item_name: 'กระบอกฉีดยาชนิดใช้แล้วทิ้ง 50 ซีซี.', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS42', qr_code: 'EMS42', item_name: '*กระบอกฉีดยาชนิดใช้แล้วทิ้ง 1 ซีซี.อินซูลิน100ยูนิตเข็มเบอร์30', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS43', qr_code: 'EMS43', item_name: '*เข็มฉีดยาดีสโพสเซเบิ้ลเบอร์ 18x1 1/2 นิ้ว', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS44', qr_code: 'EMS44', item_name: '*เข็มฉีดยาดีสโพสเซเบิ้ลเบอร์ 20x1 1/2 นิ้ว', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS45', qr_code: 'EMS45', item_name: 'เข็มฉีดยาดีสโพสฯเบอร์ 21x1.1/2', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS46', qr_code: 'EMS46', item_name: 'เข็มฉีดยาดีสโพสเซเบิ้ล NO.22x1.5\"', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS47', qr_code: 'EMS47', item_name: '*เข็มฉีดยาดีสโพสเซเบิ้ล เบอร์ 23x1.5 นิ้ว', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS48', qr_code: 'EMS48', item_name: '*เข็มฉีดยาดีสโพสเซเบิ้ล เบอร์ 24x1.5 นิ้ว', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS49', qr_code: 'EMS49', item_name: '*เข็มฉีดยาดีสโพสเซเบิ้ล เบอร์ 25x1 นิ้ว', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS50', qr_code: 'EMS50', item_name: '*เข็มฉีดยาดีสโพสเซเบิ้ล No. 27x1/2\"', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS51', qr_code: 'EMS51', item_name: 'ไอ.วี. แคทดิเตอร์ เบอร์ 16x2 นิ้ว (16x1.77\")', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS52', qr_code: 'EMS52', item_name: 'ไอ.วี.แคทดิเตอร์ 18x2\"', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS53', qr_code: 'EMS53', item_name: '*ไอ.วี แคทดิเตอร์ เบอร์ 20 x 1 1/4\"-1 1/2\"(20x1.16\")', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS54', qr_code: 'EMS54', item_name: '*ไอ.วี แคทดิเตอร์ เบอร์ 22 x 1\"', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS55', qr_code: 'EMS55', item_name: '*ไอ.วี แคทดิเตอร์ เบอร์ 24 x 3/4\" (24x0.75\") หรือ 1 1/4\"', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS56', qr_code: 'EMS56', item_name: '*ไอ.วี แคทดิเตอร์ เบอร์ 18 x 1 1/4\"-1 1/2\" (18x1.16\")', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS57', qr_code: 'EMS57', item_name: 'ไอ.วี แคทดิเตอร์ เบอร์ 20x2 นิ้ว (20x1.88)', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS58', qr_code: 'EMS58', item_name: 'IV set ผู้ใหญ่ ชนิดธรรมดา', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชุด', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS59', qr_code: 'EMS59', item_name: 'สาย Extension tube 18\"', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS60', qr_code: 'EMS60', item_name: 'ทรีเวย์ Stopcock TW-0001', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS61', qr_code: 'EMS61', item_name: 'คอนเนตติ้ง ตัวตรง 7/4 มม.', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS62', qr_code: 'EMS62', item_name: 'สเคาฟ์เวนฟ์ no 21x3/4\"', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS63', qr_code: 'EMS63', item_name: 'สเคาฟ์เวนฟ์ no 25x3/4\"', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 20, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS64', qr_code: 'EMS64', item_name: 'สำลีก้อนปราศจากเชื้อ (1ซอง มี 3 ชิ้น)', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 30, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS65', qr_code: 'EMS65', item_name: 'ไม้พันสำลีปราศจากเชื้อ (1ซอง/5ก้าน) sizeM ประมาณ6นิ้ว', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 30, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS66', qr_code: 'EMS66', item_name: 'ผ้าก๊อซแบบสำเร็จรูป 3x4x8 พับ (5ชิ้น/ห่อ)', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 30, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS67', qr_code: 'EMS67', item_name: 'ผ้าพันแผล ขนาด 4 นิ้ว', category: 'Wound Care', subcategory: 'Dressing', unit: 'ม้วน', current_stock: 30, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS68', qr_code: 'EMS68', item_name: 'พลาสเตอร์ปิดแผลชนิดพลาสติก', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 30, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS69', qr_code: 'EMS69', item_name: 'พลาสเตอร์ใสขนาด 1/2 นิ้ว', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 30, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS70', qr_code: 'EMS70', item_name: 'พลาสเตอร์ใสขนาด 1 นิ้ว', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 30, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS71', qr_code: 'EMS71', item_name: 'ใบมีดผ่าตัด เบอร์ 10', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 30, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS72', qr_code: 'EMS72', item_name: 'ใบมีดผ่าตัด เบอร์ 11', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 30, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS73', qr_code: 'EMS73', item_name: 'เสื้อคลุม non sterrile disposable แบบครึ่งตัว(สีฟ้า)', category: 'PPE', subcategory: 'Protection', unit: 'ชิ้น', current_stock: 100, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS74', qr_code: 'EMS74', item_name: 'เสื้อคลุม non sterile disposable แบบเต็มตัว(สีเหลือง)', category: 'PPE', subcategory: 'Protection', unit: 'ชิ้น', current_stock: 100, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS75', qr_code: 'EMS75', item_name: 'หน้ากากกันสารคัดหลั่งใช้แล้วทิ้ง ลักษณะใส (Face Shield PDG)', category: 'PPE', subcategory: 'Protection', unit: 'ชิ้น', current_stock: 100, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS76', qr_code: 'EMS76', item_name: 'หมวกกระดาษสีเขียว ใช้แล้วทิ้ง', category: 'PPE', subcategory: 'Protection', unit: 'ชิ้น', current_stock: 100, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS77', qr_code: 'EMS77', item_name: 'ผ้าปิดจมูกใช้แล้วทิ้ง ชนิด 3 ชั้น (แบบคล้องหู)', category: 'PPE', subcategory: 'Protection', unit: 'ชิ้น', current_stock: 100, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS78', qr_code: 'EMS78', item_name: 'หน้ากากป้องกันเชื้อโรค N 95 8210', category: 'PPE', subcategory: 'Protection', unit: 'ชิ้น', current_stock: 100, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS79', qr_code: 'EMS79', item_name: 'ถุงมือ Latex ปราศจากเชื้อ ไร้แป้ง เบอร์ 6.5', category: 'PPE', subcategory: 'Protection', unit: 'คู่', current_stock: 100, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS80', qr_code: 'EMS80', item_name: 'ถุงมือ Latex ปราศจากเชื้อ ไร้แป้ง เบอร์ 7', category: 'PPE', subcategory: 'Protection', unit: 'คู่', current_stock: 100, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS81', qr_code: 'EMS81', item_name: 'ถุงมือสำหรับตรวจโรคใช้แล้วทิ้ง เบอร์ เอส', category: 'PPE', subcategory: 'Protection', unit: 'คู่', current_stock: 100, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS82', qr_code: 'EMS82', item_name: 'ถุงมือสำหรับตรวจโรคใช้แล้วทิ้ง เบอร์ เอ็ม', category: 'PPE', subcategory: 'Protection', unit: 'คู่', current_stock: 100, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS83', qr_code: 'EMS83', item_name: 'ถุงมือสำหรับตรวจโรคใช้แล้วทิ้ง เบอร์ แอล', category: 'PPE', subcategory: 'Protection', unit: 'คู่', current_stock: 100, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS84', qr_code: 'EMS84', item_name: 'ถุงมือดีสโพส เบอร ์เอส ชนิดไม่มีแป้ง', category: 'PPE', subcategory: 'Protection', unit: 'คู่', current_stock: 100, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS85', qr_code: 'EMS85', item_name: 'ถุงมือชนิดไม่มีแป้งเบอร์ M (Disposable Glove Powder Free)', category: 'PPE', subcategory: 'Protection', unit: 'คู่', current_stock: 100, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS86', qr_code: 'EMS86', item_name: 'แผ่นผ้าชุบน้ำยาทำลายเชื้อสำเร็จรูปใช้แล้วทิ้ง', category: 'Other', subcategory: 'Disinfection', unit: 'ชิ้น', current_stock: 10, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS87', qr_code: 'EMS87', item_name: 'แอลกอฮอล์ชุปสำเร็จ (Alcohol Pad) (1กล่อง/200ชิ้น)', category: 'Other', subcategory: 'Disinfection', unit: 'ชิ้น', current_stock: 10, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS88', qr_code: 'EMS88', item_name: 'ชุดน้ำยาตรวจ Covid Ag (25 test/kit)', category: 'Other', subcategory: 'Disinfection', unit: 'ชุด', current_stock: 10, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS89', qr_code: 'EMS89', item_name: '52% Chlorhexidine Gluconate in 70%', category: 'Other', subcategory: 'Disinfection', unit: 'ชิ้น', current_stock: 10, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS90', qr_code: 'EMS90', item_name: 'แบตเตอรี่ แอคคิวเซ็ต แอคทีพ (ยี่ห้อแอดแวนเทจ)', category: 'Cardiac Equipment', subcategory: 'Monitoring', unit: 'ชิ้น', current_stock: 15, minimum_stock: 5, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS91', qr_code: 'EMS91', item_name: 'กระดาษ อีเคจี ขนาด 50 x 30 มม.', category: 'Cardiac Equipment', subcategory: 'Monitoring', unit: 'ชิ้น', current_stock: 15, minimum_stock: 5, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS92', qr_code: 'EMS92', item_name: 'แผ่นอิเลคโทรด', category: 'Cardiac Equipment', subcategory: 'Monitoring', unit: 'ชิ้น', current_stock: 15, minimum_stock: 5, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS93', qr_code: 'EMS93', item_name: 'ครีมอีเคจี จุไม่ต่ำกว่า 50 กรัม', category: 'Cardiac Equipment', subcategory: 'Monitoring', unit: 'ชิ้น', current_stock: 15, minimum_stock: 5, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS94', qr_code: 'EMS94', item_name: 'แถบหาน้ำตาลในเลือด', category: 'Cardiac Equipment', subcategory: 'Monitoring', unit: 'ชิ้น', current_stock: 15, minimum_stock: 5, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS95', qr_code: 'EMS95', item_name: 'เจลหล่อลื่นอุปกรณ์ทางการแพทย์ที่จะสอดใส่เข้าในร่างกาย', category: 'Other', subcategory: 'General', unit: 'ชิ้น', current_stock: 10, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS96', qr_code: 'EMS96', item_name: 'ถังทิ้งเข็ม ขนาด 6.2 ลิตร', category: 'Other', subcategory: 'General', unit: 'ชิ้น', current_stock: 10, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS97', qr_code: 'EMS97', item_name: 'Thoracic catheter No.28', category: 'Other', subcategory: 'General', unit: 'ชิ้น', current_stock: 10, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS98', qr_code: 'EMS98', item_name: 'Thoracic catheter No.32', category: 'Other', subcategory: 'General', unit: 'ชิ้น', current_stock: 10, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS99', qr_code: 'EMS99', item_name: 'Thoracic catheter No.36', category: 'Other', subcategory: 'General', unit: 'ชิ้น', current_stock: 10, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS100', qr_code: 'EMS100', item_name: 'เครื่องช่วยฟัง', category: 'Other', subcategory: 'General', unit: 'ชิ้น', current_stock: 10, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS101', qr_code: 'EMS101', item_name: 'กรรไกรตัดพลาสเตอร์ 22 cm.', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 30, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now }
  ];
  for (const item of items) await dbAdd('items', item);

  // Seed recent transactions
  const txData = [
    { datetime: new Date(Date.now() - 86400000 * 0).toISOString(), item_id: 1, barcode: 'EMS01', transaction_type: 'Receive', quantity: 3, balance_after_transaction: 5, remarks: 'รับเติมจากคลัง', user_name: 'Admin EMS' },
    { datetime: new Date(Date.now() - 86400000 * 0).toISOString(), item_id: 29, barcode: 'EMS29', transaction_type: 'Issue', quantity: 2, balance_after_transaction: 3, remarks: 'ส่งออกรถ Ambulance 1', user_name: 'Staff Nurse' },
    { datetime: new Date(Date.now() - 86400000 * 1).toISOString(), item_id: 37, barcode: 'EMS37', transaction_type: 'Issue', quantity: 5, balance_after_transaction: 15, remarks: 'ใช้งานฉุกเฉิน', user_name: 'Staff Nurse' },
    { datetime: new Date(Date.now() - 86400000 * 1).toISOString(), item_id: 58, barcode: 'EMS58', transaction_type: 'Receive', quantity: 10, balance_after_transaction: 20, remarks: 'รับ IV set ใหม่', user_name: 'Admin EMS' },
    { datetime: new Date(Date.now() - 86400000 * 2).toISOString(), item_id: 14, barcode: 'EMS14', transaction_type: 'Issue', quantity: 1, balance_after_transaction: 4, remarks: 'ใช้ผู้ป่วย', user_name: 'Staff Nurse' },
    { datetime: new Date(Date.now() - 86400000 * 2).toISOString(), item_id: 66, barcode: 'EMS66', transaction_type: 'Adjust', quantity: -2, balance_after_transaction: 28, remarks: 'ปรับยอดหลังตรวจนับ', user_name: 'Admin EMS' },
    { datetime: new Date(Date.now() - 86400000 * 3).toISOString(), item_id: 79, barcode: 'EMS79', transaction_type: 'Receive', quantity: 50, balance_after_transaction: 100, remarks: 'รับถุงมือ', user_name: 'Admin EMS' },
    { datetime: new Date(Date.now() - 86400000 * 3).toISOString(), item_id: 81, barcode: 'EMS81', transaction_type: 'Issue', quantity: 20, balance_after_transaction: 80, remarks: 'ส่งออกทีม EMS', user_name: 'Staff Nurse' },
  ];
  for (const t of txData) await dbAdd('transactions', t);

  // Seed notifications for low-stock items
  const lowItems = items.filter(i => i.current_stock <= i.minimum_stock);
  for (const item of lowItems) {
    await dbAdd('notifications', {
      item_id: null,
      notification_type: 'low_stock',
      message: `${item.item_name} มีสต๊อกต่ำ (${item.current_stock} ${item.unit})`,
      datetime: now,
      status: 'unread',
    });
  }

  // Mark v2 migration as complete
  await setSetting('seeded_v2', true);

  console.log('✅ Database seeded with EMS inventory data (v2 — 100 items)');
}

/* ── Item Helpers ── */
export async function getAllItems() {
  return dbGetAll('items');
}
export async function getItemById(id) {
  return dbGet('items', id);
}
export async function getItemByBarcode(barcode) {
  const all = await getAllItems();
  return all.find(i => i.barcode === barcode || i.qr_code === barcode) || null;
}
export async function saveItem(item) {
  item.updated_date = new Date().toISOString();
  if (!item.created_date) item.created_date = item.updated_date;
  return dbPut('items', item);
}
export async function deleteItem(id) {
  return dbDelete('items', id);
}
export async function getLowStockItems() {
  const all = await getAllItems();
  return all.filter(i => i.current_stock <= i.minimum_stock);
}

/* ── Transaction Helpers ── */
export async function addTransaction(txObj) {
  txObj.datetime = new Date().toISOString();
  const id = await dbAdd('transactions', txObj);

  // Update item stock
  const item = await getItemById(txObj.item_id);
  if (item) {
    if (txObj.transaction_type === 'Receive') {
      item.current_stock += txObj.quantity;
    } else if (txObj.transaction_type === 'Issue') {
      item.current_stock -= txObj.quantity;
      if (item.current_stock < 0) item.current_stock = 0;
    } else if (txObj.transaction_type === 'Adjust') {
      item.current_stock += txObj.quantity;
      if (item.current_stock < 0) item.current_stock = 0;
    }
    txObj.balance_after_transaction = item.current_stock;
    item.updated_date = txObj.datetime;
    await saveItem(item);

    // Check low stock
    if (item.current_stock <= item.minimum_stock) {
      await dbAdd('notifications', {
        item_id: item.item_id,
        notification_type: 'low_stock',
        message: `${item.item_name} มีสต๊อกต่ำ: ${item.current_stock} ${item.unit} (ขั้นต่ำ: ${item.minimum_stock})`,
        datetime: txObj.datetime,
        status: 'unread',
      });
    }
  }

  // Queue for Google Sheets sync
  await dbAdd('sync_queue', {
    type: 'transaction',
    data: { ...txObj, id },
    timestamp: txObj.datetime,
    status: 'pending',
  });

  return id;
}

export async function getAllTransactions() {
  const all = await dbGetAll('transactions');
  return all.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
}

/* ── User Helpers ── */
export async function getAllUsers() {
  return dbGetAll('users');
}
export async function getUserByEmail(email) {
  const all = await getAllUsers();
  return all.find(u => u.email === email) || null;
}
export async function saveUser(user) {
  return dbPut('users', user);
}
export async function deleteUser(id) {
  return dbDelete('users', id);
}

/* ── Notification Helpers ── */
export async function getUnreadNotifications() {
  const all = await dbGetAll('notifications');
  return all.filter(n => n.status === 'unread').reverse();
}
export async function markAllNotificationsRead() {
  const all = await dbGetAll('notifications');
  for (const n of all) {
    if (n.status === 'unread') {
      n.status = 'read';
      await dbPut('notifications', n);
    }
  }
}

/* ── Checklist Helpers ── */
export async function saveChecklist(data) {
  return dbPut('checklists', data);
}
export async function getChecklistByDate(date, location) {
  const all = await dbGetAll('checklists');
  return all.find(c => c.date === date && c.location === location) || null;
}
export async function getAllChecklists() {
  const all = await dbGetAll('checklists');
  return all.sort((a, b) => new Date(b.date) - new Date(a.date));
}
