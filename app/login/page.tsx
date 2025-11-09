'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Lock, User2 } from 'lucide-react';

type AuthMode = 'clave' | 'usuario';

type UsuarioLoginOK = {
  id: string;
  nombre: string;
  rol: 'ADMIN' | 'OPERADOR' | string;
};

function saveSession(payload: {
  mode: AuthMode;
  display: string; // nombre o "CLAVE"
  rol?: string | null;
}) {
  const session = {
    ...payload,
    ts: Date.now(),
  };
  try {
    localStorage.setItem('lf_auth', JSON.stringify(session));
  } catch {}
}

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>('clave');

  // clave única
  const [clave, setClave] = useState('');
  // usuario/pin
  const [tel, setTel] = useState('');
  const [pin, setPin] = useState('');

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // si ya hay sesión, entra directo
    try {
      const raw = localStorage.getItem('lf_auth');
      if (raw) router.replace('/base');
    } catch {}
  }, [router]);

  async function loginClave() {
    setLoading(true);
    setErr(null);
    try {
      // lee clave única
      const { data, error } = await supabase
        .from('app_settings')
        .select('valor')
        .eq('clave', 'app_password')
        .maybeSingle();

      if (error) throw error;
      const valor = String(data?.valor ?? '');
      if (!valor) throw new Error('Clave no configurada');

      if (clave.trim() !== valor) {
        throw new Error('Clave incorrecta');
      }

      saveSession({ mode: 'clave', display: 'CLAVE', rol: 'ADMIN' }); // puedes asumir ADMIN para clave global
      router.replace('/base');
    } catch (e: any) {
      setErr(e?.message ?? 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  async function loginUsuario() {
    setLoading(true);
    setErr(null);
    try {
      const telefono = (tel || '').replace(/\D/g, '');
      if (telefono.length < 8) throw new Error('Ingresa un teléfono válido');
      if (!pin) throw new Error('Ingresa tu PIN');

      // RPC seguro en BD
      const { data, error } = await supabase.rpc('usuario_login', {
        p_telefono: telefono,
        p_pin: String(pin),
      });

      if (error) throw error;
      const ok = (data?.[0] as UsuarioLoginOK | undefined) || null;
      if (!ok) throw new Error('Teléfono o PIN incorrecto');

      saveSession({
        mode: 'usuario',
        display: ok.nombre || telefono,
        rol: ok.rol || null,
      });
      router.replace('/base');
    } catch (e: any) {
      setErr(e?.message ?? 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'clave') loginClave();
    else loginUsuario();
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 grid place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white/95 shadow-2xl p-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-1 mb-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 grid place-items-center text-white font-black">
            LF
          </div>
          <div className="text-sm text-slate-500">Acceso a la aplicación</div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 mb-4">
          <button
            type="button"
            onClick={() => setMode('clave')}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm transition ${
              mode === 'clave' ? 'bg-white shadow font-semibold' : 'text-slate-600'
            }`}
          >
            <Lock size={16} />
            Clave
          </button>
          <button
            type="button"
            onClick={() => setMode('usuario')}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm transition ${
              mode === 'usuario' ? 'bg-white shadow font-semibold' : 'text-slate-600'
            }`}
          >
            <User2 size={16} />
            Usuario
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="grid gap-3">
          {mode === 'clave' ? (
            <>
              <input
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="Clave única…"
                className="w-full rounded-xl border px-3 py-3 outline-none focus:ring-2 focus:ring-violet-300"
                autoFocus
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-3 font-semibold disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                Entrar
              </button>
            </>
          ) : (
            <>
              <input
                inputMode="tel"
                autoComplete="tel"
                value={tel}
                onChange={(e) => setTel(e.target.value.replace(/\D/g, ''))}
                placeholder="Teléfono"
                className="w-full rounded-xl border px-3 py-3 outline-none focus:ring-2 focus:ring-violet-300"
                autoFocus
              />
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN"
                className="w-full rounded-xl border px-3 py-3 outline-none focus:ring-2 focus:ring-violet-300"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-3 font-semibold disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                Entrar
              </button>
            </>
          )}
        </form>

        {/* Error */}
        {err && (
          <div className="mt-3 rounded-lg bg-rose-100 text-rose-700 px-3 py-2 text-sm text-center">
            {err}
          </div>
        )}

        {/* Pie */}
        <div className="mt-4 text-center text-xs text-slate-500">
          {mode === 'clave'
            ? 'Ingresa la clave única configurada en app_settings.'
            : 'Ingresa tu teléfono y PIN de usuario.'}
        </div>
      </div>
    </main>
  );
}
