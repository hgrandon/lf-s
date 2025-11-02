// app/entregar/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, MapPinned, CheckCircle2, Wallet, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type Item = { articulo: string; qty: number; valor: number };
type Pedido = {
  id: number;                // alias de nro
  telefono: string;          // clave para cliente
  cliente: string;           // nombre visible
  direccion?: string | null; // para abrir Maps
  total: number | null;
  estado: 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGADO' | 'ENTREGAR';
  detalle?: string | null;
  pagado?: boolean | null;
  tipo_entrega?: 'LOCAL' | 'DOMICILIO' | null;
  items?: Item[];
};

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export default function EntregarPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // cache para subtotales por pedido
  const subtotal = (it: Item) => (Number(it.qty) || 0) * (Number(it.valor) || 0);

  function snack(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 1800);
  }

  const selectedPedido = useMemo(
    () => pedidos.find(p => p.id === selectedId) ?? null,
    [pedidos, selectedId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErrMsg(null);

        // 1) Traer pedidos en estado ENTREGAR
        const { data: rows, error: e1 } = await supabase
          .from('pedido')
          .select('id:nro, telefono, total, estado, detalle, pagado, tipo_entrega')
          .eq('estado', 'ENTREGAR')
          .order('nro', { ascending: false });

        if (e1) throw e1;

        const ids = (rows ?? []).map(r => (r as any).id);
        const tels = (rows ?? []).map(r => (r as any).telefono).filter(Boolean);

        if (!rows?.length) {
          if (!cancelled) {
            setPedidos([]);
            setLoading(false);
          }
          return;
        }

        // 2) Traer líneas para calcular totales (si hace falta)
        const { data: lineas, error: e2 } = await supabase
          .from('pedido_linea')
          .select('*')
          .in('nro', ids);
        if (e2) throw e2;

        // 3) Traer clientes (nombre + dirección)
        const { data: cli, error: e3 } = await supabase
          .from('clientes')
          .select('telefono, nombre, direccion')
          .in('telefono', tels);
        if (e3) throw e3;

        const nombreByTel = new Map<string, string>();
        const direccionByTel = new Map<string, string | null>();
        (cli ?? []).forEach((c: any) => {
          const t = String(c.telefono);
          nombreByTel.set(t, c.nombre ?? 'SIN NOMBRE');
          direccionByTel.set(t, c.direccion ?? null);
        });

        const itemsByPedido = new Map<number, Item[]>();
        (lineas ?? []).forEach((l: any) => {
          const pid = Number(l.nro ?? l.pedido_id ?? l.pedido_nro);
          if (!pid) return;
          const label = String(
            l.articulo ?? l.nombre ?? l.descripcion ?? l.item ?? l.articulo_nombre ?? l.articulo_id ?? ''
          ).trim() || 'SIN NOMBRE';
          const qty = Number(l.cantidad ?? l.qty ?? l.cantidad_item ?? 0);
          const valor = Number(l.valor ?? l.precio ?? l.monto ?? 0);
          const arr = itemsByPedido.get(pid) ?? [];
          arr.push({ articulo: label, qty, valor });
          itemsByPedido.set(pid, arr);
        });

        const mapped: Pedido[] = (rows ?? []).map((r: any) => {
          const tel = String(r.telefono ?? '');
          const items = itemsByPedido.get(r.id) ?? [];
          const totalCalc = items.length ? items.reduce((a, it) => a + subtotal(it), 0) : (r.total ?? 0);
          return {
            id: r.id,
            telefono: tel,
            cliente: nombreByTel.get(tel) ?? tel || 'SIN NOMBRE',
            direccion: direccionByTel.get(tel) ?? null,
            total: totalCalc,
            estado: r.estado,
            detalle: r.detalle ?? null,
            pagado: r.pagado ?? false,
            tipo_entrega: (r.tipo_entrega as any) ?? null,
            items,
          };
        });

        if (!cancelled) {
          setPedidos(mapped);
          setLoading(false);
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setErrMsg(err?.message ?? 'Error al cargar pedidos');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function changeEstado(id: number, next: Pedido['estado']) {
    if (!id) return;
    setSaving(true);
    const snapshot = [...pedidos];
    try {
      // optimista
      setPedidos(prev => prev.map(p => (p.id === id ? { ...p, estado: next } : p)));
      const { error } = await supabase.from('pedido').update({ estado: next }).eq('nro', id).select('nro').single();
      if (error) throw error;

      // si salió de ENTREGAR, sacamos de la tabla
      if (next !== 'ENTREGAR') {
        setPedidos(prev => prev.filter(p => p.id !== id));
        setSelectedId(null);
      }
      snack(`Pedido #${id} movido a ${next}`);
    } catch (e) {
      console.error(e);
      setPedidos(snapshot);
      snack('No se pudo actualizar el estado.');
    } finally {
      setSaving(false);
    }
  }

  async function togglePago(id: number) {
    if (!id) return;
    setSaving(true);
    const snapshot = [...pedidos];
    try {
      const current = snapshot.find(p => p.id === id)?.pagado ?? false;
      // optimista
      setPedidos(prev => prev.map(p => (p.id === id ? { ...p, pagado: !current } : p)));
      const { error } = await supabase.from('pedido').update({ pagado: !current }).eq('nro', id).select('nro').single();
      if (error) throw error;
      snack(`Pedido #${id} marcado como ${!current ? 'Pagado' : 'Pendiente'}`);
    } catch (e) {
      console.error(e);
      setPedidos(snapshot);
      snack('No se pudo actualizar el pago.');
    } finally {
      setSaving(false);
    }
  }

  function openMaps(p: Pedido | null) {
    if (!p) return;
    const q = p.direccion?.toString().trim();
    if (!q) {
      snack('El cliente no tiene dirección registrada.');
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 lg:px-10 py-3 lg:py-5">
        <h1 className="font-bold text-base lg:text-xl">Entregar</h1>
        <button onClick={() => router.push('/base')} className="text-xs lg:text-sm text-white/90 hover:text-white">
          ← Volver
        </button>
      </header>

      {/* Barra de acciones */}
      <section className="relative z-10 w-full px-3 sm:px-6 lg:px-10 mb-3">
        <div className="rounded-2xl bg-white/10 border border-white/15 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <ActionBtn
              label="Abrir Maps"
              Icon={MapPinned}
              disabled={!selectedPedido}
              onClick={() => openMaps(selectedPedido)}
            />
            <ActionBtn
              label="Marcar Entregado"
              Icon={CheckCircle2}
              disabled={!selectedPedido || saving}
              onClick={() => selectedPedido && changeEstado(selectedPedido.id, 'ENTREGADO')}
            />
            <ActionBtn
              label={selectedPedido?.pagado ? 'Pago' : 'Pendiente'}
              Icon={Wallet}
              disabled={!selectedPedido || saving}
              onClick={() => selectedPedido && togglePago(selectedPedido.id)}
              active={!!selectedPedido?.pagado}
            />
            <ActionBtn
              label="Volver"
              Icon={ArrowLeft}
              onClick={() => router.push('/base')}
            />
          </div>

          {selectedPedido ? (
            <div className="mt-2 text-xs text-white/90">
              Seleccionado: <b>#{selectedPedido.id}</b> • {selectedPedido.cliente}
              {selectedPedido.direccion ? ` • ${selectedPedido.direccion}` : ' • Sin dirección'}
              {saving && (
                <span className="inline-flex items-center gap-1 ml-2">
                  <Loader2 size={14} className="animate-spin" /> Guardando…
                </span>
              )}
            </div>
          ) : (
            <div className="mt-2 text-xs text-white/70">Selecciona un pedido para habilitar las acciones.</div>
          )}
        </div>
      </section>

      {/* Tabla de pedidos */}
      <section className="relative z-10 w-full px-3 sm:px-6 lg:px-10">
        {loading && (
          <div className="flex items-center gap-2 text-white/90">
            <Loader2 className="animate-spin" size={18} />
            Cargando pedidos…
          </div>
        )}

        {!loading && errMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-300/30 p-3 text-sm">
            <AlertTriangle size={16} />
            <span>{errMsg}</span>
          </div>
        )}

        {!loading && !errMsg && pedidos.length === 0 && (
          <div className="text-white/80">No hay pedidos en estado ENTREGAR.</div>
        )}

        {!loading && !errMsg && pedidos.length > 0 && (
          <div className="rounded-2xl overflow-hidden border border-white/15 bg-white/10 backdrop-blur-md shadow-[0_6px_20px_rgba(0,0,0,0.15)]">
            <div className="overflow-x-auto">
              <table className="w-full text-xs lg:text-sm text-white/95">
                <thead className="bg-white/10 text-white/90">
                  <tr>
                    <th className="text-left px-3 py-2 w-[20%]">N° Pedido</th>
                    <th className="text-left px-3 py-2 w-[40%]">Cliente</th>
                    <th className="text-left px-3 py-2 w-[15%]">Pago</th>
                    <th className="text-left px-3 py-2 w-[15%]">Entrega</th>
                    <th className="text-right px-3 py-2 w-[20%]">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {pedidos.map(p => {
                    const isSelected = selectedId === p.id;
                    return (
                      <tr
                        key={p.id}
                        className={[
                          'cursor-pointer select-none',
                          isSelected ? 'bg-white/15' : 'hover:bg-white/10'
                        ].join(' ')}
                        onClick={() => setSelectedId(isSelected ? null : p.id)}
                      >
                        <td className="px-3 py-2 font-semibold">#{p.id}</td>
                        <td className="px-3 py-2 truncate">
                          {p.cliente}
                          {p.direccion ? (
                            <span className="text-white/60"> — {p.direccion}</span>
                          ) : (
                            <span className="text-white/40"> — Sin dirección</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{p.pagado ? 'PAGADO' : 'PENDIENTE'}</td>
                        <td className="px-3 py-2">{p.tipo_entrega ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-extrabold">
                          {CLP.format(p.total ?? (p.items?.length ? p.items.reduce((a, it) => a + subtotal(it), 0) : 0))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {notice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg bg-black/70 text-white text-sm shadow">
          {notice}
        </div>
      )}
    </main>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  active,
  Icon,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  Icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
  const IconComp = Icon;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium border transition',
        active
          ? 'bg-white/20 border-white/30 text-white'
          : 'bg-white/5 border-white/10 text-white/90 hover:bg-white/10',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {IconComp ? <IconComp size={16} /> : null}
      {label}
    </button>
  );
}
