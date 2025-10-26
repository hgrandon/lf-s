'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Logo from '@/app/components/Logo';

// Hash SHA-256 nativo → salida hex
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Si ya hay sesión marcada, redirigimos al menú.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ok = localStorage.getItem('access_ok');
      if (ok === '1') router.replace('/menu');
    }
  }, [router]);

  const handleLogin = async () => {
    if (!password || loading) return;

    try {
      setLoading(true);
      setMessage('Verificando…');

      const hash = await sha256Hex(password);

      const { data, error } = await supabase.rpc('check_password', { p_hash: hash });

      if (error) {
        console.error(error);
        setMessage('Error de conexión');
        return;
      }

      if (data === true) {
        setMessage('✅ Acceso concedido');
        localStorage.setItem('access_ok', '1');
        setPassword('');
        router.push('/menu');
      } else {
        setMessage('❌ Clave incorrecta');
      }
    } catch (e: any) {
      console.error(e);
      setMessage(`Error: ${e?.message ?? String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) handleLogin();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm">
        {/* Logo + título */}
        <div className="mb-6 flex flex-col items-center">
          {/* Si quieres ocultar el texto al lado, pásale title="" al Logo */}
          <Logo className="justify-center" />
        </div>

        <div className="rounded-xl bg-white p-6 shadow-lg">
          <h1 className="mb-4 text-center text-xl font-bold text-gray-800">
            Acceso a la aplicación
          </h1>

          <label htmlFor="password" className="sr-only">
            Clave
          </label>
          <input
            id="password"
            type="password"
            placeholder="Ingresa la clave"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            className="mb-4 w-full rounded border p-2 text-center outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
          />

          <button
            onClick={handleLogin}
            disabled={loading || !password}
            className={`w-full rounded bg-purple-600 py-2 text-white transition ${
              loading || !password
                ? 'cursor-not-allowed opacity-60'
                : 'hover:bg-purple-700'
            }`}
          >
            {loading ? 'Verificando…' : 'Entrar'}
          </button>

          {message && (
            <p className="mt-4 text-center text-sm text-gray-700">{message}</p>
          )}
        </div>
      </div>
    </main>
  );
}



