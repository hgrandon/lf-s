'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Lock, User2, Eye, EyeOff } from 'lucide-react';

type AuthMode = 'clave' | 'usuario';

type UsuarioLoginOK = {
  id: string | number;
  nombre: string;
  rol: string | null;
};

const AFTER_LOGIN = '/menu';          // <--- cambia a '/pedido' si prefieres
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function saveSession(payload: { mode: AuthMode; display: string; rol?: string | null }) {
  try {
    localStorage.setItem(
      'lf_auth',
      JSON.stringify({ ...payload, ts: Date.now(), ttl: SESSION_TTL_MS })
    );
  } catch {}
}

function readSession() {
  try {
    const raw = localStorage.getItem('lf_auth');
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.ts || !s?.ttl) return null;
    if (Date.now() - s.ts > s.ttl) {
      localStorage.removeItem('lf_auth');
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function normalizeTel(raw: string) {
  const d = (raw || '').replace(/\D/g, '');
  // quita 56/056 si viene con código país
  return d.replace(/^0?56/, '');
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('clave');

  // clave única
  const [clave, setClave] = useState('');
  const [showClave, setShowClave] = useState(false);

  // usuario/pin
  const [tel, setTel] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // si ya hay sesión válida, entra directo
  useEffect(() => {
    const s = readSession();
    if (s) router.replace(AFTER_LOGIN);
  }, [router]);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (mode === 'clave') return Boolean(clave.trim());
    const telefono = normalizeTel(tel);
    return telefono.length >= 8 && Boolean(pin);
  }, [loading, mode, clave, tel, pin]);

  async function loginClave() {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('valor')
        .eq('clave', 'app_password')
        .maybeSingle();

      if (error) throw error;

      const valor = String(data?.valor ?? '');
      if (!valor) throw new Error('Clave no configurada en app_settings');

      if (clave.trim() !== valor) {
        throw new Error('Clave incorrecta');
      }

      saveSession({ mode: 'clave', display: 'CLAVE', rol: 'ADMIN' });
      router.replace(AFTER_LOGIN);
    } catch (e: any) {
      // mensajes más útiles
      const msg =
        e?.message ||
        e?.error_description ||
        (typeof e === 'string' ? e : null) ||
        'Error de conexión';
      setErr(msg);
      // opcional: log en consola para diagnóstico
      // console.error('loginClave error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function loginUsuario() {
    setLoading(true);
    setErr(null);
    try {
      const telefono = normalizeTel(tel);
      if (telefono.length < 8) throw new Error('Ingresa un teléfono válido (8-9 dígitos CL).');
      if (!pin) throw new Error('Ingresa tu PIN');

      // 1) Intentar RPC
      let ok: UsuarioLoginOK | null = null;
      let rpcErr: any = null;
      try {
        const { data, error } = await supabase.rpc('usuario_login', {
          p_telefono: telefono,
          p_pin: String(pin),
        });
        if (error) rpcErr = error;
        else ok = (data?.[0] as UsuarioLoginOK) ?? null;
      } catch (e) {
        rpcErr = e;
      }

      // 2) Si no existe RPC (o falla con 42883), hacemos Fallback a SELECT directo
      if (!ok) {
        const { data: rows, error: selErr } = await supabase
          .from('usuario')
          .select('id, nombre, rol, telefono, pin, activo')
          .eq('telefono', telefono)
          .eq('pin', pin)
          .eq('activo', true)
          .limit(1);

        if (selErr) {
          // si ambos caminos fallaron, mostramos el error más explicativo
          throw rpcErr || selErr;
        }

        const row = rows?.[0] as any;
        if (!row) throw new Error('Teléfono o PIN incorrecto');

        ok = {
          id: row.id,
          nombre: row.nombre || telefono,
          rol: row.rol ?? null,
        };
      }

      saveSession({
        mode: 'usuario',
        display: ok?.nombre || telefono,
        rol: ok?.rol ?? null,
      });
      router.replace(AFTER_LOGIN);
    } catch (e: any) {
      const msg =
        e?.message ||
        e?.error_description ||
        (typeof e === 'string' ? e : null) ||
        'Error de conexión';
      setErr(msg);
      // console.error('loginUsuario error:', e);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
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
          <div className="text-sm text-slate-500 font-semibold">Acceso a la aplicación</div>
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
              <div className="relative">
                <input
                  type={showClave ? 'text' : 'password'}
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  placeholder="Clave única…"
                  className="w-full rounded-xl border px-3 py-3 pr-10 outline-none focus:ring-2 focus:ring-violet-300"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowClave((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700"
                  aria-label={showClave ? 'Ocultar clave' : 'Mostrar clave'}
                >
                  {showClave ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={!canSubmit}
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
                onChange={(e) => setTel(e.target.value)}
                placeholder="Teléfono"
                className="w-full rounded-xl border px-3 py-3 outline-none focus:ring-2 focus:ring-violet-300"
                autoFocus
              />
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="PIN"
                  className="w-full rounded-xl border px-3 py-3 pr-10 outline-none focus:ring-2 focus:ring-violet-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700"
                  aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={!canSubmit}
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
