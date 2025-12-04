'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  Building2,
  Plus,
  ArrowLeft,
  X,
  Loader2
} from 'lucide-react';

type Empresa = {
  id: number;
  nombre: string;
  descripcion?: string | null;
};

export default function EmpresaPage() {
  const router = useRouter();

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoDesc, setNuevoDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Carga de empresas
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .order('nombre', { ascending: true });

      if (!error && data) {
        setEmpresas(data);
      }
      setLoading(false);
    })();
  }, []);

  async function agregarEmpresa() {
    try {
      setSaving(true);

      const nombreTrim = nuevoNombre.trim().toUpperCase();
      if (!nombreTrim) {
        alert('Ingrese nombre de la empresa');
        return;
      }

      const payload = {
        nombre: nombreTrim,
        descripcion: nuevoDesc.trim() || null,
      };

      const { data, error } = await supabase
        .from('empresas')
        .insert(payload)
        .select('*')
        .maybeSingle();

      if (error) throw error;

      setEmpresas((prev) =>
        [...prev, data as Empresa].sort((a, b) =>
          a.nombre.localeCompare(b.nombre)
        )
      );

      setOpenModal(false);
      setNuevoNombre('');
      setNuevoDesc('');
    } catch (e: any) {
      alert(e.message ?? 'No fue posible guardar la empresa');
    } finally {
      setSaving(false);
    }
  }

  function handleSelect(emp: Empresa) {
    router.push(
      `/pedido?mode=empresa&empresa=${encodeURIComponent(emp.nombre)}`
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
            <h2 className="font-semibold text-base sm:text-lg">Listado de empresas</h2>
            <button
              type="button"
              onClick={() => setOpenModal(true)}
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
                <button
                  key={emp.id}
                  onClick={() => handleSelect(emp)}
                  className="flex items-center gap-3 text-left rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 px-4 py-3 transition"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                    <Building2 size={24} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm sm:text-base font-semibold">
                      {emp.nombre}
                    </span>
                    {emp.descripcion && (
                      <span className="text-[0.7rem] text-white/75">
                        {emp.descripcion}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Modal agregar empresa */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-bold text-sm sm:text-base">Nueva Empresa</div>
              <button
                onClick={() => setOpenModal(false)}
                className="p-1 rounded-full hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-4 py-4 grid gap-3">
              <div className="grid gap-1">
                <label className="text-sm font-medium">Nombre</label>
                <input
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value.toUpperCase())}
                  className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 text-sm uppercase"
                  placeholder="Ej: CODELCO"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm font-medium">Descripción (opcional)</label>
                <input
                  value={nuevoDesc}
                  onChange={(e) => setNuevoDesc(e.target.value)}
                  className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 text-sm"
                  placeholder="Ej: Contrato Minería"
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button
                onClick={() => setOpenModal(false)}
                className="rounded-xl px-4 py-2 text-xs sm:text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={agregarEmpresa}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-xs sm:text-sm disabled:opacity-60"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
