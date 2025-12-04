// app/empresa/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Building2, Plus, ArrowLeft, X, Loader2, Pencil } from 'lucide-react';

type Empresa = {
  id?: number;
  nombre: string;               // Razón social
  giro: string;
  rut: string;
  direccion: string;
  correo_facturacion: string;
  telefono_contacto: string;
  descripcion?: string | null;  // opcional, por si ya existe en la tabla
};

const EMPTY_EMPRESA: Empresa = {
  nombre: '',
  giro: '',
  rut: '',
  direccion: '',
  correo_facturacion: '',
  telefono_contacto: '',
  descripcion: null,
};

export default function EmpresaPage() {
  const router = useRouter();

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);

  const [openModal, setOpenModal] = useState(false);
  const [form, setForm] = useState<Empresa>(EMPTY_EMPRESA);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [saving, setSaving] = useState(false);

  // Carga de empresas
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .order('nombre', { ascending: true });

      if (!error && data) {
        setEmpresas(data as Empresa[]);
      }
      setLoading(false);
    })();
  }, []);

  function abrirNuevaEmpresa() {
    setEditingEmpresa(null);
    setForm(EMPTY_EMPRESA);
    setOpenModal(true);
  }

  function abrirEditarEmpresa(emp: Empresa) {
    setEditingEmpresa(emp);
    setForm({
      ...EMPTY_EMPRESA,
      ...emp,
      nombre: emp.nombre ?? '',
      giro: emp.giro ?? '',
      rut: emp.rut ?? '',
      direccion: emp.direccion ?? '',
      correo_facturacion: emp.correo_facturacion ?? '',
      telefono_contacto: emp.telefono_contacto ?? '',
    });
    setOpenModal(true);
  }

  async function guardarEmpresa() {
    try {
      setSaving(true);

      const nombre = form.nombre.trim().toUpperCase();
      const giro = form.giro.trim();
      const rut = form.rut.trim().toUpperCase();
      const direccion = form.direccion.trim();
      const correo = form.correo_facturacion.trim();
      const telefono = form.telefono_contacto.trim();

      if (!nombre || !giro || !rut || !direccion || !correo || !telefono) {
        alert('Completa todos los campos obligatorios.');
        setSaving(false);
        return;
      }

      const payload = {
        nombre,
        giro,
        rut,
        direccion,
        correo_facturacion: correo,
        telefono_contacto: telefono,
      };

      let dataResult: Empresa | null = null;

      if (editingEmpresa?.id) {
        // UPDATE
        const { data, error } = await supabase
          .from('empresas')
          .update(payload)
          .eq('id', editingEmpresa.id)
          .select('*')
          .maybeSingle();

        if (error) throw error;
        dataResult = data as Empresa;

        setEmpresas((prev) =>
          prev
            .map((e) => (e.id === editingEmpresa.id ? (dataResult as Empresa) : e))
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
      } else {
        // INSERT
        const { data, error } = await supabase
          .from('empresas')
          .insert(payload)
          .select('*')
          .maybeSingle();

        if (error) throw error;
        dataResult = data as Empresa;

        setEmpresas((prev) =>
          [...prev, dataResult as Empresa].sort((a, b) =>
            a.nombre.localeCompare(b.nombre),
          ),
        );
      }

      setOpenModal(false);
      setEditingEmpresa(null);
      setForm(EMPTY_EMPRESA);
    } catch (e: any) {
      alert(e.message ?? 'No fue posible guardar la empresa');
    } finally {
      setSaving(false);
    }
  }

  function handleSelect(emp: Empresa) {
    router.push(
      `/pedido?mode=empresa&empresa=${encodeURIComponent(emp.nombre)}`,
    );
  }

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800">
      <header className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push('/menu')}
          className="inline-flex items-center gap-1 rounded-xl bg-white/10 border border-white/15 px-3 py-1.5 text-xs sm:text-sm hover:bg-white/15"
        >
          <ArrowLeft size={14} />
          Menú
        </button>
        <h1 className="font-bold text-lg sm:text-xl">Empresa</h1>
        <div className="w-16" />
      </header>

      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pb-10">
        {/* Bloque Empresas */}
        <div className="mt-6 rounded-3xl bg-white/10 border border-white/15 backdrop-blur-md shadow-2xl px-5 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base sm:text-lg">
              Listado de empresas
            </h2>
            <button
              type="button"
              onClick={abrirNuevaEmpresa}
              className="inline-flex items-center gap-1 rounded-xl bg-white text-violet-800 px-3 py-1.5 text-xs sm:text-sm font-semibold shadow hover:bg-violet-50"
            >
              <Plus size={14} />
              Nueva
            </button>
          </div>

          {loading ? (
            <p className="text-xs sm:text-sm opacity-80">Cargando…</p>
          ) : empresas.length === 0 ? (
            <p className="text-xs sm:text-sm opacity-75">
              Sin empresas registradas.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {empresas.map((emp) => (
                <div
                  key={emp.id}
                  className="flex flex-col rounded-2xl bg-white/10 border border-white/15 px-4 py-3 shadow hover:bg-white/20 transition"
                >
                  <button
                    onClick={() => handleSelect(emp)}
                    className="flex items-center gap-3 text-left"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                      <Building2 size={24} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm sm:text-base font-semibold">
                        {emp.nombre}
                      </span>
                      {emp.giro && (
                        <span className="text-[0.7rem] text-white/80">
                          {emp.giro}
                        </span>
                      )}
                      {emp.rut && (
                        <span className="text-[0.7rem] text-white/70">
                          RUT: {emp.rut}
                        </span>
                      )}
                    </div>
                  </button>

                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => abrirEditarEmpresa(emp)}
                      className="inline-flex items-center gap-1 rounded-xl bg-white/90 text-violet-800 px-2.5 py-1 text-[0.7rem] font-semibold hover:bg-white"
                    >
                      <Pencil size={14} />
                      Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Modal crear / editar empresa */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-bold text-sm sm:text-base">
                {editingEmpresa ? 'Editar empresa' : 'Nueva empresa'}
              </div>
              <button
                onClick={() => {
                  setOpenModal(false);
                  setEditingEmpresa(null);
                }}
                className="p-1 rounded-full hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-4 py-4 grid gap-3 max-h-[70vh] overflow-y-auto text-sm">
              <div className="grid gap-1">
                <label className="font-medium">Nombre empresa</label>
                <input
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nombre: e.target.value.toUpperCase() }))
                  }
                  className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 uppercase"
                  placeholder="Ej: HOM SERVICES SPA"
                />
              </div>

              <div className="grid gap-1">
                <label className="font-medium">Giro</label>
                <input
                  value={form.giro}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, giro: e.target.value }))
                  }
                  className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300"
                  placeholder="Ej: Limpieza y mantención de propiedades"
                />
              </div>

              <div className="grid gap-1">
                <label className="font-medium">RUT</label>
                <input
                  value={form.rut}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rut: e.target.value.toUpperCase() }))
                  }
                  className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 uppercase"
                  placeholder="Ej: 77.534.752-K"
                />
              </div>

              <div className="grid gap-1">
                <label className="font-medium">Dirección</label>
                <input
                  value={form.direccion}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, direccion: e.target.value }))
                  }
                  className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300"
                  placeholder="Ej: Av. Kennedy N°7900 Oficina 505 Santiago"
                />
              </div>

              <div className="grid gap-1">
                <label className="font-medium">Correo facturación</label>
                <input
                  type="email"
                  value={form.correo_facturacion}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, correo_facturacion: e.target.value }))
                  }
                  className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300"
                  placeholder="Ej: CARLEN@HOM.CL"
                />
              </div>

              <div className="grid gap-1">
                <label className="font-medium">Teléfono contacto</label>
                <input
                  value={form.telefono_contacto}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, telefono_contacto: e.target.value }))
                  }
                  className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300"
                  placeholder="Ej: +569 9XXXXXXX"
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setOpenModal(false);
                  setEditingEmpresa(null);
                }}
                className="rounded-xl px-4 py-2 text-xs sm:text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEmpresa}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-xs sm:text-sm disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
