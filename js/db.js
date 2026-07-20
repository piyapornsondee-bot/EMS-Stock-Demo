/* =========================================================
   EMS Stock Manager — db.js (Firebase Version)
   ========================================================= */

import { db } from './firebase-config.js';
import { 
  collection, doc, getDocs, getDoc, setDoc, addDoc, deleteDoc, 
  query, where, orderBy, getCountFromServer, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/* ── Generic helpers ── */

export function isDemoMode() {
  return sessionStorage.getItem('ems_demo_mode') === 'true' || localStorage.getItem('ems_demo_mode') === 'true';
}

function getLocalDemoData(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) {
    return [];
  }
}

function setLocalDemoData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function initDemoData() {
  if (localStorage.getItem('ems_demo_initialized') === 'true') {
    return;
  }
  
  const now = new Date();
  const formatISO = d => d.toISOString();
  
  const baseItems = [
    { barcode: 'EMS01', qr_code: 'EMS01', item_name: 'Endotracheal tube No.2.5', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 5, minimum_stock: 2, location: 'EMS' },
    { barcode: 'EMS02', qr_code: 'EMS02', item_name: 'Endotracheal tube No.3', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 1, minimum_stock: 2, location: 'EMS' },
    { barcode: 'EMS03', qr_code: 'EMS03', item_name: 'Endotracheal tube No.3.5', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS' },
    { barcode: 'EMS04', qr_code: 'EMS04', item_name: 'Endotracheal tube No.4', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 8, minimum_stock: 2, location: 'EMS' },
    { barcode: 'EMS28', qr_code: 'EMS28', item_name: 'อ๊อกซิเยนแคนนูล่า', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 15, minimum_stock: 5, location: 'EMS' },
    { barcode: 'EMS31', qr_code: 'EMS31', item_name: 'สายซักชั่น เบอร์ 6', category: 'Suction Equipment', subcategory: 'Suction', unit: 'ชิ้น', current_stock: 3, minimum_stock: 4, location: 'EMS' },
    { barcode: 'EMS37', qr_code: 'EMS37', item_name: 'กระบอกฉีดยา 3 ซีซี', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 25, minimum_stock: 8, location: 'EMS' },
    { barcode: 'EMS53', qr_code: 'EMS53', item_name: 'ไอ.วี แคทดิเตอร์ เบอร์ 20', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 12, minimum_stock: 8, location: 'EMS' },
    { barcode: 'EMS64', qr_code: 'EMS64', item_name: 'สำลีก้อนปราศจากเชื้อ (3 ชิ้น)', category: 'Wound Care', subcategory: 'Dressing', unit: 'ซอง', current_stock: 40, minimum_stock: 10, location: 'EMS' },
    { barcode: 'EMS67', qr_code: 'EMS67', item_name: 'ผ้าพันแผล ขนาด 4 นิ้ว', category: 'Wound Care', subcategory: 'Dressing', unit: 'ม้วน', current_stock: 6, minimum_stock: 10, location: 'EMS' },
    { barcode: 'EMS77', qr_code: 'EMS77', item_name: 'หน้ากากอนามัย 3 ชั้น', category: 'PPE', subcategory: 'Protection', unit: 'กล่อง', current_stock: 18, minimum_stock: 5, location: 'EMS' },
    { barcode: 'EMS87', qr_code: 'EMS87', item_name: 'แอลกอฮอล์แผ่น (Alcohol Pad)', category: 'Other', subcategory: 'Disinfection', unit: 'กล่อง', current_stock: 2, minimum_stock: 3, location: 'EMS' },
    { barcode: 'EMS94', qr_code: 'EMS94', item_name: 'แถบตรวจน้ำตาลในเลือด', category: 'Cardiac Equipment', subcategory: 'Monitoring', unit: 'กล่อง', current_stock: 10, minimum_stock: 5, location: 'EMS' }
  ];

  const items = baseItems.map((item, idx) => ({
    ...item,
    item_id: 'demo_item_' + (idx + 1),
    created_date: formatISO(now),
    updated_date: formatISO(now),
    item_image: ''
  }));

  const txs = [];
  const txTypes = ['Receive', 'Issue'];
  for (let i = 6; i >= 0; i--) {
    const txDate = new Date();
    txDate.setDate(now.getDate() - i);
    
    const count = 2 + Math.floor(Math.random() * 3);
    for (let j = 0; j < count; j++) {
      const item = items[Math.floor(Math.random() * items.length)];
      const type = txTypes[Math.floor(Math.random() * txTypes.length)];
      const qty = 1 + Math.floor(Math.random() * 5);
      
      txDate.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);
      
      txs.push({
        transaction_id: 'demo_tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        datetime: formatISO(txDate),
        item_id: item.item_id,
        barcode: item.barcode,
        item_name: item.item_name,
        transaction_type: type,
        quantity: qty,
        location: 'EMS',
        balance_after_transaction: type === 'Receive' ? item.current_stock + qty : Math.max(0, item.current_stock - qty),
        user_name: 'ผู้ทดลองใช้งาน (Demo User)',
        remarks: type === 'Receive' ? 'รับเข้าเพื่อจัดเตรียมสำรองคลัง' : 'จ่ายออกเพื่อใช้งานในรถฉุกเฉิน'
      });
    }
  }

  txs.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

  const lowStockItems = items.filter(i => i.current_stock <= i.minimum_stock);
  const notifications = lowStockItems.map((item, idx) => ({
    notification_id: 'demo_notif_' + (idx + 1),
    item_id: item.item_id,
    notification_type: 'low_stock',
    message: `${item.item_name} (${item.location}) มีสต๊อกต่ำ: ${item.current_stock} ${item.unit} (ขั้นต่ำ: ${item.minimum_stock})`,
    datetime: formatISO(now),
    status: 'unread'
  }));

  localStorage.setItem('ems_demo_items', JSON.stringify(items));
  localStorage.setItem('ems_demo_transactions', JSON.stringify(txs));
  localStorage.setItem('ems_demo_notifications', JSON.stringify(notifications));
  localStorage.setItem('ems_demo_checklists', JSON.stringify([]));
  localStorage.setItem('ems_demo_settings', JSON.stringify({}));
  localStorage.setItem('ems_demo_users', JSON.stringify([
    { user_id: 'demo_user', full_name: 'ผู้ทดลองใช้งาน (Demo User)', email: 'demo@ems.local', role: 'Administrator', active: true }
  ]));
  localStorage.setItem('ems_demo_initialized', 'true');
}

// Helper to convert snapshot to array and inject document ID
function snapshotToArray(snapshot, idField) {
  const arr = [];
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    data[idField] = docSnap.id;
    arr.push(data);
  });
  return arr;
}

export async function getSetting(key) {
  if (isDemoMode()) {
    initDemoData();
    const settings = getLocalDemoData('ems_demo_settings');
    return settings[key] !== undefined ? settings[key] : null;
  }
  const docSnap = await getDoc(doc(db, 'settings', key));
  return docSnap.exists() ? docSnap.data().value : null;
}
export async function setSetting(key, value) {
  if (isDemoMode()) {
    initDemoData();
    const settings = getLocalDemoData('ems_demo_settings');
    settings[key] = value;
    localStorage.setItem('ems_demo_settings', JSON.stringify(settings));
    return;
  }
  await setDoc(doc(db, 'settings', key), { value });
}

