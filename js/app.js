/* =========================================================
   EMS Stock Manager — app.js
   App shell: sidebar, topbar, navigation, shared init
   ========================================================= */

import { authGuard, getCurrentUser, logout, hasPermission, getInitials, getRoleBadgeClass } from './auth.js';
import { seedDatabase, getLowStockItems, isDemoMode } from './db.js';
import { updateNotifBadge, renderNotifDropdown, checkLowStockAlerts, toast } from './notifications.js';
import { initAutoSync } from './sync.js';

/* ── Current page detection ── */
const PAGE = (() => {
  const p = window.location.pathname;
  if (p.includes('dashboard'))    return 'dashboard';
  if (p.includes('inventory'))    return 'inventory';
  if (p.includes('receive'))      return 'receive';
  if (p.includes('issue'))        return 'issue';
  if (p.includes('transactions')) return 'transactions';
  if (p.includes('reports'))      return 'reports';
  if (p.includes('users'))        return 'users';
  if (p.includes('settings'))     return 'settings';
  if (p.includes('manual'))        return 'manual';
  return 'dashboard';
})();

/* ── Nav config ── */
const NAV_ITEMS = [
  { id: 'dashboard',    label: 'Dashboard',          icon: 'dashboard',        href: 'dashboard.html',    permission: null },
  { id: 'inventory',    label: 'คลังพัสดุ',           icon: 'inventory_2',      href: 'inventory.html',    permission: 'view_inventory' },
  { id: 'receive',      label: 'รับพัสดุเข้า',         icon: 'add_shopping_cart', href: 'receive.html',      permission: 'receive_stock' },
  { id: 'issue',        label: 'จ่ายพัสดุออก',         icon: 'shopping_cart_checkout', href: 'issue.html',   permission: 'issue_stock' },
  { id: 'transactions', label: 'ประวัติการทำรายการ',   icon: 'receipt_long',     href: 'transactions.html', permission: 'view_inventory' },
  { id: 'reports',      label: 'รายงาน',              icon: 'bar_chart',        href: 'reports.html',      permission: 'view_reports' },
  { id: 'users',        label: 'จัดการผู้ใช้',          icon: 'manage_accounts',  href: 'users.html',        permission: 'manage_users' },
  { id: 'settings',     label: 'ตั้งค่า',              icon: 'settings',         href: 'settings.html',     permission: 'manage_users' },
  { id: 'manual',       label: 'คู่มือการใช้งาน',      icon: 'menu_book',        href: 'manual.html',       permission: null },
]; // navigation items definition

