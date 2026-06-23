/* =========================================================
   EMS Stock Manager — sync.js
   Google Sheets integration via Apps Script Web App
   ========================================================= */

import { dbGetAll, dbPut, getSetting } from './db.js';

let _syncInProgress = false;

/* ── Get Apps Script URL ── */
async function getScriptUrl() {
  return await getSetting('google_script_url') || null;
}

/* ── Send data to Google Sheets ── */
async function postToSheets(url, payload) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

/* ── Sync a single transaction row ── */
export async function syncTransaction(txData) {
  const url = await getScriptUrl();
  if (!url) return; // Not configured

  await postToSheets(url, {
    action: 'appendTransaction',
    data: {
      datetime:         txData.datetime,
      item_name:        txData.item_name || '',
      barcode:          txData.barcode   || '',
      transaction_type: txData.transaction_type,
      quantity:         txData.quantity,
      balance:          txData.balance_after_transaction,
      user_name:        txData.user_name,
      remarks:          txData.remarks || '',
    },
  });
}

/* ── Full inventory sync ── */
export async function syncInventory(items) {
  const url = await getScriptUrl();
  if (!url) return;

  await postToSheets(url, {
    action: 'updateInventory',
    data: items.map(i => ({
      item_id:       i.item_id,
      barcode:       i.barcode,
      item_name:     i.item_name,
      category:      i.category,
      current_stock: i.current_stock,
      minimum_stock: i.minimum_stock,
      location:      i.location,
      last_updated:  i.updated_date,
    })),
  });
}

/* ── Process sync queue ── */
export async function processSyncQueue() {
  if (_syncInProgress) return;
  const url = await getScriptUrl();
  if (!url) return;

  _syncInProgress = true;
  try {
    const queue = await dbGetAll('sync_queue');
    const pending = queue.filter(q => q.status === 'pending');

    for (const item of pending) {
      try {
        if (item.type === 'transaction') {
          await syncTransaction(item.data);
        }
        item.status = 'synced';
        item.synced_at = new Date().toISOString();
        await dbPut('sync_queue', item);
      } catch (err) {
        item.status = 'error';
        item.error  = err.message;
        await dbPut('sync_queue', item);
      }
    }
  } finally {
    _syncInProgress = false;
  }
}

/* ── Auto sync on network restore ── */
export function initAutoSync() {
  window.addEventListener('online', () => {
    console.log('🌐 Online — processing sync queue...');
    processSyncQueue();
  });

  // Process on load if online
  if (navigator.onLine) {
    setTimeout(processSyncQueue, 3000);
  }
}

/* ── Get sync status ── */
export async function getSyncStatus() {
  const queue = await dbGetAll('sync_queue');
  const pending = queue.filter(q => q.status === 'pending').length;
  const errors  = queue.filter(q => q.status === 'error').length;
  return { pending, errors, total: queue.length };
}