/* ── Seed Data ── */
const OFFICE_SEED_ITEMS = [
  { barcode: 'EMS142', qr_code: 'EMS142', item_name: 'กรรไกรตัดกระดาษความยาว 8.5 นิ้ว', category: 'Office', subcategory: 'Office Supplies', unit: 'อัน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS143', qr_code: 'EMS143', item_name: 'กระดาษก๊อปปี้ สีน้ำเงิน สำหรับเขียน', category: 'Office', subcategory: 'Office Supplies', unit: 'กล่อง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS144', qr_code: 'EMS144', item_name: 'กระดาษถ่ายเอกสาร 80 แกรม ขนาดเอฟ14', category: 'Office', subcategory: 'Office Supplies', unit: 'รีม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS145', qr_code: 'EMS145', item_name: 'กระดาษถ่ายเอกสาร 80 แกรม ขนาดเอ4', category: 'Office', subcategory: 'Office Supplies', unit: 'รีม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS146', qr_code: 'EMS146', item_name: 'กาวหลอดชนิดหมุน 22 กรัม', category: 'Office', subcategory: 'Office Supplies', unit: 'หลอด', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS147', qr_code: 'EMS147', item_name: 'ซองจดหมายตราคณะฯ 4.25"x9.25" สีขาว', category: 'Office', subcategory: 'Office Supplies', unit: 'ซอง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS148', qr_code: 'EMS148', item_name: 'ซองสีน้ำตาล 8*10', category: 'Office', subcategory: 'Office Supplies', unit: 'ซอง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS149', qr_code: 'EMS149', item_name: 'ซองตราครุฑ สีน้ำตาล 10"x14"', category: 'Office', subcategory: 'Office Supplies', unit: 'ซอง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS150', qr_code: 'EMS150', item_name: 'ดินสอดำ', category: 'Office', subcategory: 'Office Supplies', unit: 'แท่ง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS151', qr_code: 'EMS151', item_name: 'ที่ถอนลวดเย็บกระดาษชนิดแซะ', category: 'Office', subcategory: 'Office Supplies', unit: 'อัน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS152', qr_code: 'EMS152', item_name: 'น้ำยาลบคำผิดชนิดแท่ง ขนาด 7 ml.', category: 'Office', subcategory: 'Office Supplies', unit: 'ด้าม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS153', qr_code: 'EMS153', item_name: 'ปากกาเคมี ชนิด 2 หัว สีน้ำเงิน', category: 'Office', subcategory: 'Office Supplies', unit: 'ด้าม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS154', qr_code: 'EMS154', item_name: 'ปากกาเคมี ชนิด 2 หัว สีแดง', category: 'Office', subcategory: 'Office Supplies', unit: 'ด้าม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS155', qr_code: 'EMS155', item_name: 'ปากกาเคมี 2 หัวสีดำ', category: 'Office', subcategory: 'Office Supplies', unit: 'ด้าม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS156', qr_code: 'EMS156', item_name: 'ปากกาเคมีแท่งเล็กเส้นเล็กสีน้ำเงิน', category: 'Office', subcategory: 'Office Supplies', unit: 'ด้าม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS157', qr_code: 'EMS157', item_name: 'ปากกาเคมีแท่งเล็กเส้นเล็กสีดำ', category: 'Office', subcategory: 'Office Supplies', unit: 'ด้าม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS158', qr_code: 'EMS158', item_name: 'ปากกาเคมีแท่งเล็กเส้นเล็กสีแดง', category: 'Office', subcategory: 'Office Supplies', unit: 'ด้าม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS159', qr_code: 'EMS159', item_name: 'เครื่องเย็บกระดาษขนาดกลาง No.M8-1M', category: 'Office', subcategory: 'Office Supplies', unit: 'เครื่อง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS160', qr_code: 'EMS160', item_name: 'ลวดเย็บกระดาษ ขนาด M8-1M (1000 ตัว/กล่อง)', category: 'Office', subcategory: 'Office Supplies', unit: 'กล่อง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS161', qr_code: 'EMS161', item_name: 'ลวดเสียบกระดาษสามเหลี่ยม (50 ตัว/กล่อง)', category: 'Office', subcategory: 'Office Supplies', unit: 'กล่อง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS162', qr_code: 'EMS162', item_name: 'สมุดปกอ่อนทำด้วยกระดาษอย่างดี ไม่น้อยกว่า 30 แผ่น', category: 'Office', subcategory: 'Office Supplies', unit: 'เล่ม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS163', qr_code: 'EMS163', item_name: 'สมุดปกแข็งสีน้ำเงิน 4/80 แผ่น ขนาด265x385 มม. 60แกรม ไม่น้อยกว่า 150 หน้า', category: 'Office', subcategory: 'Office Supplies', unit: 'เล่ม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS164', qr_code: 'EMS164', item_name: 'สมุดปกแข็งมุมมัน 4/100 แผ่น ขนาด 250x370 มม. 80 แกรม ไม่น้อยกว่า 200 หน้า', category: 'Office', subcategory: 'Office Supplies', unit: 'เล่ม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS165', qr_code: 'EMS165', item_name: 'สมุดปกแข็งสีน้ำเงิน2/80 แผ่น ขนาด19x31 ซม. 60แกรม ไม่น้อยกว่า 150 หน้า', category: 'Office', subcategory: 'Office Supplies', unit: 'เล่ม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS166', qr_code: 'EMS166', item_name: 'หมึกเติมแท่นประทับตรา สีน้ำเงิน28ซีซี', category: 'Office', subcategory: 'Office Supplies', unit: 'ขวด', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS167', qr_code: 'EMS167', item_name: 'หมึกเติมแท่นประทับตรา สีแดง 28 ซีซี', category: 'Office', subcategory: 'Office Supplies', unit: 'ขวด', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS168', qr_code: 'EMS168', item_name: 'เครื่องเหลาดินสอ ชนิดใช้มือหมุน', category: 'Office', subcategory: 'Office Supplies', unit: 'เครื่อง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS169', qr_code: 'EMS169', item_name: 'เชือกผูกของ ขาว-แดง ความยาวไม่น้อยกว่า 200 เมตร', category: 'Office', subcategory: 'Office Supplies', unit: 'ม้วน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS170', qr_code: 'EMS170', item_name: 'เทปโฟม 2 หน้า 24 mm.x5 m. ชนิดหนา.', category: 'Office', subcategory: 'Office Supplies', unit: 'ม้วน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS171', qr_code: 'EMS171', item_name: 'เหล็กหนีบหูเป็นโลหะ ขนาด 3/4 นิ้ว.#112(จิ๋ว)', category: 'Office', subcategory: 'Office Supplies', unit: 'กล่อง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS172', qr_code: 'EMS172', item_name: 'เหล็กหนีบหูเป็นโลหะ สีดำ ขนาด 1 1/4 นิ้ว #110(เล็ก)', category: 'Office', subcategory: 'Office Supplies', unit: 'กล่อง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS173', qr_code: 'EMS173', item_name: 'เหล็กหนีบหูเป็นโลหะ สีดำ ขนาด 1 5/8 นิ้ว .#109(กลาง)', category: 'Office', subcategory: 'Office Supplies', unit: 'กล่อง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS174', qr_code: 'EMS174', item_name: 'เหล็กหนีบหูเป็นโลหะ สีดำ ขนาด 2 นิ้ว .#108(ใหญ่)', category: 'Office', subcategory: 'Office Supplies', unit: 'กล่อง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS175', qr_code: 'EMS175', item_name: 'แถบกาวย่น 1" ความยาวไม่น้อยกว่า 25 หลา', category: 'Office', subcategory: 'Office Supplies', unit: 'ม้วน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS176', qr_code: 'EMS176', item_name: 'แถบกาวย่น 2" ความยาวไม่น้อยกว่า 25 หลา', category: 'Office', subcategory: 'Office Supplies', unit: 'ม้วน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS177', qr_code: 'EMS177', item_name: 'แถบกาวใส 1"x 72 หลา', category: 'Office', subcategory: 'Office Supplies', unit: 'ม้วน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS178', qr_code: 'EMS178', item_name: 'แท่นประทับตรา เบอร์2 สีน้ำเงิน', category: 'Office', subcategory: 'Office Supplies', unit: 'อัน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS179', qr_code: 'EMS179', item_name: 'แท่นประทับตรา เบอร์ 2 สีแดง', category: 'Office', subcategory: 'Office Supplies', unit: 'อัน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS180', qr_code: 'EMS180', item_name: 'แฟ้มห่วงสีดำ', category: 'Office', subcategory: 'Office Supplies', unit: 'เล่ม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS181', qr_code: 'EMS181', item_name: 'แฟ้มสปริงหนีบสีดำ', category: 'Office', subcategory: 'Office Supplies', unit: 'เล่ม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS182', qr_code: 'EMS182', item_name: 'ปากกาไวท์บอร์ด สีดำ', category: 'Office', subcategory: 'Office Supplies', unit: 'ด้าม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS183', qr_code: 'EMS183', item_name: 'ปากกาเคมีใช้เขียนกระดานขาวสีน้ำเงิน', category: 'Office', subcategory: 'Office Supplies', unit: 'ด้าม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS184', qr_code: 'EMS184', item_name: 'ปากกาเคมีใช้เขียนกระดานขาวสีแดง', category: 'Office', subcategory: 'Office Supplies', unit: 'ด้าม', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS185', qr_code: 'EMS185', item_name: 'แท่นสำหรับใส่แถบกาวใส', category: 'Office', subcategory: 'Office Supplies', unit: 'อัน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS186', qr_code: 'EMS186', item_name: 'ยางลบดินสอ', category: 'Office', subcategory: 'Office Supplies', unit: 'ก้อน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS187', qr_code: 'EMS187', item_name: 'ไม้บรรทัดพลาสติก 12 นิ้ว', category: 'Office', subcategory: 'Office Supplies', unit: 'อัน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS188', qr_code: 'EMS188', item_name: 'ไม้บรรทัดพลาสติก 18 นิ้ว', category: 'Office', subcategory: 'Office Supplies', unit: 'อัน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS189', qr_code: 'EMS189', item_name: 'Ribbon RB-WAX Size 75 m.m x 74 m.', category: 'Office', subcategory: 'Office Supplies', unit: 'ม้วน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS190', qr_code: 'EMS190', item_name: 'สติ๊กเกอร์บาร์โค้ต 5.5x3 ซม. (1 ม้วน/2,000 ดวง)', category: 'Office', subcategory: 'Office Supplies', unit: 'ม้วน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS191', qr_code: 'EMS191', item_name: 'ที่เจาะกระดาษ 2 รู ขนาดเล็ก', category: 'Office', subcategory: 'Office Supplies', unit: 'เครื่อง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' }
];

const HOUSEKEEPING_SEED_ITEMS = [
  { barcode: 'EMS192', qr_code: 'EMS192', item_name: 'กระดาษชำระ ม้วนเล็ก', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'ม้วน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS193', qr_code: 'EMS193', item_name: 'กระดาษชำระม้วนใหญ่ (12 ม้วน/หีบ)', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'หีบ', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS194', qr_code: 'EMS194', item_name: 'กระดาษสาสีขาว ขนาดกว้าง 19x22 นิ้ว', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'แผ่น', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS195', qr_code: 'EMS195', item_name: 'กระดาษเช็ดมือแบบแผ่น 250 แผ่น/ห่อ', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'ห่อ', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS196', qr_code: 'EMS196', item_name: 'ถุงพลาสติกมีหูหิ้ว 9x18 นิ้ว (1 ห่อ/100 ใบ)', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'ห่อ', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS197', qr_code: 'EMS197', item_name: 'ถุงพลาสติกมีหูหิ้ว 12x20 นิ้ว (1 ห่อ/100 ใบ)', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'ห่อ', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS198', qr_code: 'EMS198', item_name: 'แบตเตอรี่แห้ง ขนาดกลาง (C)', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'ก้อน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS199', qr_code: 'EMS199', item_name: 'แบตเตอรี่แห้ง ขนาดใหญ่ (D)', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'ก้อน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS200', qr_code: 'EMS200', item_name: 'แบตเตอรี่ 9 โวลท์', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'ก้อน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS201', qr_code: 'EMS201', item_name: 'Battery Alkaline AA', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'ก้อน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS202', qr_code: 'EMS202', item_name: 'Battery Alkaline AAA', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'ก้อน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS203', qr_code: 'EMS203', item_name: 'กรวยน้ำกระดาษ 4,500 ใบ/หีบ', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'หีบ', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS204', qr_code: 'EMS204', item_name: 'แผ่นขัดภาชนะใยสังเคราะห์ ขนาดไม่ต่ำกว่า 10x15 ซม', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'แผ่น', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS205', qr_code: 'EMS205', item_name: 'สบู่เหลว ขนาดไม่ต่ำกว่า 200 ซีซี', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'ขวด', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS206', qr_code: 'EMS206', item_name: 'ผงซักฟอก ขนาดไม่ต่ำกว่า 430 กรัม', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'ถุง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS207', qr_code: 'EMS207', item_name: 'น้ำยาล้างจาน ความจุไม่ต่ำกว่า 800 ซีซี.', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'ขวด', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS208', qr_code: 'EMS208', item_name: 'น้ำยาดับกลิ่นชนิดสเปรย์', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'กระป๋อง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS209', qr_code: 'EMS209', item_name: 'กระบอกฉีดที่พ่นน้ำรีดผ้า', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'อัน', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS210', qr_code: 'EMS210', item_name: 'ยางรัดของวงเล็ก 1 ถุง/1/2 กก.', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'ถุง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' },
  { barcode: 'EMS211', qr_code: 'EMS211', item_name: 'ยางรัดของวงใหญ่ 1 ถุง/ 1/2 กก.', category: 'Housekeeping', subcategory: 'Housekeeping Supplies', unit: 'ถุง', current_stock: 0, minimum_stock: 2, location: 'ห้องเก็บของ EMS', item_image: '' }
];

/* ── Seed Data ── */
export async function seedDatabase() {
  if (isDemoMode()) {
    initDemoData();
    return;
  }
  const coll = collection(db, 'users');
  const snapshot = await getCountFromServer(coll);
  const count = snapshot.data().count;

  if (count === 0) {
    const users = [
      { full_name: 'Admin EMS', role: 'Administrator', email: 'admin@ems.local', password: 'admin1234', active: true },
      { full_name: 'Staff Nurse', role: 'Staff', email: 'staff@ems.local', password: 'staff1234', active: true },
    ];
    for (const u of users) {
      await addDoc(collection(db, 'users'), u);
    }
  }

  const officeFlag = await getSetting('seeded_office_items_v1');
  const officeFlagV2 = await getSetting('seeded_office_items_v2');
  const v3Flag = await getSetting('seeded_v3_firebase');

  if (!officeFlagV2 && v3Flag) {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    
    // 1. If v1 was seeded (location 'EMS'), update their location to 'ห้องเก็บของ EMS'
    if (officeFlag) {
      const q = query(collection(db, 'items'), where('category', '==', 'Office'), where('location', '==', 'EMS'));
      const snap = await getDocs(q);
      snap.forEach(docSnap => {
        batch.update(docSnap.ref, { location: 'ห้องเก็บของ EMS' });
      });
    } else {
      // 2. If v1 was never seeded, seed them now with location 'ห้องเก็บของ EMS'
      const officeItems = OFFICE_SEED_ITEMS.map(i => ({
        ...i,
        created_date: now,
        updated_date: now
      }));
      for (const item of officeItems) {
        const docRef = doc(collection(db, 'items'));
        batch.set(docRef, item);
      }
      await setSetting('seeded_office_items_v1', true);
    }
    
    await batch.commit();
    await setSetting('seeded_office_items_v2', true);
    console.log('✅ Database migrated: Office items location updated to "ห้องเก็บของ EMS"');
  }

  const hkFlag = await getSetting('seeded_housekeeping_items_v1');
  if (!hkFlag && v3Flag) {
    const now = new Date().toISOString();
    const hkItems = HOUSEKEEPING_SEED_ITEMS.map(i => ({
      ...i,
      created_date: now,
      updated_date: now
    }));
    const batch = writeBatch(db);
    for (const item of hkItems) {
      const docRef = doc(collection(db, 'items'));
      batch.set(docRef, item);
    }
    await batch.commit();
    await setSetting('seeded_housekeeping_items_v1', true);
    console.log('✅ Database migrated: Seeded Housekeeping items');
  }

  if (v3Flag) return;

  const now = new Date().toISOString();
  const items = [
    { barcode: 'EMS01', qr_code: 'EMS01', item_name: 'Endotracheal tube No.2.5', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS02', qr_code: 'EMS02', item_name: 'Endotracheal tube No.3', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS03', qr_code: 'EMS03', item_name: 'Endotracheal tube No.3.5', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS04', qr_code: 'EMS04', item_name: 'Endotracheal tube No.4', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS05', qr_code: 'EMS05', item_name: 'Endotracheal tube No.4.5', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS06', qr_code: 'EMS06', item_name: 'Endotracheal tube 5.0 มีcuff', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS07', qr_code: 'EMS07', item_name: 'Endotracheal tube No.5.5 มี Cuff', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS08', qr_code: 'EMS08', item_name: 'Endotracheal tube No.6 มี Cuff', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS09', qr_code: 'EMS09', item_name: 'Endotracheal tube No.6.5 มี CuffชนิดHighVolumeLow', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS10', qr_code: 'EMS10', item_name: 'Endotracheal tube No.7 มี CuffชนิดHighVolumeLow', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS11', qr_code: 'EMS11', item_name: 'Endotracheal tube No.7.5 มีCuffชนิดHighVolumeLow', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS12', qr_code: 'EMS12', item_name: 'Endotracheal tube No.8 มีCuff ชนิด High Volume Low', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS13', qr_code: 'EMS13', item_name: 'Endotracheal tube No.8.5 มีCuff', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS14', qr_code: 'EMS14', item_name: 'ท่อเปิดทางเดินหายใจทางจมูก (Nasalphalyngeal airway) ขนาด 7.0 mm', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS15', qr_code: 'EMS15', item_name: 'ท่อเปิดทางเดินหายใจทางจมูก (Nasalphalyngeal airway) ขนาด 7.5 mm', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS16', qr_code: 'EMS16', item_name: 'Stylet Endotracheal Tube Guide ขนาด 14 FR. (ผู้ใหญ่)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS17', qr_code: 'EMS17', item_name: 'Stylet Endotracheal Tube Guide ขนาด 10 FR. (เด็กโต)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS18', qr_code: 'EMS18', item_name: 'Stylet Endotracheal tube Guide No.8 (เด็กกลาง)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS19', qr_code: 'EMS19', item_name: 'Stylet Endotracheal Tube Guide No.6 (เด็กเล็ก)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS20', qr_code: 'EMS20', item_name: 'Oropharyngeal airway ขนาด 100 มม. (สีแดง)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS21', qr_code: 'EMS21', item_name: 'Oropharyngeal Air way ขนาด 90 มม. (สีเหลือง)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS22', qr_code: 'EMS22', item_name: 'Oropharyngeal airway ขนาด 80 มม. (สีเขียว)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS23', qr_code: 'EMS23', item_name: 'Oropharyngeal airway ขนาด 70 มม. (สีขาว)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS24', qr_code: 'EMS24', item_name: 'Oropharygeal Air Way 60 mm (สีดำ)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS25', qr_code: 'EMS25', item_name: 'Oropharyngeal airway ขนาด 50 มม (สีน้ำเงิน)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS26', qr_code: 'EMS26', item_name: 'Oro pharyngeal airway 40 mm (สีชมพู)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS28', qr_code: 'EMS28', item_name: 'อ๊อกซิเยนแคนนูล่า', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS29', qr_code: 'EMS29', item_name: 'Oxygen Mask ผู้ใหญ่ (adult)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS30', qr_code: 'EMS30', item_name: 'Oxygen Mask เด็ก(ped)', category: 'Oxygen & Airway', subcategory: 'Airway', unit: 'ชิ้น', current_stock: 0, minimum_stock: 2, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS31', qr_code: 'EMS31', item_name: 'สายซักชั่น เบอร์ 6', category: 'Suction Equipment', subcategory: 'Suction', unit: 'ชิ้น', current_stock: 0, minimum_stock: 4, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS32', qr_code: 'EMS32', item_name: 'สายซักชั่น เบอร์ 8', category: 'Suction Equipment', subcategory: 'Suction', unit: 'ชิ้น', current_stock: 0, minimum_stock: 4, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS33', qr_code: 'EMS33', item_name: 'สายซักชั่น เบอร์ 10', category: 'Suction Equipment', subcategory: 'Suction', unit: 'ชิ้น', current_stock: 0, minimum_stock: 4, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS34', qr_code: 'EMS34', item_name: 'สายซักชั่น เบอร์ 12', category: 'Suction Equipment', subcategory: 'Suction', unit: 'ชิ้น', current_stock: 0, minimum_stock: 4, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS35', qr_code: 'EMS35', item_name: 'สายซักชั่น เบอร์ 14', category: 'Suction Equipment', subcategory: 'Suction', unit: 'ชิ้น', current_stock: 0, minimum_stock: 4, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS36', qr_code: 'EMS36', item_name: 'สายซักชั่น เบอร์ 16', category: 'Suction Equipment', subcategory: 'Suction', unit: 'ชิ้น', current_stock: 0, minimum_stock: 4, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS37', qr_code: 'EMS37', item_name: '*กระบอกฉีดยาชนิดใช้แล้วทิ้ง 3 ซีซี.', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS38', qr_code: 'EMS38', item_name: '*กระบอกฉีดยาชนิดใช้แล้วทิ้ง 5 ซีซี.', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS39', qr_code: 'EMS39', item_name: '*กระบอกฉีดยาชนิดใช้แล้วทิ้ง 10 ซีซี', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS40', qr_code: 'EMS40', item_name: 'กระบอกฉีดยาดีสโพสเซเบิ้ล 20 ซีซี.', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS41', qr_code: 'EMS41', item_name: 'กระบอกฉีดยาชนิดใช้แล้วทิ้ง 50 ซีซี.', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS42', qr_code: 'EMS42', item_name: '*กระบอกฉีดยาชนิดใช้แล้วทิ้ง 1 ซีซี.อินซูลิน100ยูนิตเข็มเบอร์30', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS43', qr_code: 'EMS43', item_name: '*เข็มฉีดยาดีสโพสเซเบิ้ลเบอร์ 18x1 1/2 นิ้ว', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS44', qr_code: 'EMS44', item_name: '*เข็มฉีดยาดีสโพสเซเบิ้ลเบอร์ 20x1 1/2 นิ้ว', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS45', qr_code: 'EMS45', item_name: 'เข็มฉีดยาดีสโพสฯเบอร์ 21x1.1/2', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS46', qr_code: 'EMS46', item_name: 'เข็มฉีดยาดีสโพสเซเบิ้ล NO.22x1.5"', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS47', qr_code: 'EMS47', item_name: '*เข็มฉีดยาดีสโพสเซเบิ้ล เบอร์ 23x1.5 นิ้ว', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS48', qr_code: 'EMS48', item_name: '*เข็มฉีดยาดีสโพสเซเบิ้ล เบอร์ 24x1.5 นิ้ว', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS49', qr_code: 'EMS49', item_name: '*เข็มฉีดยาดีสโพสเซเบิ้ล เบอร์ 25x1 นิ้ว', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS50', qr_code: 'EMS50', item_name: '*เข็มฉีดยาดีสโพสเซเบิ้ล No. 27x1/2"', category: 'IV & Fluids', subcategory: 'Syringes', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS51', qr_code: 'EMS51', item_name: 'ไอ.วี. แคทดิเตอร์ เบอร์ 16x2 นิ้ว (16x1.77")', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS52', qr_code: 'EMS52', item_name: 'ไอ.วี.แคทดิเตอร์ 18x2"', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS53', qr_code: 'EMS53', item_name: '*ไอ.วี แคทดิเตอร์ เบอร์ 20 x 1 1/4"-1 1/2"(20x1.16")', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS54', qr_code: 'EMS54', item_name: '*ไอ.วี แคทดิเตอร์ เบอร์ 22 x 1"', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS55', qr_code: 'EMS55', item_name: '*ไอ.วี แคทดิเตอร์ เบอร์ 24 x 3/4" (24x0.75") หรือ 1 1/4"', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS56', qr_code: 'EMS56', item_name: '*ไอ.วี แคทดิเตอร์ เบอร์ 18 x 1 1/4"-1 1/2" (18x1.16")', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS57', qr_code: 'EMS57', item_name: 'ไอ.วี แคทดิเตอร์ เบอร์ 20x2 นิ้ว (20x1.88)', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS58', qr_code: 'EMS58', item_name: 'IV set ผู้ใหญ่ ชนิดธรรมดา', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชุด', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS59', qr_code: 'EMS59', item_name: 'สาย Extension tube 18"', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS60', qr_code: 'EMS60', item_name: 'ทรีเวย์ Stopcock TW-0001', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS61', qr_code: 'EMS61', item_name: 'คอนเนตติ้ง ตัวตรง 7/4 มม.', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS62', qr_code: 'EMS62', item_name: 'สเคาฟ์เวนฟ์ no 21x3/4"', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS63', qr_code: 'EMS63', item_name: 'สเคาฟ์เวนฟ์ no 25x3/4"', category: 'IV & Fluids', subcategory: 'IV Therapy', unit: 'ชิ้น', current_stock: 0, minimum_stock: 8, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS64', qr_code: 'EMS64', item_name: 'สำลีก้อนปราศจากเชื้อ (1ซอง มี 3 ชิ้น)', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 0, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS65', qr_code: 'EMS65', item_name: 'ไม้พันสำลีปราศจากเชื้อ (1ซอง/5ก้าน) sizeM ประมาณ6นิ้ว', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 0, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS66', qr_code: 'EMS66', item_name: 'ผ้าก๊อซแบบสำเร็จรูป 3x4x8 พับ (5ชิ้น/ห่อ)', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 0, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS67', qr_code: 'EMS67', item_name: 'ผ้าพันแผล ขนาด 4 นิ้ว', category: 'Wound Care', subcategory: 'Dressing', unit: 'ม้วน', current_stock: 0, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS68', qr_code: 'EMS68', item_name: 'พลาสเตอร์ปิดแผลชนิดพลาสติก', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 0, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS69', qr_code: 'EMS69', item_name: 'พลาสเตอร์ใสขนาด 1/2 นิ้ว', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 0, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS70', qr_code: 'EMS70', item_name: 'พลาสเตอร์ใสขนาด 1 นิ้ว', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 0, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS71', qr_code: 'EMS71', item_name: 'ใบมีดผ่าตัด เบอร์ 10', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 0, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS72', qr_code: 'EMS72', item_name: 'ใบมีดผ่าตัด เบอร์ 11', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 0, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS73', qr_code: 'EMS73', item_name: 'เสื้อคลุม non sterrile disposable แบบครึ่งตัว(สีฟ้า)', category: 'PPE', subcategory: 'Protection', unit: 'ชิ้น', current_stock: 0, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS74', qr_code: 'EMS74', item_name: 'เสื้อคลุม non sterile disposable แบบเต็มตัว(สีเหลือง)', category: 'PPE', subcategory: 'Protection', unit: 'ชิ้น', current_stock: 0, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS75', qr_code: 'EMS75', item_name: 'หน้ากากกันสารคัดหลั่งใช้แล้วทิ้ง ลักษณะใส (Face Shield PDG)', category: 'PPE', subcategory: 'Protection', unit: 'ชิ้น', current_stock: 0, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS76', qr_code: 'EMS76', item_name: 'หมวกกระดาษสีเขียว ใช้แล้วทิ้ง', category: 'PPE', subcategory: 'Protection', unit: 'ชิ้น', current_stock: 0, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS77', qr_code: 'EMS77', item_name: 'ผ้าปิดจมูกใช้แล้วทิ้ง ชนิด 3 ชั้น (แบบคล้องหู)', category: 'PPE', subcategory: 'Protection', unit: 'ชิ้น', current_stock: 0, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS78', qr_code: 'EMS78', item_name: 'หน้ากากป้องกันเชื้อโรค N 95 8210', category: 'PPE', subcategory: 'Protection', unit: 'ชิ้น', current_stock: 0, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS79', qr_code: 'EMS79', item_name: 'ถุงมือ Latex ปราศจากเชื้อ ไร้แป้ง เบอร์ 6.5', category: 'PPE', subcategory: 'Protection', unit: 'คู่', current_stock: 0, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS80', qr_code: 'EMS80', item_name: 'ถุงมือ Latex ปราศจากเชื้อ ไร้แป้ง เบอร์ 7', category: 'PPE', subcategory: 'Protection', unit: 'คู่', current_stock: 0, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS81', qr_code: 'EMS81', item_name: 'ถุงมือสำหรับตรวจโรคใช้แล้วทิ้ง เบอร์ เอส', category: 'PPE', subcategory: 'Protection', unit: 'คู่', current_stock: 0, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS82', qr_code: 'EMS82', item_name: 'ถุงมือสำหรับตรวจโรคใช้แล้วทิ้ง เบอร์ เอ็ม', category: 'PPE', subcategory: 'Protection', unit: 'คู่', current_stock: 0, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS83', qr_code: 'EMS83', item_name: 'ถุงมือสำหรับตรวจโรคใช้แล้วทิ้ง เบอร์ แอล', category: 'PPE', subcategory: 'Protection', unit: 'คู่', current_stock: 0, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS84', qr_code: 'EMS84', item_name: 'ถุงมือดีสโพส เบอร ์เอส ชนิดไม่มีแป้ง', category: 'PPE', subcategory: 'Protection', unit: 'คู่', current_stock: 0, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS85', qr_code: 'EMS85', item_name: 'ถุงมือชนิดไม่มีแป้งเบอร์ M (Disposable Glove Powder Free)', category: 'PPE', subcategory: 'Protection', unit: 'คู่', current_stock: 0, minimum_stock: 30, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS86', qr_code: 'EMS86', item_name: 'แผ่นผ้าชุบน้ำยาทำลายเชื้อสำเร็จรูปใช้แล้วทิ้ง', category: 'Other', subcategory: 'Disinfection', unit: 'ชิ้น', current_stock: 0, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS87', qr_code: 'EMS87', item_name: 'แอลกอฮอล์ชุปสำเร็จ (Alcohol Pad) (1กล่อง/200ชิ้น)', category: 'Other', subcategory: 'Disinfection', unit: 'ชิ้น', current_stock: 0, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS88', qr_code: 'EMS88', item_name: 'ชุดน้ำยาตรวจ Covid Ag (25 test/kit)', category: 'Other', subcategory: 'Disinfection', unit: 'ชุด', current_stock: 0, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS89', qr_code: 'EMS89', item_name: '52% Chlorhexidine Gluconate in 70%', category: 'Other', subcategory: 'Disinfection', unit: 'ชิ้น', current_stock: 0, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS90', qr_code: 'EMS90', item_name: 'แบตเตอรี่ แอคคิวเซ็ต แอคทีพ (ยี่ห้อแอดแวนเทจ)', category: 'Cardiac Equipment', subcategory: 'Monitoring', unit: 'ชิ้น', current_stock: 0, minimum_stock: 5, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS91', qr_code: 'EMS91', item_name: 'กระดาษ อีเคจี ขนาด 50 x 30 มม.', category: 'Cardiac Equipment', subcategory: 'Monitoring', unit: 'ชิ้น', current_stock: 0, minimum_stock: 5, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS92', qr_code: 'EMS92', item_name: 'แผ่นอิเลคโทรด', category: 'Cardiac Equipment', subcategory: 'Monitoring', unit: 'ชิ้น', current_stock: 0, minimum_stock: 5, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS93', qr_code: 'EMS93', item_name: 'ครีมอีเคจี จุไม่ต่ำกว่า 50 กรัม', category: 'Cardiac Equipment', subcategory: 'Monitoring', unit: 'ชิ้น', current_stock: 0, minimum_stock: 5, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS94', qr_code: 'EMS94', item_name: 'แถบหาน้ำตาลในเลือด', category: 'Cardiac Equipment', subcategory: 'Monitoring', unit: 'ชิ้น', current_stock: 0, minimum_stock: 5, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS95', qr_code: 'EMS95', item_name: 'เจลหล่อลื่นอุปกรณ์ทางการแพทย์ที่จะสอดใส่เข้าในร่างกาย', category: 'Other', subcategory: 'General', unit: 'ชิ้น', current_stock: 0, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS96', qr_code: 'EMS96', item_name: 'ถังทิ้งเข็ม ขนาด 6.2 ลิตร', category: 'Other', subcategory: 'General', unit: 'ชิ้น', current_stock: 0, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS97', qr_code: 'EMS97', item_name: 'Thoracic catheter No.28', category: 'Other', subcategory: 'General', unit: 'ชิ้น', current_stock: 0, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS98', qr_code: 'EMS98', item_name: 'Thoracic catheter No.32', category: 'Other', subcategory: 'General', unit: 'ชิ้น', current_stock: 0, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS99', qr_code: 'EMS99', item_name: 'Thoracic catheter No.36', category: 'Other', subcategory: 'General', unit: 'ชิ้น', current_stock: 0, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS100', qr_code: 'EMS100', item_name: 'เครื่องช่วยฟัง', category: 'Other', subcategory: 'General', unit: 'ชิ้น', current_stock: 0, minimum_stock: 3, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    { barcode: 'EMS101', qr_code: 'EMS101', item_name: 'กรรไกรตัดพลาสเตอร์ 22 cm.', category: 'Wound Care', subcategory: 'Dressing', unit: 'ชิ้น', current_stock: 0, minimum_stock: 10, location: 'EMS', item_image: '', created_date: now, updated_date: now },
    ...OFFICE_SEED_ITEMS.map(i => ({ ...i, created_date: now, updated_date: now })),
    ...HOUSEKEEPING_SEED_ITEMS.map(i => ({ ...i, created_date: now, updated_date: now }))
  ];

  const batch = writeBatch(db);
  for (const item of items) {
    const docRef = doc(collection(db, 'items'));
    batch.set(docRef, item);
  }
  await batch.commit();

  await setSetting('seeded_v3_firebase', true);
  await setSetting('seeded_office_items_v1', true);
  await setSetting('seeded_office_items_v2', true);
  await setSetting('seeded_housekeeping_items_v1', true);
  console.log('✅ Database seeded with EMS inventory data (Firebase)');
}

/* ── Item Helpers ── */
export async function getAllItems() {
  if (isDemoMode()) {
    initDemoData();
    const items = getLocalDemoData('ems_demo_items');
    return items.sort((a, b) => {
      const codeA = a.barcode || '';
      const codeB = b.barcode || '';
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }
  const snapshot = await getDocs(collection(db, 'items'));
  const items = snapshotToArray(snapshot, 'item_id');
  return items.sort((a, b) => {
    const codeA = a.barcode || '';
    const codeB = b.barcode || '';
    return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export async function getItemById(id) {
  if (isDemoMode()) {
    initDemoData();
    const items = getLocalDemoData('ems_demo_items');
    return items.find(i => i.item_id === id) || null;
  }
  if (!id) return null;
  const docSnap = await getDoc(doc(db, 'items', id.toString()));
  if (docSnap.exists()) {
    return { item_id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

export async function getItemByBarcode(barcode) {
  if (isDemoMode()) {
    initDemoData();
    const items = getLocalDemoData('ems_demo_items');
    return items.find(i => i.barcode === barcode || i.qr_code === barcode) || null;
  }
  const q = query(collection(db, 'items'), where('barcode', '==', barcode));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const docSnap = snapshot.docs[0];
    return { item_id: docSnap.id, ...docSnap.data() };
  }
  // Try QR Code
  const q2 = query(collection(db, 'items'), where('qr_code', '==', barcode));
  const snap2 = await getDocs(q2);
  if (!snap2.empty) {
    const docSnap = snap2.docs[0];
    return { item_id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

export async function saveItem(item) {
  item.updated_date = new Date().toISOString();
  if (!item.created_date) item.created_date = item.updated_date;
  
  if (isDemoMode()) {
    initDemoData();
    const items = getLocalDemoData('ems_demo_items');
    if (item.item_id) {
      const idx = items.findIndex(i => i.item_id === item.item_id);
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...item };
      }
      setLocalDemoData('ems_demo_items', items);
      return item.item_id;
    } else {
      const newId = 'demo_item_' + Date.now();
      const newItem = { ...item, item_id: newId };
      items.push(newItem);
      setLocalDemoData('ems_demo_items', items);
      return newId;
    }
  }
  
  if (item.item_id) {
    const id = item.item_id.toString();
    const data = { ...item };
    delete data.item_id;
    await setDoc(doc(db, 'items', id), data, { merge: true });
    return id;
  } else {
    const docRef = await addDoc(collection(db, 'items'), item);
    return docRef.id;
  }
}

export async function deleteItem(id) {
  if (isDemoMode()) {
    initDemoData();
    let items = getLocalDemoData('ems_demo_items');
    items = items.filter(i => i.item_id !== id);
    setLocalDemoData('ems_demo_items', items);
    return;
  }
  if (!id) return;
  await deleteDoc(doc(db, 'items', id.toString()));
}

export async function getLowStockItems() {
  const all = await getAllItems();
  return all.filter(i => i.current_stock < i.minimum_stock || i.current_stock === 0);
}

/* ── Transaction Helpers ── */
export async function getItemByBarcodeAndLocation(barcode, location) {
  if (isDemoMode()) {
    initDemoData();
    const items = getLocalDemoData('ems_demo_items');
    return items.find(i => i.barcode === barcode && i.location === location) || null;
  }
  if (!barcode || !location) return null;
  const q = query(
    collection(db, 'items'),
    where('barcode', '==', barcode),
    where('location', '==', location)
  );
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const docSnap = snapshot.docs[0];
    return { item_id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

export async function addTransaction(txObj) {
  txObj.datetime = new Date().toISOString();
  
  if (isDemoMode()) {
    initDemoData();
    let targetItemId = txObj.item_id;
    let balanceAfter = 0;
    let itemToNotify = null;
    
    let items = getLocalDemoData('ems_demo_items');
    
    if (txObj.transaction_type === 'Receive') {
      let item = items.find(i => i.barcode === txObj.barcode && i.location === txObj.location);
      if (item) {
        item.current_stock += Number(txObj.quantity);
        item.updated_date = txObj.datetime;
        targetItemId = item.item_id;
        balanceAfter = item.current_stock;
        itemToNotify = item;
      } else {
        const originalItem = items.find(i => i.item_id === txObj.item_id);
        if (originalItem) {
          const newId = 'demo_item_' + Date.now();
          const newItem = {
            ...originalItem,
            item_id: newId,
            location: txObj.location,
            current_stock: Number(txObj.quantity),
            created_date: txObj.datetime,
            updated_date: txObj.datetime
          };
          items.push(newItem);
          targetItemId = newId;
          balanceAfter = Number(txObj.quantity);
          itemToNotify = newItem;
        }
      }
    } else if (txObj.transaction_type === 'Issue') {
      let item = items.find(i => i.barcode === txObj.barcode && i.location === txObj.location);
      if (item) {
        item.current_stock -= Number(txObj.quantity);
        if (item.current_stock < 0) item.current_stock = 0;
        item.updated_date = txObj.datetime;
        targetItemId = item.item_id;
        balanceAfter = item.current_stock;
        itemToNotify = item;
      }
    } else if (txObj.transaction_type === 'Adjust') {
      let item = items.find(i => i.item_id === txObj.item_id);
      if (item) {
        item.current_stock += Number(txObj.quantity);
        if (item.current_stock < 0) item.current_stock = 0;
        item.updated_date = txObj.datetime;
        targetItemId = item.item_id;
        balanceAfter = item.current_stock;
        itemToNotify = item;
      }
    } else if (txObj.transaction_type === 'Transfer') {
      let sourceItem = items.find(i => i.barcode === txObj.barcode && i.location === txObj.location);
      if (sourceItem) {
        sourceItem.current_stock -= Number(txObj.quantity);
        if (sourceItem.current_stock < 0) sourceItem.current_stock = 0;
        sourceItem.updated_date = txObj.datetime;
        itemToNotify = sourceItem;
      }
      
      let targetItem = items.find(i => i.barcode === txObj.barcode && i.location === txObj.target_location);
      if (targetItem) {
        targetItem.current_stock += Number(txObj.quantity);
        targetItem.updated_date = txObj.datetime;
        targetItemId = targetItem.item_id;
        balanceAfter = targetItem.current_stock;
      } else if (sourceItem) {
        const newId = 'demo_item_' + Date.now();
        const newItem = {
          ...sourceItem,
          item_id: newId,
          location: txObj.target_location,
          current_stock: Number(txObj.quantity),
          created_date: txObj.datetime,
          updated_date: txObj.datetime
        };
        items.push(newItem);
        targetItemId = newId;
        balanceAfter = Number(txObj.quantity);
      }
    }
    
    setLocalDemoData('ems_demo_items', items);
    
    txObj.item_id = targetItemId;
    txObj.balance_after_transaction = balanceAfter;
    
    const txs = getLocalDemoData('ems_demo_transactions');
    const txId = 'demo_tx_' + Date.now();
    const newTx = { ...txObj, transaction_id: txId };
    txs.unshift(newTx);
    setLocalDemoData('ems_demo_transactions', txs);
    
    if (itemToNotify && itemToNotify.current_stock <= itemToNotify.minimum_stock) {
      const notifications = getLocalDemoData('ems_demo_notifications');
      notifications.unshift({
        notification_id: 'demo_notif_' + Date.now(),
        item_id: itemToNotify.item_id,
        notification_type: 'low_stock',
        message: `${itemToNotify.item_name} (${itemToNotify.location}) มีสต๊อกต่ำ: ${itemToNotify.current_stock} ${itemToNotify.unit} (ขั้นต่ำ: ${itemToNotify.minimum_stock})`,
        datetime: txObj.datetime,
        status: 'unread'
      });
      setLocalDemoData('ems_demo_notifications', notifications);
    }
    
    return txId;
  }
  
  let targetItemId = txObj.item_id;
  let balanceAfter = 0;
  let itemToNotify = null;

  if (txObj.transaction_type === 'Receive') {
    // 1. Search for item with matching barcode and target location
    let item = await getItemByBarcodeAndLocation(txObj.barcode, txObj.location);
    if (item) {
      item.current_stock += Number(txObj.quantity);
      item.updated_date = txObj.datetime;
      await saveItem(item);
      targetItemId = item.item_id;
      balanceAfter = item.current_stock;
      itemToNotify = item;
    } else {
      // Create a new item record at the target location using original item as template
      const originalItem = await getItemById(txObj.item_id);
      if (originalItem) {
        const newItem = {
          ...originalItem,
          location: txObj.location,
          current_stock: Number(txObj.quantity),
          created_date: txObj.datetime,
          updated_date: txObj.datetime
        };
        delete newItem.item_id;
        const newId = await saveItem(newItem);
        targetItemId = newId;
        balanceAfter = Number(txObj.quantity);
        newItem.item_id = newId;
        itemToNotify = newItem;
      }
    }
  } else if (txObj.transaction_type === 'Issue') {
    // Search for item with matching barcode and source location
    let item = await getItemByBarcodeAndLocation(txObj.barcode, txObj.location);
    if (item) {
      item.current_stock -= Number(txObj.quantity);
      if (item.current_stock < 0) item.current_stock = 0;
      item.updated_date = txObj.datetime;
      await saveItem(item);
      targetItemId = item.item_id;
      balanceAfter = item.current_stock;
      itemToNotify = item;
    }
  } else if (txObj.transaction_type === 'Adjust') {
    let item = await getItemById(txObj.item_id);
    if (item) {
      item.current_stock += Number(txObj.quantity);
      if (item.current_stock < 0) item.current_stock = 0;
      item.updated_date = txObj.datetime;
      await saveItem(item);
      targetItemId = item.item_id;
      balanceAfter = item.current_stock;
      itemToNotify = item;
    }
  } else if (txObj.transaction_type === 'Transfer') {
    // 1. Deduct from source item
    let sourceItem = await getItemByBarcodeAndLocation(txObj.barcode, txObj.location);
    if (sourceItem) {
      sourceItem.current_stock -= Number(txObj.quantity);
      if (sourceItem.current_stock < 0) sourceItem.current_stock = 0;
      sourceItem.updated_date = txObj.datetime;
      await saveItem(sourceItem);
      itemToNotify = sourceItem; // check low stock on source too
    }

    // 2. Add to target item
    let targetItem = await getItemByBarcodeAndLocation(txObj.barcode, txObj.target_location);
    if (targetItem) {
      targetItem.current_stock += Number(txObj.quantity);
      targetItem.updated_date = txObj.datetime;
      await saveItem(targetItem);
      targetItemId = targetItem.item_id;
      balanceAfter = targetItem.current_stock;
    } else {
      // Create new copy of the item at target location
      if (sourceItem) {
        const newItem = {
          ...sourceItem,
          location: txObj.target_location,
          current_stock: Number(txObj.quantity),
          created_date: txObj.datetime,
          updated_date: txObj.datetime
        };
        delete newItem.item_id;
        const newId = await saveItem(newItem);
        targetItemId = newId;
        balanceAfter = Number(txObj.quantity);
      }
    }
  }

  // Update txObj properties before saving transaction
  txObj.item_id = targetItemId;
  txObj.balance_after_transaction = balanceAfter;

  const docRef = await addDoc(collection(db, 'transactions'), txObj);
  const id = docRef.id;

  // Check low stock notifications
  if (itemToNotify && itemToNotify.current_stock <= itemToNotify.minimum_stock) {
    await addDoc(collection(db, 'notifications'), {
      item_id: itemToNotify.item_id,
      notification_type: 'low_stock',
      message: `${itemToNotify.item_name} (${itemToNotify.location}) มีสต๊อกต่ำ: ${itemToNotify.current_stock} ${itemToNotify.unit} (ขั้นต่ำ: ${itemToNotify.minimum_stock})`,
      datetime: txObj.datetime,
      status: 'unread',
    });
  }

  // Queue for Google Sheets sync
  await addDoc(collection(db, 'sync_queue'), {
    type: 'transaction',
    data: { ...txObj, transaction_id: id },
    timestamp: txObj.datetime,
    status: 'pending',
  });

  return id;
}

export async function getAllTransactions() {
  if (isDemoMode()) {
    initDemoData();
    return getLocalDemoData('ems_demo_transactions');
  }
  const q = query(collection(db, 'transactions'), orderBy('datetime', 'desc'));
  const snapshot = await getDocs(q);
  return snapshotToArray(snapshot, 'transaction_id');
}

/* ── User Helpers ── */
export async function getAllUsers() {
  if (isDemoMode()) {
    initDemoData();
    return getLocalDemoData('ems_demo_users');
  }
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshotToArray(snapshot, 'user_id');
}
export async function getUserByEmail(email) {
  if (isDemoMode()) {
    initDemoData();
    const users = getLocalDemoData('ems_demo_users');
    return users.find(u => u.email === email) || null;
  }
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const docSnap = snapshot.docs[0];
    return { user_id: docSnap.id, ...docSnap.data() };
  }
  return null;
}
export async function saveUser(user) {
  if (isDemoMode()) {
    initDemoData();
    const users = getLocalDemoData('ems_demo_users');
    if (user.user_id) {
      const idx = users.findIndex(u => u.user_id === user.user_id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...user };
      }
      setLocalDemoData('ems_demo_users', users);
      return user.user_id;
    } else {
      const newId = 'demo_user_' + Date.now();
      users.push({ ...user, user_id: newId });
      setLocalDemoData('ems_demo_users', users);
      return newId;
    }
  }
  if (user.user_id) {
    const id = user.user_id.toString();
    const data = { ...user };
    delete data.user_id;
    await setDoc(doc(db, 'users', id), data, { merge: true });
    return id;
  } else {
    const docRef = await addDoc(collection(db, 'users'), user);
    return docRef.id;
  }
}
export async function deleteUser(id) {
  if (isDemoMode()) {
    initDemoData();
    let users = getLocalDemoData('ems_demo_users');
    users = users.filter(u => u.user_id !== id);
    setLocalDemoData('ems_demo_users', users);
    return;
  }
  if (!id) return;
  await deleteDoc(doc(db, 'users', id.toString()));
}

/* ── Notification Helpers ── */
export async function getUnreadNotifications() {
  if (isDemoMode()) {
    initDemoData();
    const notifications = getLocalDemoData('ems_demo_notifications');
    const unread = notifications.filter(n => n.status === 'unread');
    return unread.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
  }
  const q = query(collection(db, 'notifications'), where('status', '==', 'unread'));
  const snapshot = await getDocs(q);
  const arr = snapshotToArray(snapshot, 'notification_id');
  return arr.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
}
export async function markAllNotificationsRead() {
  if (isDemoMode()) {
    initDemoData();
    const notifications = getLocalDemoData('ems_demo_notifications');
    notifications.forEach(n => { n.status = 'read'; });
    setLocalDemoData('ems_demo_notifications', notifications);
    return;
  }
  const q = query(collection(db, 'notifications'), where('status', '==', 'unread'));
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.forEach(docSnap => {
    batch.update(docSnap.ref, { status: 'read' });
  });
  await batch.commit();
}

/* ── Checklist Helpers ── */
export async function saveChecklist(data) {
  if (isDemoMode()) {
    initDemoData();
    const checklists = getLocalDemoData('ems_demo_checklists');
    if (data.checklist_id) {
      const idx = checklists.findIndex(c => c.checklist_id === data.checklist_id);
      if (idx !== -1) {
        checklists[idx] = { ...checklists[idx], ...data };
      }
      setLocalDemoData('ems_demo_checklists', checklists);
      return data.checklist_id;
    } else {
      const newId = 'demo_checklist_' + Date.now();
      checklists.push({ ...data, checklist_id: newId });
      setLocalDemoData('ems_demo_checklists', checklists);
      return newId;
    }
  }
  if (data.checklist_id) {
    const id = data.checklist_id.toString();
    const d = { ...data };
    delete d.checklist_id;
    await setDoc(doc(db, 'checklists', id), d, { merge: true });
    return id;
  } else {
    const docRef = await addDoc(collection(db, 'checklists'), data);
    return docRef.id;
  }
}
export async function getChecklistByDate(date, location) {
  if (isDemoMode()) {
    initDemoData();
    const checklists = getLocalDemoData('ems_demo_checklists');
    return checklists.find(c => c.date === date && c.location === location) || null;
  }
  const q = query(collection(db, 'checklists'), where('date', '==', date), where('location', '==', location));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const docSnap = snapshot.docs[0];
    return { checklist_id: docSnap.id, ...docSnap.data() };
  }
  return null;
}
export async function getAllChecklists() {
  if (isDemoMode()) {
    initDemoData();
    const checklists = getLocalDemoData('ems_demo_checklists');
    return checklists.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  const q = query(collection(db, 'checklists'), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshotToArray(snapshot, 'checklist_id');
}

/* ── Generic Helpers for Sync.js ── */
export async function dbGetAll(colName) {
  if (isDemoMode()) {
    initDemoData();
    return getLocalDemoData('ems_demo_' + colName);
  }
  const snapshot = await getDocs(collection(db, colName));
  return snapshotToArray(snapshot, 'id');
}
export async function dbPut(colName, data) {
  if (isDemoMode()) {
    initDemoData();
    const items = getLocalDemoData('ems_demo_' + colName);
    const idField = data.id ? 'id' : (data.item_id ? 'item_id' : null);
    if (idField && data[idField]) {
      const idx = items.findIndex(i => i[idField] === data[idField]);
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...data };
      }
      setLocalDemoData('ems_demo_' + colName, items);
      return data[idField];
    } else {
      const newId = 'demo_' + colName + '_' + Date.now();
      const finalIdField = idField || 'id';
      const newItem = { ...data, [finalIdField]: newId };
      items.push(newItem);
      setLocalDemoData('ems_demo_' + colName, items);
      return newId;
    }
  }
  const idField = data.id ? 'id' : (data.item_id ? 'item_id' : null);
  if (idField && data[idField]) {
    const id = data[idField].toString();
    const d = { ...data };
    delete d[idField];
    await setDoc(doc(db, colName, id), d, { merge: true });
    return id;
  } else {
    const docRef = await addDoc(collection(db, colName), data);
    return docRef.id;
  }
}

export async function dbAdd(colName, data) {
  if (isDemoMode()) {
    initDemoData();
    const items = getLocalDemoData('ems_demo_' + colName);
    const newId = 'demo_' + colName + '_' + Date.now();
    const newItem = { ...data, id: newId };
    items.push(newItem);
    setLocalDemoData('ems_demo_' + colName, items);
    return newId;
  }
  const docRef = await addDoc(collection(db, colName), data);
  return docRef.id;
}

export async function openDB() {
  return Promise.resolve();
}
