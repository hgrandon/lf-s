'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';

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
    <main className="flex h-screen items-center justify-center bg-white relative overflow-hidden">
      {/* Degradado suave rosado-violeta */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-200 via-purple-200 to-white opacity-60 blur-3xl" />

      {/* Contenedor central */}
      <div className="relative bg-white shadow-lg rounded-2xl p-8 w-80 text-center border border-gray-200 z-10">
        {/* Logo arriba */}
        <div className="flex justify-center mb-4">
          <Image
            src="/logo.png"
            alt="Logo Lavandería"
            width={64}
            height={64}
            className="object-contain"
            priority
          />
        </div>

        <h1 className="text-lg font-bold mb-4 text-gray-800">
          Acceso a la aplicación
        </h1>

        <input
          type="password"
          placeholder="Ingresa la clave"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={onKeyDown}
          className="border border-gray-300 w-full p-2 rounded mb-4 text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className={`${
            loading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-purple-700'
          } bg-purple-600 text-white py-2 px-4 rounded w-full transition-colors duration-200`}
        >
          {loading ? 'Verificando...' : 'Entrar'}
        </button>

        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
      </div>
    </main>
  );
}



