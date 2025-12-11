// app/configuracion/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  ArrowLeft,
  Loader2,
  Users,
  Shield,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
} from 'lucide-react';

/* =========================
   Tipos y sesión local (UUD)
========================= */

type AuthMode = 'clave' | 'usuario';

type LfSession = {
  mode: AuthMode;
  display: string;
  rol?: string | null;
  ts: number;
  ttl: number;
};

function readSessionSafely(): LfSession | null {
  try {
    const raw = localStorage.getItem('lf_auth');
    if (!raw) return null;
    const s = JSON.parse(raw) as LfSession;
    if (!s || !s.ts || !s.ttl) return null;
    const expired = Date.now() - s.ts > s.ttl;
    if (expired) {
      localStorage.removeItem('lf_auth');
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

/* =========================
   Tipos de usuarios (tabla `usuario`)
========================= */

type RolUsuario = 'ADMIN' | 'USER';

type Usuario = {
  id: string;
  nombre: string;
  telefono: string;
  rol: RolUsuario;
  activo: boolean;
};

/* =========================
   Modal crear / editar usuario
========================= */

function UsuarioModal({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial?: Usuario | null;
  onClose: () => void;
  onSaved: (u: Usuario) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [rol, setRol] = useState<RolUsuario>('USER');
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (initial) {
      setNombre(initial.nombre ?? '');
      setTelefono(initial.telefono ?? '');
      setRol((initial.rol as RolUsuario) ?? 'USER');
      setActivo(initial.activo ?? true);
    } else {
      setNombre('');
      setTelefono('');
      setRol('USER');
      setActivo(true);
    }
    setError(null);
  }, [open, initial]);

  if (!open) return null;

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);

      const telLimpio = telefono.replace(/\D/g, '');
      const nombreLimpio = nombre.trim().toUpperCase();

      if (!nombreLimpio) throw new Error('El nombre es obligatorio.');
      if (!telLimpio) throw new Error('El teléfono es obligatorio.');
      if (telLimpio.length < 8) {
        throw new Error('El teléfono debe tener al menos 8 dígitos.');
      }

      const payload = {
        nombre: nombreLimpio,
        telefono: telLimpio,
        rol: rol.toUpperCase() as RolUsuario,
        activo,
      };

      let dataRow: any = null;

      if (initial?.id) {
        // update
        const { data, error } = await supabase
          .from('usuario')
          .update(payload)
          .eq('id', initial.id)
          .select('id,nombre,telefono,rol,activo')
          .maybeSingle();
        if (error) throw error;
        dataRow = data;
      } else {
        // insert
        const { data, error } = await supabase
          .from('usuario')
          .insert(payload)
          .select('id,nombre,telefono,rol,activo')
          .maybeSingle();
        if (error) throw error;
        dataRow = data;
      }

      if (!dataRow) throw new Error('No se recibió respuesta del servidor.');

      const usuarioGuardado: Usuario = {
        id: String(dataRow.id),
        nombre: dataRow.nombre ?? '',
        telefono: dataRow.telefono ?? '',
        rol: (dataRow.rol as RolUsuario) ?? 'USER',
        activo: !!dataRow.activo,
      };

      onSaved(usuarioGuardado);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo guardar el usuario.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm sm:max-w-md rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <Users className="text-violet-600" size={18} />
            <span className="font-semibold text-sm sm:text-base">
              {initial ? 'Editar usuario' : 'Nuevo usuario'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 grid gap-3 max-h-[60vh] overflow-y-auto text-sm">
          <div className="grid gap-1">
            <label className="font-medium">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300"
              placeholder="Nombre completo"
            />
          </div>

          <div className="grid gap-1">
            <label className="font-medium">Teléfono</label>
            <input
              value={telefono}
              onChange={(e) =>
                setTelefono(e.target.value.replace(/[^0-9+ ]/g, ''))
              }
              inputMode="tel"
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300"
              placeholder="Ej: 991234567"
            />
            <p className="text-xs text-slate-500 mt-1">
              Debe coincidir con el teléfono que usas en el login UUD.
            </p>
          </div>

          <div className="grid gap-1">
            <label className="font-medium">Rol</label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as RolUsuario)}
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 bg-white"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="USER">USER</option>
            </select>
          </div>

          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-medium">Activo</span>
            <button
              type="button"
              onClick={() => setActivo((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                activo
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              <CheckCircle2 size={14} />
              {activo ? 'ACTIVO' : 'INACTIVO'}
            </button>
          </div>

          {error && (
            <div className="rounded-lg bg-rose-100 text-rose-700 px-3 py-2 text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-xs sm:text-sm hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-xs sm:text-sm disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Modal eliminar usuario
========================= */

function DeleteUsuarioModal({
  open,
  usuario,
  onClose,
  onConfirm,
}: {
  open: boolean;
  usuario: Usuario | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open || !usuario) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white text-slate-900 shadow-2xl overflow-hidden">
        <div className="px-5 py-3 border-b font-semibold text-sm sm:text-base">
          Eliminar usuario
        </div>
        <div className="px-5 py-4 text-sm text-slate-700 space-y-2">
          <p>
            ¿Seguro que deseas eliminar al usuario{' '}
            <span className="font-semibold">{usuario.nombre}</span> (
            <span className="font-mono">{usuario.telefono}</span>)?
          </p>
          <p className="text-xs text-rose-500">
            Esta acción no se puede deshacer. Ten cuidado.
          </p>
        </div>
        <div className="px-5 py-3 border-t flex flex-col sm:flex-row gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-semibold py-2 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold py-2"
          >
            Sí, eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Página principal Configuración
========================= */

export default function ConfiguracionPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [authOk, setAuthOk] = useState(false);

  const [tab, setTab] = useState<'USUARIOS' | 'RESTRICCION'>('USUARIOS');

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modalUsuarioOpen, setModalUsuarioOpen] = useState(false);
  const [usuarioEdicion, setUsuarioEdicion] = useState<Usuario | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [usuarioDelete, setUsuarioDelete] = useState<Usuario | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Seguridad UUD
  useEffect(() => {
    const sess = readSessionSafely();
    if (!sess) {
      router.replace('/login?next=/configuracion');
      setAuthOk(false);
    } else {
      setAuthOk(true);
    }
    setAuthChecked(true);
  }, [router]);

  // Cargar usuarios
  useEffect(() => {
    if (!authOk) return;
    (async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const { data, error } = await supabase
          .from('usuario')
          .select('id,nombre,telefono,rol,activo')
          .order('nombre', { ascending: true });

        if (error) throw error;

        const rows: Usuario[] =
          (data as any[] | null)?.map((r) => ({
            id: String(r.id),
            nombre: r.nombre ?? '',
            telefono: r.telefono ?? '',
            rol: (r.rol as RolUsuario) ?? 'USER',
            activo: !!r.activo,
          })) ?? [];

        setUsuarios(rows);
      } catch (e: any) {
        console.error('Error cargando usuarios', e);
        setLoadError(e?.message ?? 'No se pudieron cargar los usuarios');
      } finally {
        setLoading(false);
      }
    })();
  }, [authOk]);

  function abrirNuevoUsuario() {
    setUsuarioEdicion(null);
    setModalUsuarioOpen(true);
  }

  function abrirEditarUsuario(u: Usuario) {
    setUsuarioEdicion(u);
    setModalUsuarioOpen(true);
  }

  async function confirmarEliminarUsuario() {
    if (!usuarioDelete) return;
    try {
      setDeleting(true);
      const { error } = await supabase
        .from('usuario')
        .delete()
        .eq('id', usuarioDelete.id);
      if (error) throw error;

      setUsuarios((prev) => prev.filter((u) => u.id !== usuarioDelete.id));
      setDeleteOpen(false);
      setUsuarioDelete(null);
    } catch (e: any) {
      alert(e?.message ?? 'No se pudo eliminar el usuario');
    } finally {
      setDeleting(false);
    }
  }

  /* =========================
     Renders según seguridad
  ========================== */

  if (!authChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin" size={28} />
          <span className="text-sm opacity-80">Verificando acceso UUD…</span>
        </div>
      </main>
    );
  }

  if (!authOk) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white">
        <span className="text-sm opacity-80">Redirigiendo a login…</span>
      </main>
    );
  }

  /* =========================
     Contenido principal
  ========================== */

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white pb-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 pt-5">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 mb-5">
          <button
            type="button"
            onClick={() => router.push('/menu')}
            className="inline-flex items-center gap-2 rounded-2xl bg-violet-500/90 hover:bg-violet-600 text-white px-3 py-2 text-xs sm:text-sm shadow-lg"
          >
            <ArrowLeft size={16} />
            Menú
          </button>

          <div className="text-right">
            <h1 className="text-lg sm:text-2xl font-bold tracking-wide">
              Configuración
            </h1>
            <p className="text-xs sm:text-sm opacity-80">
              Administración de usuarios y restricciones de la app.
            </p>
          </div>
        </header>

        {/* Tabs (carpetas) */}
        <div className="flex gap-2 sm:gap-3 mb-4">
          <button
            type="button"
            onClick={() => setTab('USUARIOS')}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs sm:text-sm font-semibold shadow-lg ${
              tab === 'USUARIOS'
                ? 'bg-white text-violet-800'
                : 'bg-violet-500/40 text-violet-100 hover:bg-violet-500/70'
            }`}
          >
            <Users size={16} />
            Usuarios
          </button>
          <button
            type="button"
            onClick={() => setTab('RESTRICCION')}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs sm:text-sm font-semibold shadow-lg ${
              tab === 'RESTRICCION'
                ? 'bg-white text-violet-800'
                : 'bg-violet-500/40 text-violet-100 hover:bg-violet-500/70'
            }`}
          >
            <Shield size={16} />
            Restricción
          </button>
        </div>

        {/* Contenido de cada pestaña */}
        {tab === 'USUARIOS' && (
          <section className="rounded-3xl bg-white/95 text-slate-900 shadow-2xl p-4 sm:p-6">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm sm:text-base font-semibold flex items-center gap-2">
                  <Users className="text-violet-600" size={18} />
                  Usuarios de la aplicación
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Crea, edita o elimina usuarios que pueden usar la app.
                </p>
              </div>
              <button
                type="button"
                onClick={abrirNuevoUsuario}
                className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-xs sm:text-sm font-semibold px-4 py-2 shadow-lg self-start sm:self-auto"
              >
                <Plus size={16} />
                Nuevo usuario
              </button>
            </div>

            {/* Contenido */}
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-500">
                <Loader2 className="animate-spin mr-2" size={18} />
                Cargando usuarios…
              </div>
            ) : loadError ? (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 text-sm">
                {loadError}
              </div>
            ) : usuarios.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                No hay usuarios registrados aún.
                <br />
                <span className="font-semibold">
                  Crea el primero con el botón “Nuevo usuario”.
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-[11px] sm:text-xs text-slate-500">
                      <th className="px-3 py-1">Nombre</th>
                      <th className="px-3 py-1">Teléfono</th>
                      <th className="px-3 py-1">Rol</th>
                      <th className="px-3 py-1 text-center">Estado</th>
                      <th className="px-3 py-1 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u) => (
                      <tr
                        key={u.id}
                        className="bg-slate-50 hover:bg-slate-100 rounded-2xl shadow-sm"
                      >
                        <td className="px-3 py-2 rounded-l-2xl">
                          <div className="font-medium">{u.nombre}</div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-mono text-xs text-slate-700">
                            {u.telefono}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-[11px] font-semibold">
                            {u.rol}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              u.activo
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            <CheckCircle2 size={12} />
                            {u.activo ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </td>
                        <td className="px-3 py-2 rounded-r-2xl">
                          <div className="flex justify-end gap-1 sm:gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEditarUsuario(u)}
                              className="inline-flex items-center justify-center rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 p-1.5 text-xs"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setUsuarioDelete(u);
                                setDeleteOpen(true);
                              }}
                              className="inline-flex items-center justify-center rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 p-1.5 text-xs"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === 'RESTRICCION' && (
          <section className="rounded-3xl bg-white/95 text-slate-900 shadow-2xl p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="text-violet-600" size={18} />
              <h2 className="text-sm sm:text-base font-semibold">
                Restricción de accesos (próximamente)
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mb-3">
              Aquí podrás definir qué roles pueden usar cada módulo de la aplicación
              (Base, Empresa, Pedido, Ruta, Finanzas, etc.).
            </p>
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Esta sección está marcada como <strong>Próximamente</strong>.
              <br />
              Cuando tú me digas, configuramos:
              <br />
              <span className="text-xs">
                • Permisos por rol · • Restricción de menú · • Acceso a rutas
              </span>
            </div>
          </section>
        )}
      </div>

      {/* Modales */}
      <UsuarioModal
        open={modalUsuarioOpen}
        initial={usuarioEdicion}
        onClose={() => setModalUsuarioOpen(false)}
        onSaved={(u) => {
          setUsuarios((prev) => {
            const idx = prev.findIndex((x) => x.id === u.id);
            if (idx >= 0) {
              const clone = [...prev];
              clone[idx] = u;
              return clone;
            }
            return [...prev, u].sort((a, b) =>
              a.nombre.localeCompare(b.nombre, 'es'),
            );
          });
        }}
      />

      <DeleteUsuarioModal
        open={deleteOpen}
        usuario={usuarioDelete}
        onClose={() => {
          if (deleting) return;
          setDeleteOpen(false);
          setUsuarioDelete(null);
        }}
        onConfirm={confirmarEliminarUsuario}
      />

      {deleting && (
        <div className="fixed bottom-4 right-4 z-40 rounded-xl bg-white/95 text-slate-900 px-3 py-2 text-xs shadow-lg inline-flex items-center gap-2">
          <Loader2 className="animate-spin" size={14} />
          Eliminando usuario…
        </div>
      )}
    </main>
  );
}