/* ── Render sidebar ── */
function renderSidebar(user, lowCount) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const navHtml = NAV_ITEMS
    .filter(n => !n.permission || hasPermission(n.permission))
    .map(n => `
      <a class="nav-item ${PAGE === n.id ? 'active' : ''}" href="${n.href}" id="nav-${n.id}">
        <span class="material-symbols-rounded">${n.icon}</span>
        <span>${n.label}</span>
        ${n.id === 'inventory' && lowCount > 0 ? `<span class="nav-badge">${lowCount}</span>` : ''}
      </a>
    `).join('');

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <img src="../assets/logo.svg" alt="EMS Stock Logo" style="width:36px;height:36px;display:block;" />
      <div class="sidebar-brand-text">
        <div class="sidebar-app-name">EMS Stock Manager</div>
        <div class="sidebar-app-sub">Medical Inventory System</div>
      </div>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-section-label">เมนูหลัก</div>
      ${navHtml}
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-user" id="user-menu-trigger">
        <div class="sidebar-avatar">${getInitials(user.full_name)}</div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name">${user.full_name}</div>
          <div class="sidebar-user-role">${user.role}</div>
        </div>
        <span class="material-symbols-rounded">more_vert</span>
      </div>
      <button class="sidebar-logout-btn" id="sidebar-logout-btn" title="ออกจากระบบ">
        <span class="material-symbols-rounded">logout</span>
        <span>ออกจากระบบ</span>
      </button>
    </div>
  `;

  // Restore saved location
  const loc = sessionStorage.getItem('ems_location') || '';
  const sel = document.getElementById('location-selector');
  if (sel) {
    sel.value = loc;
    sel.addEventListener('change', () => {
      sessionStorage.setItem('ems_location', sel.value);
      window.dispatchEvent(new CustomEvent('locationChange', { detail: sel.value }));
    });
  }

  // User menu
  document.getElementById('user-menu-trigger')?.addEventListener('click', () => {
    showUserMenu(user);
  });

  // Sidebar logout button
  document.getElementById('sidebar-logout-btn')?.addEventListener('click', () => {
    confirmLogout();
  });
}

function showUserMenu(user) {
  const existing = document.getElementById('user-context-menu');
  if (existing) { existing.remove(); return; }

  const menu = document.createElement('div');
  menu.id = 'user-context-menu';
  menu.style.cssText = `
    position:fixed; bottom:90px; left:12px; width:236px;
    background:white; border:1px solid var(--border-light);
    border-radius:var(--radius-lg); box-shadow:var(--shadow-xl);
    z-index:var(--z-dropdown); overflow:hidden;
    animation: fadeInUp 0.2s ease both;
  `;
  menu.innerHTML = `
    <div style="padding:16px;border-bottom:1px solid var(--border-light);">
      <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${user.full_name}</div>
      <div style="font-size:11px;color:var(--text-muted);">${user.email}</div>
      <span class="badge ${getRoleBadgeClass(user.role)}" style="margin-top:8px;">${user.role}</span>
    </div>
    <div style="padding:6px 0;">
      ${user.role === 'Administrator' ? `
      <div class="dropdown-item" onclick="window.location.href='settings.html'">
        <span class="material-symbols-rounded">settings</span> ตั้งค่า
      </div>
      ` : ''}
      <div class="dropdown-item danger" id="logout-btn">
        <span class="material-symbols-rounded">logout</span> ออกจากระบบ
      </div>
    </div>
  `;
  document.body.appendChild(menu);

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    menu.remove();
    confirmLogout();
  });

  setTimeout(() => {
    document.addEventListener('click', () => menu.remove(), { once: true });
  }, 100);
}

/* ── Logout confirm dialog ── */
function confirmLogout() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = 'logout-modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal-sm anim-scale-in" style="overflow:visible;">
      <div class="modal-header" style="border-bottom:none;padding-bottom:0;">
        <div class="modal-icon" style="background:rgba(198,40,40,.12);width:52px;height:52px;">
          <span class="material-symbols-rounded" style="color:var(--color-danger);font-size:28px;">logout</span>
        </div>
      </div>
      <div class="modal-body" style="padding-top:12px;text-align:center;">
        <div style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:8px;">ออกจากระบบ?</div>
        <div style="font-size:13px;color:var(--text-muted);line-height:1.6;">คุณต้องการออกจากระบบใช่หรือไม่?<br>ข้อมูลที่ยังไม่ได้บันทึกอาจสูญหาย</div>
      </div>
      <div class="modal-footer" style="justify-content:center;gap:12px;background:transparent;border-top:1px solid var(--border-light);">
        <button class="btn btn-secondary" id="logout-cancel-btn" style="min-width:100px;">ยกเลิก</button>
        <button class="btn btn-danger"    id="logout-confirm-btn" style="min-width:100px;">
          <span class="material-symbols-rounded" style="font-size:16px;">logout</span>
          ออกจากระบบ
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#logout-cancel-btn').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#logout-confirm-btn').addEventListener('click', () => {
    overlay.remove();
    logout();
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

/* ── Render topbar ── */
function renderTopbar(title, subtitle) {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;

  topbar.innerHTML = `
    <button class="topbar-burger" id="burger-btn" aria-label="Toggle Menu">
      <span class="material-symbols-rounded">menu</span>
    </button>
    ${PAGE !== 'dashboard' ? `
    <button class="topbar-icon-btn" onclick="window.history.back()" title="ย้อนกลับ" style="margin-right:8px;">
      <span class="material-symbols-rounded">arrow_back</span>
    </button>
    ` : ''}
    <div class="topbar-title">
      ${title}
      ${subtitle ? `<span class="topbar-subtitle" style="margin-left:8px;font-size:13px;font-weight:400;">— ${subtitle}</span>` : ''}
    </div>
    <div class="topbar-actions">
      <div style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--neutral-100);border-radius:var(--radius-full);font-size:12px;color:var(--text-muted);">
        <span class="live-dot"><span class="live-dot-inner"></span></span>
        <span style="margin-left:6px;">${navigator.onLine ? 'ออนไลน์' : 'ออฟไลน์'}</span>
      </div>
      <div class="dropdown" id="notif-dropdown">
        <button class="topbar-icon-btn" id="notif-btn" aria-label="Notifications" style="position:relative;">
          <span class="material-symbols-rounded">notifications</span>
          <span class="notif-count" id="notif-badge" style="display:none;">0</span>
        </button>
        <div class="dropdown-menu" id="notif-panel" style="min-width:320px;right:0;"></div>
      </div>
    </div>
  `;

  // Burger
  document.getElementById('burger-btn')?.addEventListener('click', toggleMobileSidebar);

  // Notifications dropdown
  document.getElementById('notif-btn')?.addEventListener('click', async e => {
    e.stopPropagation();
    const dd = document.getElementById('notif-dropdown');
    dd.classList.toggle('open');
    if (dd.classList.contains('open')) {
      await renderNotifDropdown();
    }
  });

  document.addEventListener('click', () => {
    document.getElementById('notif-dropdown')?.classList.remove('open');
  });
}

/* ── Mobile sidebar toggle ── */
function toggleMobileSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  sidebar?.classList.toggle('mobile-open');
  overlay?.classList.toggle('active');
}

/* ── Main init ── */
export async function initApp(pageTitle, pageSubtitle) {
  // Theme check
  if (localStorage.getItem('ems_theme') === 'dark') {
    document.body.classList.add('dark-theme');
  }

  // Auth check
  if (!authGuard()) return;

  const user = getCurrentUser();

  const loader = document.getElementById('page-loader');

  // Hide loader immediately — everything loads in background
  if (loader) {
    setTimeout(() => loader.classList.add('hidden'), 500);
  }

  // Render shell immediately with 0 low stock (will update in background)
  renderSidebar(user, 0);
  renderTopbar(pageTitle, pageSubtitle);

  // If in Demo Mode, show a beautiful banner warning at the top of page-content
  if (isDemoMode()) {
    const mainEl = document.querySelector('main.page-content');
    if (mainEl) {
      const banner = document.createElement('div');
      banner.id = 'demo-mode-banner';
      banner.style.cssText = `
        background: linear-gradient(135deg, var(--primary-700, #1565C0), var(--primary-900, #0D47A1));
        color: white;
        padding: 14px 20px;
        font-size: 13px;
        border-radius: var(--radius-lg, 12px);
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 4px 16px rgba(21, 101, 192, 0.15);
        gap: 16px;
        flex-wrap: wrap;
        z-index: 10;
        position: relative;
      `;
      banner.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:280px;">
          <span class="material-symbols-rounded" style="color:#90CAF9;font-size:24px;">explore</span>
          <div style="line-height:1.5; text-align: left;">
            <strong style="font-size:14px;display:block;margin-bottom:2px;">โหมดทดลองใช้งาน (Demo Mode)</strong>
            <span>คุณสามารถทดลอง รับเข้า จ่ายออก ดูคลังและแดชบอร์ดได้ ข้อมูลทั้งหมดจะถูกจำลองและบันทึกในเบราว์เซอร์ของคุณเท่านั้น (ไม่ส่งผลกระทบต่อระบบหลัก)</span>
          </div>
        </div>
        <button id="exit-demo-btn" 
                style="background:rgba(255,255,255,0.15);color:white;border:none;border-radius:var(--radius-md, 8px);padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all 0.2s;font-family:inherit;"
                onmouseover="this.style.background='rgba(255,255,255,0.25)'"
                onmouseout="this.style.background='rgba(255,255,255,0.15)'">
          <span class="material-symbols-rounded" style="font-size:16px;">logout</span>ออกจากโหมดเดโม
        </button>
      `;
      mainEl.insertBefore(banner, mainEl.firstChild);
      
      banner.querySelector('#exit-demo-btn').addEventListener('click', () => {
        logout();
      });
    }
  }

  // All Firebase operations run in background — never block UI
  (async () => {
    try {
      await seedDatabase();
    } catch (e) {
      console.warn('seedDatabase:', e.message);
    }
    try {
      await updateNotifBadge();
    } catch (e) {
      console.warn('updateNotifBadge:', e.message);
    }
    try {
      await checkLowStockAlerts();
    } catch (e) {
      console.warn('checkLowStockAlerts:', e.message);
    }
    // Refresh sidebar badge after data loads
    try {
      const lowItems = await getLowStockItems();
      const badge = document.querySelector('.nav-item[id="nav-inventory"] .nav-badge');
      if (lowItems.length > 0 && !badge) {
        const navInv = document.getElementById('nav-inventory');
        if (navInv) {
          const b = document.createElement('span');
          b.className = 'nav-badge';
          b.textContent = lowItems.length;
          navInv.appendChild(b);
        }
      }
    } catch (e) {
      console.warn('getLowStockItems:', e.message);
    }
  })();

  // Auto sync
  initAutoSync();

  // Register SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('../sw.js').catch(() => {});
  }

  // Online/offline indicator
  const onlineIndicator = () => {
    const el = document.querySelector('.live-dot-inner');
    if (el) {
      el.style.background = navigator.onLine ? 'var(--color-success)' : 'var(--color-danger)';
    }
  };
  window.addEventListener('online',  onlineIndicator);
  window.addEventListener('offline', onlineIndicator);

  return user;
}

