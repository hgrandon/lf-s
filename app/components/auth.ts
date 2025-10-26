'use client';

export const AUTH_KEY = 'auth';

/**
 * Modo abierto temporal:
 *  - true  -> NO pide clave (siempre deja pasar)
 *  - false -> pide clave (comportamiento normal)
 */
export const DEV_OPEN = true;

export function isAuth(): boolean {
  if (DEV_OPEN) return true; // <-- deja pasar todo mientras esté activo
  if (typeof window === 'undefined') return false;
  const v = localStorage.getItem(AUTH_KEY);
  return v === 'ok' || v === '1';
}

export function setAuth(v: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_KEY, v ? 'ok' : '');
}

export function clearAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_KEY);
}
