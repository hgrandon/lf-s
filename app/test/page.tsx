'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function TestConn() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'fail'>('loading');
  const [details, setDetails] = useState<string>('');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { count, error } = await supabase
          .from('clientes')
          .select('*', { count: 'exact', head: true });

        if (error) throw error;
        setStatus('ok');
        setDetails(`✅ Conexión correcta. Filas visibles: ${count ?? 0}`);
      } catch (e: any) {
        setStatus('fail');
        setDetails(`❌ Error: ${e.message}`);
      }
    };

    checkConnection();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-center">
      <div className="p-6 bg-white rounded-2xl shadow-md">
        <h1 className="text-2xl font-bold mb-4">Prueba de Conexión Supabase</h1>
        {status === 'loading' && <p>⏳ Verificando conexión...</p>}
        {status === 'ok' && <p className="text-green-600">{details}</p>}
        {status === 'fail' && <p className="text-red-600">{details}</p>}
      </div>
    </main>
  );
}