/* ── Confirm dialog helper ── */
export function confirmDialog(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.innerHTML = `
    <div class="modal modal-sm anim-scale-in">
      <div class="modal-header">
        <div class="modal-icon" style="background:var(--color-danger-light);">
          <span class="material-symbols-rounded" style="color:var(--color-danger);">warning</span>
        </div>
        <div class="modal-title">ยืนยันการดำเนินการ</div>
      </div>
      <div class="modal-body">
        <p style="font-size:14px;color:var(--text-secondary);line-height:1.6;">${message}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="confirm-cancel">ยกเลิก</button>
        <button class="btn btn-danger"    id="confirm-ok">ยืนยัน</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#confirm-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#confirm-ok').addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

/* ── Format number with commas ── */
export function formatNumber(n) {
  return (n || 0).toLocaleString('th-TH');
}

/* ── Get current location filter ── */
export function getCurrentLocation() {
  return 'EMS';
}

/* ── Export to Excel via SheetJS ── */
export function exportToExcel(data, filename, sheetName = 'Sheet1') {
  if (!window.XLSX) { toast.error('ไม่สามารถส่งออกได้', 'ไม่พบ XLSX library'); return; }
  const ws  = XLSX.utils.json_to_sheet(data);
  const wb  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
  toast.success('ส่งออกสำเร็จ', `บันทึกไฟล์ ${filename}`);
}

/* ── Render styled location badge with modern graphics icon ── */
export function getLocationBadge(location) {
  if (!location) return '';
  let icon = 'location_on';
  let color = 'var(--text-secondary)';
  let bg = 'var(--neutral-100)';
  
  if (location === 'ห้องเก็บของ EMS') {
    icon = 'warehouse';
    color = '#0066cc';
    bg = 'rgba(0, 102, 204, 0.08)';
  } else if (location === 'บ้านเมิร์ส') {
    icon = 'home_pin';
    color = '#1b5e20';
    bg = 'rgba(27, 94, 32, 0.08)';
  } else {
    icon = 'location_on';
    color = '#b71c1c';
    bg = 'rgba(183, 28, 28, 0.08)';
  }
  
  return `
    <span style="display:inline-flex;align-items:center;gap:5px;background-color:${bg};color:${color};padding:4px 8px;font-size:11px;font-weight:600;border-radius:6px;border:1px solid rgba(0,0,0,0.02);vertical-align:middle;white-space:nowrap;">
      <span class="material-symbols-rounded" style="font-size:14px;display:block;">${icon}</span>
      ${location}
    </span>
  `;
}
