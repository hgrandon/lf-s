'use client'

/**
 * Utilidades simples para manejar el acceso (auth) de la app.
 * Se usa una única clave localStorage llamada 'auth'.
 */

// Marca al usuario como logueado
export function setAuth() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth', '1')
  }
}

// Verifica si el usuario está logueado
export function isAuth(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('auth') === '1'
}

// Limpia la sesión del usuario
export function clearAuth() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth')
  }
}
