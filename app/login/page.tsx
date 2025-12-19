// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Eye, EyeOff, Phone, Lock, LogIn } from 'lucide-react';
import Image from 'next/image';
import { compare } from 'bcryptjs';

/* =========================
   Tipos de sesión (UUD)
========================= */

type AuthMode = 'clave' | 'usuario';

type LfSession = {
  mode: AuthMode;      // siempre 'usuario' para este login
  display: string;     // nombre visible (FABIOLA, MAURICIO, etc.)
  rol?: string | null; // ADMIN / USER
  ts: number;          // timestamp creación sesión
  ttl: number;         // tiempo de vida en ms (ej: 12 horas)
};

/* =========================
   Componente Login
========================= */

export default function LoginPage() {
  const router = useRouter();

  const [telefono, setTelefono] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const telDigits = telefono.replace(/\D/g, '');

    if (telDigits.length < 8) {
      setErrorMsg('Ingresa un teléfono válido (al menos 8 dígitos).');
      return;
    }

    if (!pin.trim()) {
      setErrorMsg('Ingresa tu clave / PIN.');
      return;
    }

    try {
      setLoading(true);

      // 1) Buscar usuario por teléfono
      const { data, error } = await supabase
        .from('usuario')
        .select('id,nombre,telefono,rol,activo,pin_hash')
        .eq('telefono', telDigits)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setErrorMsg('No existe un usuario con ese teléfono.');
        return;
      }

      if (!data.activo) {
        setErrorMsg('Este usuario está inactivo. Consulta con el administrador.');
        return;
      }

      // 2) Validar PIN con bcryptjs
      const hash: string | null = data.pin_hash ?? null;
      if (!hash) {
        setErrorMsg('Este usuario no tiene clave configurada. Pide que te asignen una.');
        return;
      }

      const ok = await compare(pin, hash);
      if (!ok) {
        setErrorMsg('Clave incorrecta. Intenta nuevamente.');
        return;
      }

      // 3) Crear sesión local (lf_auth)
      const session: LfSession = {
        mode: 'usuario',
        display: (data.nombre || telDigits).toString().toUpperCase(),
        rol: (data.rol || 'USER').toString().toUpperCase(),
        ts: Date.now(),
        ttl: 1000 * 60 * 60 * 12, // 12 horas
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('lf_auth', JSON.stringify(session));
      }

      // 4) Redirigir al menú principal
      router.replace('/menu');
    } catch (e: any) {
      console.error('Error en login', e);
      setErrorMsg(e?.message ?? 'No se pudo iniciar sesión. Intenta otra vez.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white relative">
      {/* brillo de fondo */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.18),transparent)]" />

      <div className="relative z-10 w-full max-w-md px-4 sm:px-0">
        <div className="rounded-3xl bg-white/95 text-slate-900 shadow-2xl px-6 py-7 sm:px-8 sm:py-8">
          {/* Logo + título */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg">
              <Image
                src="/logo.png"
                alt="Lavandería Fabiola"
                width={40}
                height={40}
                className="rounded-xl object-contain"
              />
            </div>
            <div className="text-center">
              <p className="text-[11px] font-semibold tracking-[0.32em] text-violet-500 uppercase">
                Lavandería Fabiola
              </p>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">
                Acceso a la aplicación
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Ingresa tu <span className="font-semibold">teléfono</span> y tu{' '}
                <span className="font-semibold">clave personal</span>.
              </p>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Teléfono */}
            <div className="grid gap-1">
              <label className="text-xs font-medium text-slate-600">
                Teléfono (usuario)
              </label>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:ring-2 focus-within:ring-violet-300">
                <Phone className="text-violet-500" size={18} />
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))}
                  inputMode="tel"
                  placeholder="Ej: 987654321"
                  className="flex-1 bg-transparent border-none outline-none text-sm"
                />
              </div>
            </div>

            {/* Clave / PIN */}
            <div className="grid gap-1">
              <label className="text-xs font-medium text-slate-600">
                Clave / PIN
              </label>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:ring-2 focus-within:ring-violet-300">
                <Lock className="text-violet-500" size={18} />
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Tu clave secreta"
                  className="flex-1 bg-transparent border-none outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                La clave se administra desde <strong>Configuración &gt; Usuarios</strong>.
              </p>
            </div>

            {/* Error */}
            {errorMsg && (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 text-xs">
                {errorMsg}
              </div>
            )}

            {/* Botón entrar */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-2.5 shadow-[0_8px_24px_rgba(88,28,135,0.45)] disabled:opacity-60"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
              Entrar
            </button>
          </form>

          {/* Pie */}
          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500 leading-snug">
              ¿Olvidaste tu clave? Pide a un <strong>ADMIN</strong> que la actualice en{' '}
              <strong>Configuración &gt; Usuarios</strong>.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
