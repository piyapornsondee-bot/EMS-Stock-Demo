/* =========================================================
   EMS Stock Manager — notifications.js
   Low stock alerts, notification badge, toast system
   ========================================================= */

import { getUnreadNotifications, markAllNotificationsRead, getLowStockItems } from './db.js';

/* ── Toast notifications ── */
const TOAST_DURATION = 4000;

export function showToast(type, title, message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'check_circle',
    error:   'error',
    warning: 'warning',
    info:    'info',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      <span class="material-symbols-rounded">${icons[type] || 'info'}</span>
    </div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:rgba(255,255,255,.5);cursor:pointer;padding:4px;display:flex;align-items:center;flex-shrink:0;">
      <span class="material-symbols-rounded" style="font-size:16px;">close</span>
    </button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 350);
  }, TOAST_DURATION);
}

export const toast = {
  success: (title, msg) => showToast('success', title, msg),
  error:   (title, msg) => showToast('error',   title, msg),
  warning: (title, msg) => showToast('warning', title, msg),
  info:    (title, msg) => showToast('info',    title, msg),
};

/* ── Update notification badge in topbar ── */
export async function updateNotifBadge() {
  const notifs = await getUnreadNotifications();
  const badge  = document.getElementById('notif-badge');
  if (!badge) return;

  if (notifs.length > 0) {
    badge.textContent = notifs.length > 9 ? '9+' : notifs.length;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
  return notifs;
}

/* ── Render notification dropdown ── */
export async function renderNotifDropdown() {
  const notifs = await getUnreadNotifications();
  const low    = await getLowStockItems();

  const panel = document.getElementById('notif-panel');
  if (!panel) return;

  if (notifs.length === 0) {
    panel.innerHTML = `
      <div class="empty-state" style="padding:32px 16px;">
        <div class="empty-state-icon"><span class="material-symbols-rounded">notifications_none</span></div>
        <div class="empty-state-title">ไม่มีการแจ้งเตือน</div>
      </div>
    `;
    return;
  }

  panel.innerHTML = `
    <div style="padding:12px 16px;border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:13px;font-weight:600;color:var(--text-primary);">การแจ้งเตือน (${notifs.length})</span>
      <button id="mark-all-read" style="font-size:11px;color:var(--primary-800);cursor:pointer;background:none;border:none;font-weight:600;">อ่านทั้งหมด</button>
    </div>
    <div style="max-height:320px;overflow-y:auto;">
      ${notifs.slice(0, 10).map(n => `
        <div class="dropdown-item" style="align-items:flex-start;gap:10px;padding:12px 16px;">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--color-danger-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
            <span class="material-symbols-rounded" style="font-size:16px;color:var(--color-danger);">warning</span>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:2px;">สต๊อกต่ำ</div>
            <div style="font-size:11px;color:var(--text-muted);line-height:1.4;">${n.message}</div>
            <div style="font-size:10px;color:var(--neutral-400);margin-top:4px;">${formatDateTime(n.datetime)}</div>
          </div>
        </div>
      `).join('')}
    </div>
    ${notifs.length > 10 ? `<div style="padding:8px 16px;text-align:center;font-size:12px;color:var(--primary-800);border-top:1px solid var(--border-light);">ดูทั้งหมด ${notifs.length} รายการ</div>` : ''}
  `;

  document.getElementById('mark-all-read')?.addEventListener('click', async () => {
    await markAllNotificationsRead();
    await updateNotifBadge();
    panel.innerHTML = '';
    toast.info('อ่านการแจ้งเตือนทั้งหมดแล้ว');
  });
}

/* ── Check and alert for low stock on page load ── */
export async function checkLowStockAlerts() {
  const items = await getLowStockItems();
  if (items.length > 0) {
    // Only show once per session
    const shown = sessionStorage.getItem('low_stock_alerted');
    if (!shown) {
      toast.warning(
        `สต๊อกต่ำ ${items.length} รายการ`,
        'กรุณาตรวจสอบและเติมสินค้า'
      );
      sessionStorage.setItem('low_stock_alerted', '1');
    }
  }
}

/* ── Format datetime ── */
export function formatDateTime(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('th-TH', {
      day:    '2-digit',
      month:  '2-digit',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    });
  } catch { return isoStr; }
}

export function formatDate(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return isoStr; }
}

export function timeAgo(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'เมื่อกี้';
  if (mins  < 60) return `${mins} นาทีที่แล้ว`;
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  return `${days} วันที่แล้ว`;
}
