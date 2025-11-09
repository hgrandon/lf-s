import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AFTER_LOGIN = '/base'; // mismo destino que en el login
const PUBLIC_PATHS = [
  '/login',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons',        // si usas /icons/* para PWA
  '/_next',        // assets de Next
  '/assets',       // si tienes carpeta pública
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // lee "sesión ligera" desde cookie de fallback cuando exista, o desde un header custom
  // pero como guardamos en localStorage, haremos una comprobación por query param opcional:
  // truco: dejamos públicas las rutas estáticas y login. Las demás requieren sesión en cliente.
  // Para una protección 100% server-side, deberías emitir una cookie al iniciar sesión.

  // Permitir las rutas públicas
  if (isPublic(pathname)) return NextResponse.next();

  // Si es /login y ya hay sesión en localStorage no se puede saber en middleware (server).
  // Opción: permitir /login siempre y en el cliente redirigir si hay sesión.
  // Aún así, dejamos esta lógica por si en el futuro usas cookie:
  const hasCookie = req.cookies.has('lf_auth'); // si en futuro guardas cookie
  if (pathname === '/login' && hasCookie) {
    return NextResponse.redirect(new URL(AFTER_LOGIN, req.url));
  }

  // Para las privadas, continuamos; la app hará el check en cliente (localStorage) y redirigirá.
  return NextResponse.next();
}

// Aplica a todas las rutas
export const config = {
  matcher: ['/((?!api).*)'], // todas menos /api
};
