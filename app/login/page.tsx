// app/login/page.tsx
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

const AFTER_LOGIN = '/menu';
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

  // login por clave única
  const [clave, setClave] = useState('');
  const [showClave, setShowClave] = useState(false);

  // login por usuario/pin
  const [tel, setTel] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // estados para CREAR USUARIO
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newTel, setNewTel] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newRol, setNewRol] = useState<'ADMIN' | 'USER'>('USER');
  const [adminClave, setAdminClave] = useState('');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);

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

      // acceso total
      saveSession({ mode: 'clave', display: 'CLAVE', rol: 'ADMIN' });
      router.replace(AFTER_LOGIN);
    } catch (e: any) {
      const msg =
        e?.message ||
        e?.error_description ||
        (typeof e === 'string' ? e : null) ||
        'Error de conexión';
      setErr(msg);
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

      let ok: UsuarioLoginOK | null = null;
      let rpcErr: any = null;

      // 1) Intentar RPC
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

      // 2) Fallback a SELECT directo sobre columna pin_hash
      if (!ok) {
        const { data: rows, error: selErr } = await supabase
          .from('usuario')
          .select('id, nombre, rol, telefono, pin_hash, activo')
          .eq('telefono', telefono)
          .eq('pin_hash', pin)
          .eq('activo', true)
          .limit(1);

        if (selErr) {
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

  // crear usuario (solo admin con clave única)
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateErr(null);
    setCreateOk(null);

    try {
      setCreating(true);

      const telefono = normalizeTel(newTel);
      if (telefono.length < 8) throw new Error('Teléfono inválido (8-9 dígitos CL).');
      if (!newNombre.trim()) throw new Error('Ingresa un nombre para el usuario.');
      if (!newPin.trim()) throw new Error('Ingresa un PIN.');
      if (!adminClave.trim()) throw new Error('Ingresa la clave ADMIN para crear usuarios.');

      // validar clave admin
      const { data, error } = await supabase
        .from('app_settings')
        .select('valor')
        .eq('clave', 'app_password')
        .maybeSingle();

      if (error) throw error;

      const valor = String(data?.valor ?? '');
      if (!valor || adminClave.trim() !== valor) {
        throw new Error('Clave ADMIN incorrecta.');
      }

      // insertar en columna pin_hash (no existe columna pin)
      const { error: insErr } = await supabase.from('usuario').insert({
        telefono,
        nombre: newNombre.trim(),
        rol: newRol,
        pin_hash: newPin.trim(),
        activo: true,
      });

      if (insErr) throw insErr;

      setCreateOk('Usuario creado correctamente ✅');
      setNewTel('');
      setNewNombre('');
      setNewPin('');
      setNewRol('USER');
      setAdminClave('');
    } catch (e: any) {
      const msg =
        e?.message ||
        e?.error_description ||
        (typeof e === 'string' ? e : null) ||
        'No se pudo crear el usuario';
      setCreateErr(msg);
    } finally {
      setCreating(false);
    }
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

        {/* Form login */}
        <form
          onSubmit={handleSubmit}
          className="grid gap-3"
          autoComplete="off"                {/* 🔒 desactiva autocomplete del form */}
        >
          {mode === 'clave' ? (
            <>
              <div className="relative">
                <input
                  type={showClave ? 'text' : 'password'}
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  placeholder="Clave única…"
                  name="appClave"            /* nombre raro para que el navegador no lo detecte */
                  autoComplete="new-password" /* evita recordar esta clave */
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
                  name="userPin"
                  autoComplete="new-password"   /* también que no lo recuerde */
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

        {/* Error login */}
        {err && (
          <div className="mt-3 rounded-lg bg-rose-100 text-rose-700 px-3 py-2 text-sm text-center">
            {err}
          </div>
        )}

        {/* Pie login */}
        <div className="mt-4 text-center text-xs text-slate-500">
          {mode === 'clave'
            ? 'Ingresa la clave única configurada en app_settings.'
            : 'Ingresa tu teléfono y PIN de usuario.'}
        </div>

        {/* Crear usuario (solo admin) */}
        <div className="mt-5 border-t pt-3 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => setShowCreateUser((s) => !s)}
            className="mx-auto mb-2 block text-violet-700 hover:text-violet-900 font-semibold"
          >
            {showCreateUser ? '▲ Ocultar creación de usuario' : '＋ Crear usuario (solo admin)'}
          </button>

          {showCreateUser && (
            <form
              onSubmit={handleCreateUser}
              className="grid gap-2 text-left text-xs"
              autoComplete="off"  /* tampoco queremos que recuerde estos datos */
            >
              <div className="grid gap-1">
                <label className="font-semibold">Teléfono usuario</label>
                <input
                  inputMode="tel"
                  value={newTel}
                  onChange={(e) => setNewTel(e.target.value)}
                  placeholder="Ej: 991112233"
                  className="rounded-lg border px-2 py-2 outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>

              <div className="grid gap-1">
                <label className="font-semibold">Nombre</label>
                <input
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value.toUpperCase())}
                  placeholder="Nombre visible en la app"
                  className="rounded-lg border px-2 py-2 outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>

              <div className="grid gap-1">
                <label className="font-semibold">PIN</label>
                <input
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="PIN numérico"
                  name="newUserPin"
                  autoComplete="new-password"
                  className="rounded-lg border px-2 py-2 outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>

              <div className="grid gap-1">
                <label className="font-semibold">Rol</label>
                <select
                  value={newRol}
                  onChange={(e) => setNewRol(e.target.value as 'ADMIN' | 'USER')}
                  className="rounded-lg border px-2 py-2 outline-none focus:ring-2 focus:ring-violet-300"
                >
                  <option value="USER">USER (solo operación)</option>
                  <option value="ADMIN">ADMIN (incluye Finanzas / Config)</option>
                </select>
              </div>

              <div className="grid gap-1">
                <label className="font-semibold">Clave ADMIN (para autorizar)</label>
                <input
                  type="password"
                  value={adminClave}
                  onChange={(e) => setAdminClave(e.target.value)}
                  placeholder="Misma clave única de la app"
                  name="adminAppKey"
                  autoComplete="new-password"
                  className="rounded-lg border px-2 py-2 outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 font-semibold disabled:opacity-60"
              >
                {creating ? <Loader2 className="animate-spin" size={14} /> : null}
                Crear usuario
              </button>

              {createErr && (
                <div className="mt-1 rounded-lg bg-rose-100 text-rose-700 px-2 py-1 text-[11px]">
                  {createErr}
                </div>
              )}
              {createOk && (
                <div className="mt-1 rounded-lg bg-emerald-100 text-emerald-700 px-2 py-1 text-[11px]">
                  {createOk}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
