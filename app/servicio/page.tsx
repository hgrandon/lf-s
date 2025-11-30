// app/servicio/page.tsx
import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import ServicioComprobanteClient from './ServicioComprobanteClient';

export const metadata: Metadata = {
  title: 'Comprobante de servicio | Lavandería Fabiola',
  description: 'Comprobante visual del pedido para el cliente.',
};

// 👇 themeColor ahora va en viewport (evita el warning)
export const viewport: Viewport = {
  themeColor: '#0f172a',
};

export default function ServicioPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-900 px-3">
          <div className="text-center bg-white rounded-3xl shadow-xl px-6 py-5 border border-violet-100 max-w-md">
            <p className="text-sm text-slate-600">
              Cargando comprobante de servicio…
            </p>
          </div>
        </main>
      }
    >
      <ServicioComprobanteClient />
    </Suspense>
  );
}
