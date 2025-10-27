// app/pedido/nuevo/page.tsx
import { Suspense } from 'react';
import NuevoPedido from './NuevoPedido';

export const dynamic = 'force-dynamic'; // evita prerender estático con query params

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Cargando…</div>}>
      <NuevoPedido />
    </Suspense>
  );
}


