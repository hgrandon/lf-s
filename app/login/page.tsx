'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// Hash SHA-256 nativo (hex)
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
    try {
      setLoading(true);
      setMessage('Verificando...');
      const hash = await sha256Hex(password);

      const { data, error } = await supabase.rpc('check_password', { p_hash: hash });

      if (error) {
        setMessage('Error de conexión');
        return;
      }

        if (data === true) {
            setMessage('✅ Acceso concedido');
            localStorage.setItem('access_ok', '1');
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
    <main className="flex h-screen items-center justify-center bg-gray-100">
      <div className="bg-white shadow-lg rounded-xl p-8 w-80 text-center">
        <h1 className="text-xl font-bold mb-4 text-gray-800">Acceso a la aplicación</h1>

        <input
          type="password"
          placeholder="Ingresa la clave"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={onKeyDown}
          className="border w-full p-2 rounded mb-4 text-center"
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className={`${
            loading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-purple-700'
          } bg-purple-600 text-white py-2 px-4 rounded w-full`}
        >
          {loading ? 'Verificando...' : 'Entrar'}
        </button>

        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
      </div>
    </main>
  );
}


