'use client';
import type { ReactNode } from 'react';

export default function Protected({ children }: { children: ReactNode }) {
  // Modo abierto temporal: no valida, solo muestra.
  return <>{children}</>;
}