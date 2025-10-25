'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import CryptoJS from 'crypto-js';

export default function LoginPage() {
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Si ya hay sesión, ir directo al menú
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('auth') === 'ok') {
      router.replace('/menu');
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      setMsg('Ingresa la clave.');
      return;
    }

    try {
      setLoading(true);
      setMsg('Verificando...');

      const hash = CryptoJS.SHA256(password.trim()).toString(CryptoJS.enc.Hex);
      const { data, error } = await supabase.rpc('check_password', { p_hash: hash });

      if (error) {
        setMsg('Error de conexión');
        return;
      }

      if (data === true) {
        localStorage.setItem('auth', 'ok');
        setMsg('✅ Acceso concedido');
        router.push('/menu');
      } else {
        setMsg('❌ Clave incorrecta');
      }
    } catch (err: any) {
      setMsg(`Error: ${err?.message || 'desconocido'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">Acceso a la aplicación</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              placeholder="Ingresa la clave"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border w-full p-3 rounded-lg text-center outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
              autoComplete="current-password"
              aria-label="Clave de acceso"
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700 px-2"
              aria-label={show ? 'Ocultar clave' : 'Mostrar clave'}
            >
              {show ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg font-semibold text-white transition
              ${loading ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
          >
            {loading ? 'Verificando…' : 'Entrar'}
          </button>
        </form>

        {msg && (
          <p
            className={`mt-4 text-sm ${
              msg.startsWith('✅') ? 'text-green-700' :
              msg.startsWith('❌') ? 'text-red-600' : 'text-gray-700'
            }`}
          >
            {msg}
          </p>
        )}
      </div>
    </main>
  );
}


