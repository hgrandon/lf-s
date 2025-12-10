// app/base/guardado/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Truck, Archive, Loader2 } from 'lucide-react';

export default function GuardadoMenuPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [localCount, setLocalCount] = useState(0);
  const [domCount, setDomCount] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // GUARDADO LOCAL: tipo_entrega NULL o LOCAL
      const { data: localRows } = await supabase
        .from('pedido')
        .select('nro')
        .eq('estado', 'GUARDADO')
        .or('tipo_entrega.is.null,tipo_entrega.eq.LOCAL');

      // GUARDADO DOMICILIO
      const { data: domRows } = await supabase
        .from('pedido')
        .select('nro')
        .eq('estado', 'GUARDADO')
        .eq('tipo_entrega', 'DOMICILIO');

      setLocalCount(localRows?.length ?? 0);
      setDomCount(domRows?.length ?? 0);
      setLoading(false);
    })();
  }, []);

  function go(where: 'local' | 'domicilio') {
    router.push(`/base/guardado/${where}`);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white pb-20">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-20 bg-gradient-to-r from-violet-800/95 via-fuchsia-700/95 to-indigo-800/95 backdrop-blur-md px-6 py-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-lg">Guardado</h1>
          <button
            onClick={() => router.push('/base')}
            className="text-white/90 hover:text-white text-sm"
          >
            ← Volver
          </button>
        </div>
      </header>

      {/* Menú Tarjetas */}
      <section className="pt-24 px-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* LOCAL */}
        <button
          onClick={() => go('local')}
          className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md shadow-xl
                     p-6 flex flex-col items-center gap-3 hover:bg-white/20 transition"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={24} />
          ) : (
            <>
              <div className="flex items-center gap-4">
                <span className="text-4xl lg:text-5xl font-black leading-none">
                  {localCount}
                </span>
                <Archive size={48} />
              </div>
              <span className="mt-2 font-bold text-lg tracking-wide">
                LOCAL
              </span>
            </>
          )}
        </button>

        {/* DOMICILIO */}
        <button
          onClick={() => go('domicilio')}
          className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md shadow-xl
                     p-6 flex flex-col items-center gap-3 hover:bg-white/20 transition"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={24} />
          ) : (
            <>
              <div className="flex items-center gap-4">
                <span className="text-4xl lg:text-5xl font-black leading-none">
                  {domCount}
                </span>
                <Truck size={48} />
              </div>
              <span className="mt-2 font-bold text-lg tracking-wide">
                DOMICILIO
              </span>
            </>
          )}
        </button>
      </section>
    </main>
  );
}
