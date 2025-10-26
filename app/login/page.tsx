'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Logo from '@/app/components/Logo';

// Función hash SHA-256 (igual que antes)
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!password.trim()) {
      setMessage('⚠️ Ingresa la clave para continuar');
      return;
    }

    try {
      setLoading(true);
      setMessage('Verificando...');
      const hash = await sha256Hex(password);

      const { data, error } = await supabase.rpc('check_password', { p_hash: hash });
      if (error) {
        setMessage('Error de conexión con el servidor');
        return;
      }

      if (data === true) {
        setMessage('✅ Acceso concedido');
        localStorage.setItem('auth', 'ok');
        router.push('/menu');
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
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />

      <div className="relative z-10 bg-white/90 backdrop-blur-sm shadow-2xl rounded-2xl p-8 w-80 text-center">
        {/* Logo con fondo blanco y texto debajo */}
        <div className="flex justify-center mb-4">
          <div className="bg-white rounded-full shadow-md p-3">
            <Logo size={60} />
          </div>
        </div>

        <h1 className="text-xl font-bold mb-4 text-gray-800">Acceso a la aplicación</h1>

        <input
          type="password"
          placeholder="Ingresa la clave"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={onKeyDown}
          className="border w-full p-2 rounded mb-4 text-center outline-none focus:ring-2 focus:ring-fuchsia-500"
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className={`w-full py-2 rounded text-white font-semibold transition ${
            loading
              ? 'bg-purple-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-fuchsia-700'
          }`}
        >
          {loading ? 'Verificando...' : 'Entrar'}
        </button>

        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
      </div>
    </main>
  );
}





