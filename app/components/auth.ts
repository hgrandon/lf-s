'use client';

export const AUTH_KEY = 'auth';

// Si quieres abrir todo temporalmente para DEV, ponlo en true.
// En producción debe ser false.
export const DEV_OPEN = false;

export function isAuth(): boolean {
  if (DEV_OPEN) return true;
  if (typeof window === 'undefined') return false;
  const v = localStorage.getItem(AUTH_KEY);
  return v === 'ok' || v === '1';
}

export function setAuth(v: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_KEY, v ? '1' : '');
}

export function clearAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_KEY);
}
