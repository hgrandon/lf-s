'use client';

import { Suspense } from 'react';
import DesgloseContenido from './contenido';

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6">Cargando desglose…</p>}>
      <DesgloseContenido />
    </Suspense>
  );
}
