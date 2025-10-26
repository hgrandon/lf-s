'use client';

export const AUTH_KEY = 'auth';

export function isAuth(): boolean {
  if (typeof window === 'undefined') return false;
  // Acepta "ok" o "1" por si quedó mezclado antes
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
