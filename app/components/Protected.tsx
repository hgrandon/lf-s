'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuth, DEV_OPEN } from '@/app/components/auth';

/**
 * Componente de protección de rutas.
 * 
 * - Si DEV_OPEN está en true (modo desarrollo), muestra todo sin validar.
 * - Si está en false, valida que exista sesión (localStorage.auth).
 * - Redirige automáticamente al /login si el usuario no está autenticado.
 */
export default function Protected({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (DEV_OPEN) return; // modo libre activo
    if (!isAuth()) {
      router.replace('/login');
    }
  }, [router]);

  return <>{children}</>;
}
