/* =========================================================
   EMS Stock Manager — auth.js
   Authentication, session management, role-based access
   ========================================================= */

import { getUserByEmail, getAllUsers, saveUser, dbAdd } from './db.js';


const SESSION_KEY = 'ems_session';

export const ROLES = {
  ADMINISTRATOR: 'Administrator',
  STAFF:         'Staff',
  VIEWER:        'Viewer',
};

export const PERMISSIONS = {
  Administrator: ['add_item','edit_item','delete_item','manage_users','view_reports','export_data','receive_stock','issue_stock','view_inventory','adjust_stock'],
  Staff:         ['receive_stock','issue_stock','view_inventory','view_reports'],
  Viewer:        ['view_inventory'],
};

/* ── Session ── */
export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setSession(user, remember = false) {
  const session = {
    user_id:   user.user_id,
    full_name: user.full_name,
    email:     user.email,
    role:      user.role,
    login_at:  new Date().toISOString(),
  };
  const store = remember ? localStorage : sessionStorage;
  store.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('ems_demo_mode');
  localStorage.removeItem('ems_demo_mode');
}

export function isLoggedIn() {
  return getSession() !== null;
}

export function getCurrentUser() {
  return getSession();
}

export function hasPermission(action) {
  const user = getSession();
  if (!user) return false;
  const perms = PERMISSIONS[user.role] || [];
  return perms.includes(action);
}

export function requireRole(...roles) {
  const user = getSession();
  if (!user) return false;
  return roles.includes(user.role);
}

/* ── Login / Logout ── */
export async function login(email, password, remember = false) {
  const user = await getUserByEmail(email.trim().toLowerCase());
  if (!user) throw new Error('ไม่พบบัญชีผู้ใช้นี้ในระบบ');
  if (!user.active) throw new Error('บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
  if (user.password !== password) throw new Error('รหัสผ่านไม่ถูกต้อง');

  // Log login
  await dbAdd('transactions', {
    datetime:               new Date().toISOString(),
    item_id:                null,
    barcode:                null,
    transaction_type:       'Login',
    quantity:               null,
    balance_after_transaction: null,
    remarks:                `เข้าสู่ระบบจาก ${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}`,
    user_name:              user.full_name,
  }).catch(() => {});

  return setSession(user, remember);
}

export function loginDemo(role = 'Administrator', remember = false) {
  const user = {
    user_id:   'demo_user',
    full_name: 'ผู้ทดลองใช้งาน (Demo User)',
    email:     'demo@ems.local',
    role:      role,
  };
  sessionStorage.setItem('ems_demo_mode', 'true');
  if (remember) {
    localStorage.setItem('ems_demo_mode', 'true');
  }
  return setSession(user, remember);
}

export async function logout() {
  const user = getSession();
  if (user) {
    await dbAdd('transactions', {
      datetime:               new Date().toISOString(),
      item_id:                null,
      barcode:                null,
      transaction_type:       'Logout',
      quantity:               null,
      balance_after_transaction: null,
      remarks:                `ออกจากระบบ`,
      user_name:              user.full_name,
    }).catch(() => {});
  }
  clearSession();
  window.location.href = '../index.html';
}

/* ── Auth Guard ── */
export function authGuard() {
  if (!isLoggedIn()) {
    const base = window.location.pathname.includes('/pages/') ? '../' : '';
    window.location.href = base + 'index.html';
    return false;
  }
  return true;
}

/* ── Role display helpers ── */
export function getRoleBadgeClass(role) {
  const map = {
    'Administrator': 'badge-primary',
    'Staff':         'badge-success',
    'Viewer':        'badge-neutral',
  };
  return map[role] || 'badge-neutral';
}

export function getRoleIcon(role) {
  const map = {
    'Administrator': 'admin_panel_settings',
    'Staff':         'badge',
    'Viewer':        'visibility',
  };
  return map[role] || 'person';
}

export function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
