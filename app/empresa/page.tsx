// app/empresa/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Building2, Plus, ArrowLeft, X, Loader2, Pencil } from 'lucide-react';

type Empresa = {
  id?: number;
  nombre: string;
  giro: string;
  rut: string;
  direccion: string;
  correo_facturacion: string;
  telefono_contacto: string;
  descripcion?: string | null;
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

  // CARGA INICIAL DE EMPRESAS
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
    });
    setOpenModal(true);
  }

  async function guardarEmpresa() {
    try {
      setSaving(true);

      const nombre = form.nombre.trim().toUpperCase();
      const giro = form.giro.trim().toUpperCase();
      const rut = form.rut.trim().toUpperCase();
      const direccion = form.direccion.trim().toUpperCase();
      const correo = form.correo_facturacion.trim().toUpperCase();
      const telefono = form.telefono_contacto.trim().toUpperCase();

      if (!nombre || !giro || !rut || !direccion || !correo || !telefono) {
        alert('COMPLETA TODOS LOS CAMPOS OBLIGATORIOS.');
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
            .map((e) => (e.id === editingEmpresa.id ? dataResult! : e))
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
          [...prev, dataResult!].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
      }

      setOpenModal(false);
      setEditingEmpresa(null);
      setForm(EMPTY_EMPRESA);
    } catch (e: any) {
      alert(e.message ?? 'NO FUE POSIBLE GUARDAR LA EMPRESA');
    } finally {
      setSaving(false);
    }
  }

  function handleSelect(emp: Empresa) {
    router.push(`/pedido?mode=empresa&empresa=${encodeURIComponent(emp.nombre)}`);
  }

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800">
      {/* HEADER */}
      <header className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push('/menu')}
          className="inline-flex items-center gap-1 rounded-xl bg-white/10 border border-white/15 px-3 py-1.5 text-xs sm:text-sm hover:bg-white/15"
        >
          <ArrowLeft size={14} />
          MENÚ
        </button>
        <h1 className="font-bold text-lg sm:text-xl">EMPRESA</h1>
        <div className="w-16" />
      </header>

      {/* LISTADO EMPRESAS */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pb-10">
        <div className="mt-6 rounded-3xl bg-white/10 border border-white/15 shadow-2xl px-5 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base sm:text-lg">
              LISTADO DE EMPRESAS
            </h2>
            <button
              type="button"
              onClick={abrirNuevaEmpresa}
              className="inline-flex items-center gap-1 rounded-xl bg-white text-violet-800 px-3 py-1.5 text-xs sm:text-sm font-semibold shadow hover:bg-violet-50"
            >
              <Plus size={14} />
              NUEVA
            </button>
          </div>

          {loading ? (
            <p className="text-xs sm:text-sm opacity-80">CARGANDO…</p>
          ) : empresas.length === 0 ? (
            <p className="text-xs sm:text-sm opacity-75">SIN EMPRESAS REGISTRADAS.</p>
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
                      EDITAR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* MODAL NUEVA / EDITAR EMPRESA */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white text-slate-900 shadow-2xl">
            {/* HEADER MODAL */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-bold text-sm sm:text-base">
                {editingEmpresa ? 'EDITAR EMPRESA' : 'NUEVA EMPRESA'}
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

            {/* CUERPO MODAL */}
            <div className="px-4 py-4 grid gap-3 max-h-[70vh] overflow-y-auto text-sm">
              <div className="grid gap-1">
                <label className="font-medium">NOMBRE EMPRESA</label>
                <input
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      nombre: e.target.value.toUpperCase(),
                    }))
                  }
                  className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 uppercase"
                  placeholder="EJ: EMPRESA XYZ SPA"
                />
              </div>

              <div className="grid gap-1">
                <label className="font-medium">GIRO</label>
                <input
                  value={form.giro}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      giro: e.target.value.toUpperCase(),
                    }))
                  }
                  className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 uppercase"
                  placeholder="EJ: GIRO DE LA EMPRESA"
                />
              </div>

              <div className="grid gap-1">
                <label className="font-medium">RUT</label>
                <input
                  value={form.rut}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      rut: e.target.value.toUpperCase(),
                    }))
                  }
                  className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 uppercase"
                  placeholder="EJ: 00.000.000-K"
                />
              </div>

              <div className="grid gap-1">
                <label className="font-medium">DIRECCIÓN</label>
                <input
                  value={form.direccion}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      direccion: e.target.value.toUpperCase(),
                    }))
                  }
                  className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 uppercase"
                  placeholder="EJ: DIRECCIÓN COMERCIAL"
                />
              </div>

              <div className="grid gap-1">
                <label className="font-medium">CORREO FACTURACIÓN</label>
                <input
                  type="email"
                  value={form.correo_facturacion}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      correo_facturacion: e.target.value.toUpperCase(),
                    }))
                  }
                  className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 uppercase"
                  placeholder="EJ: CORREO@EMPRESA.CL"
                />
              </div>

              <div className="grid gap-1">
                <label className="font-medium">TELÉFONO CONTACTO</label>
                <input
                  value={form.telefono_contacto}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      telefono_contacto: e.target.value.toUpperCase(),
                    }))
                  }
                  className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 uppercase"
                  placeholder="EJ: 9 99999999"
                />
              </div>
            </div>

            {/* FOOTER MODAL */}
            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setOpenModal(false);
                  setEditingEmpresa(null);
                }}
                className="rounded-xl px-4 py-2 text-xs sm:text-sm hover:bg-slate-50"
              >
                CANCELAR
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
                GUARDAR
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
