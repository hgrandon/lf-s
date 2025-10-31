'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Pencil, Search, ArrowLeft } from 'lucide-react';
import EditPedidoModal from '@/app/components/EditPedidoModal';
import type { Entrega, Estado, Pago } from '@/app/types/pedido';

// Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Tipos
type Pedido = {
  nro: number;
  total: number;
  fecha_entrega: string;
  entrega: Entrega;
  pago: Pago;
  estado?: Estado;
  telefono: string;
  nombre: string;
  direccion: string;
};

// Utils
const CLP = new Intl.NumberFormat('es-CL');
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

// Página
export default function DetallePage() {
  const [data, setData] = useState<Pedido[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Pedido | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [mEstado, setMEstado] = useState<Estado>('LAVAR');
  const [mEntrega, setMEntrega] = useState<Entrega>('LOCAL');
  const [mPago, setMPago] = useState<Pago>('PENDIENTE');
  const [saving, setSaving] = useState(false);

  // Cargar datos desde Supabase
  useEffect(() => {
    (async () => {
      const { data: rows, error } = await supabase
        .from('pedido') // Asegúrate de usar el nombre correcto de la tabla
        .select(
          'nro,total,fecha_entrega,entrega,pago,estado,telefono,nombre,direccion'
        )
        .order('nro', { ascending: false })
        .limit(200);
      if (error) {
        console.error('Error cargando pedidos:', error.message);
        return;
      }
      setData((rows ?? []) as Pedido[]);
    })();
  }, []);

  // Filtro
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return data;
    return data.filter(
      (r) =>
        String(r.nro).includes(t) ||
        r.nombre?.toLowerCase().includes(t) ||
        r.telefono?.includes(t)
    );
  }, [q, data]);

  // Abrir modal desde lápiz
  const abrirEditar = () => {
    if (!selected) {
      alert('Selecciona primero una fila de la tabla.');
      return;
    }
    setMEstado(selected.estado ?? 'LAVAR');
    setMEntrega(selected.entrega);
    setMPago(selected.pago);
    setEditOpen(true);
  };

  // Guardar cambios
  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    const updates = {
      estado: mEstado,
      entrega: mEntrega,
      pago: mPago,
    };
    const { error } = await supabase
      .from('pedido')
      .update(updates)
      .eq('nro', selected.nro);

    if (error) {
      alert('No se pudo guardar: ' + error.message);
      setSaving(false);
      return;
    }

    setData((prev) =>
      prev.map((r) => (r.nro === selected.nro ? { ...r, ...updates } : r))
    );
    setSaving(false);
    setEditOpen(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 p-4">
      <div className="mx-auto w-full max-w-6xl rounded-2xl bg-white/90 p-4 shadow-2xl">
        {/* Header */}
        <header className="mb-3 flex items-center gap-3">
          <button
            onClick={() => history.back()}
            className="rounded-full p-2 text-violet-700 hover:bg-violet-50"
            aria-label="Volver"
            title="Volver"
          >
            <ArrowLeft size={20} />
          </button>

          <h1 className="flex-1 text-lg font-semibold text-violet-800">
            REPORTE BASE
          </h1>

          {/* Buscador */}
          <div className="relative mr-auto w-[420px] max-w-full">
            <Search
              className="pointer-events-none absolute left-3 top-2.5"
              size={16}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="BUSCAR N° O NOMBRE."
              className="w-full rounded-xl border border-violet-200 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          {/* Lápiz */}
          <button
            onClick={abrirEditar}
            className={cx(
              'rounded-full p-2 text-white transition',
              selected
                ? 'bg-violet-600 hover:bg-violet-700'
                : 'bg-violet-300 cursor-not-allowed'
            )}
            title={
              selected
                ? `Modificar pedido #${selected?.nro}`
                : 'Selecciona una fila para editar'
            }
          >
            <Pencil size={18} />
          </button>
        </header>

        {/* Tabla */}
        <div className="overflow-hidden rounded-xl border border-violet-100">
          <table className="w-full text-sm">
            <thead className="bg-violet-50 text-violet-700">
              <tr>
                <th className="px-3 py-2 text-left">N°</th>
                <th className="px-3 py-2 text-left">Total</th>
                <th className="px-3 py-2 text-left">F. Ent.</th>
                <th className="px-3 py-2 text-left">Entrega</th>
                <th className="px-3 py-2 text-left">Pago</th>
                <th className="px-3 py-2 text-left">Teléfono</th>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Dirección</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const active = selected?.nro === r.nro;
                return (
                  <tr
                    key={r.nro}
                    onClick={() => setSelected(r)}
                    className={cx(
                      'cursor-pointer border-t hover:bg-violet-50',
                      active && 'bg-violet-100'
                    )}
                  >
                    <td className="px-3 py-2">{r.nro}</td>
                    <td className="px-3 py-2">{CLP.format(r.total ?? 0)}</td>
                    <td className="px-3 py-2">{r.fecha_entrega}</td>
                    <td className="px-3 py-2">{r.entrega}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cx(
                          'inline-block rounded-full px-2 py-0.5 text-xs font-bold',
                          r.pago === 'PAGADO'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        )}
                      >
                        {r.pago}
                      </span>
                    </td>
                    <td className="px-3 py-2">{r.telefono}</td>
                    <td className="px-3 py-2">{r.nombre}</td>
                    <td className="px-3 py-2">{r.direccion}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-slate-500"
                  >
                    Sin resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <EditPedidoModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleSave}
        saving={saving}
        nro={selected?.nro}
        estado={mEstado}
        entrega={mEntrega}
        pago={mPago}
        setEstado={setMEstado}
        setEntrega={setMEntrega}
        setPago={setMPago}
      />
    </main>
  );
}
