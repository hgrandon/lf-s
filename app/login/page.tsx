'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import { setAuth } from '@/app/components/auth';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const raw = password.trim();
    if (!raw) {
      setMessage('Ingresa la clave.');
      return;
    }

    try {
      setLoading(true);
      setMessage('Verificando…');

      const hash = await sha256Hex(raw);
      const { data, error } = await supabase.rpc('check_password', { p_hash: hash });

      if (error) {
        setMessage('Error de conexión');
        return;
      }
      if (data === true) {
        setAuth(true);              // <<--- aquí la magia
        setMessage('✅ Acceso concedido');
        router.replace('/menu');
      } else {
        setMessage('❌ Clave incorrecta');
      }
    } catch (e: any) {
      setMessage(`Error: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) handleLogin();
  };

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />
      <div className="relative z-10 grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
          <div className="mb-5 grid place-items-center">
            <Image src="/logo.png" alt="Logo" width={56} height={56} className="h-14 w-14 object-contain" />
          </div>

          <h1 className="mb-4 text-lg font-semibold text-gray-800">Acceso a la aplicación</h1>

          <input
            type="password"
            placeholder="Ingresa la clave"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKeyDown}
            className="mb-4 w-full rounded border px-3 py-2 text-center outline-none focus:ring-2 focus:ring-purple-500"
          />

          <button
            onClick={handleLogin}
            disabled={loading}
            className={`w-full rounded bg-purple-600 py-2 font-semibold text-white transition ${
              loading ? 'cursor-not-allowed opacity-60' : 'hover:bg-purple-700'
            }`}
          >
            {loading ? 'Verificando…' : 'Entrar'}
          </button>

          {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
        </div>
      </div>
    </main>
  );
}








