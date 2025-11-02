// app/entregar/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown, ChevronRight, User, Table, Loader2, AlertTriangle,
  MapPinned, CheckCircle2, Wallet, ArrowLeft
} from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

type Item = { articulo: string; qty: number; valor: number };
type Pedido = {
  id: number;                    // nro
  telefono: string;
  cliente: string;
  direccion?: string | null;
  total: number | null;
  estado: 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGADO' | 'ENTREGAR';
  detalle?: string | null;
  foto_url?: string | null;
  pagado?: boolean | null;
  tipo_entrega?: 'LOCAL' | 'DOMICILIO' | null;
  items?: Item[];
};

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

function firstFotoFromMixed(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return null;
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string') return arr[0] as string;
        return null;
      } catch { return null; }
    }
    return s;
  }
  if (Array.isArray(input) && input.length > 0 && typeof input[0] === 'string') return input[0] as string;
  return null;
}

export default function EntregarPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [openDetail, setOpenDetail] = useState<Record<number, boolean>>({});
  const [imageError, setImageError] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const pedidoAbierto = useMemo(() => pedidos.find(p => p.id === openId) ?? null, [pedidos, openId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErrMsg(null);

        // Pedidos en ENTREGAR
        const { data: rows, error: e1 } = await supabase
          .from('pedido')
          .select('id:nro, telefono, total, estado, detalle, pagado, fotos_urls, tipo_entrega')
          .eq('estado', 'ENTREGAR')
          .order('nro', { ascending: false });
        if (e1) throw e1;

        const ids = (rows ?? []).map(r => (r as any).id);
        const tels = (rows ?? []).map(r => String((r as any).telefono)).filter(Boolean);

        if (!rows?.length) {
          if (!cancelled) {
            setPedidos([]);
            setLoading(false);
          }
          return;
        }

        // Líneas
        const { data: lineas, error: e2 } = await supabase
          .from('pedido_linea')
          .select('*')
          .in('nro', ids);
        if (e2) throw e2;

        // Fotos específicas
        const { data: fotos, error: e3 } = await supabase
          .from('pedido_foto')
          .select('nro, url')
          .in('nro', ids);
        if (e3) throw e3;

        // Clientes (nombre + dirección)
        const { data: cli, error: e4 } = await supabase
          .from('clientes')
          .select('telefono, nombre, direccion')
          .in('telefono', tels);
        if (e4) throw e4;

        const nombreByTel = new Map<string, string>();
        const dirByTel = new Map<string, string | null>();
        (cli ?? []).forEach((c: any) => {
          const t = String(c.telefono);
          nombreByTel.set(t, c.nombre ?? 'SIN NOMBRE');
          dirByTel.set(t, c.direccion ?? null);
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

        const fotoByPedido = new Map<number, string>();
        (rows ?? []).forEach((r: any) => {
          const f = firstFotoFromMixed(r.fotos_urls);
          if (f) fotoByPedido.set(r.id, f);
        });
        (fotos ?? []).forEach((f: any) => {
          const pid = Number(f.nro);
          if (!fotoByPedido.has(pid) && typeof f.url === 'string' && f.url) {
            fotoByPedido.set(pid, f.url);
          }
        });

        const mapped: Pedido[] = (rows ?? []).map((r: any) => {
          const tel = String(r.telefono ?? '');
          const items = itemsByPedido.get(r.id) ?? [];
          const totalCalc = items.length ? items.reduce((a, it) => a + (Number(it.qty) * Number(it.valor)), 0) : (r.total ?? 0);
          const cliente = (nombreByTel.get(tel) ?? (tel || 'SIN NOMBRE')); // sin mezclar ?? y ||
          const direccion = dirByTel.get(tel) ?? null;

          return {
            id: r.id,
            telefono: tel,
            cliente,
            direccion,
            total: totalCalc,
            estado: r.estado,
            detalle: r.detalle ?? null,
            foto_url: fotoByPedido.get(r.id) ?? null,
            pagado: r.pagado ?? false,
            tipo_entrega: (r.tipo_entrega as any) ?? null,
            items
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
    return () => { cancelled = true; };
  }, []);

  const subtotal = (it: Item) => (Number(it.qty) || 0) * (Number(it.valor) || 0);

  function snack(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 1800);
  }

  // Cambios de estado
  async function changeEstado(id: number, next: Pedido['estado']) {
    if (!id) return;
    setSaving(true);
    const prev = pedidos;
    setPedidos(prev.map(p => (p.id === id ? { ...p, estado: next } : p)));

    const { error } = await supabase.from('pedido').update({ estado: next }).eq('nro', id).select('nro').single();

    if (error) {
      console.error('No se pudo actualizar estado:', error);
      setPedidos(prev);
      setSaving(false);
      return;
    }

    // En ENTREGAR, si pasa a otro estado, lo removemos de la lista
    if (next !== 'ENTREGAR') {
      setPedidos(curr => curr.filter(p => p.id !== id));
      setOpenId(null);
      snack(`Pedido #${id} movido a ${next}`);
    }
    setSaving(false);
  }

  async function togglePago(id: number) {
    if (!id) return;
    setSaving(true);
    const prev = pedidos;
    const actual = prev.find(p => p.id === id)?.pagado ?? false;
    setPedidos(prev.map(p => (p.id === id ? { ...p, pagado: !actual } : p)));

    const { error } = await supabase.from('pedido').update({ pagado: !actual }).eq('nro', id).select('nro').single();

    if (error) {
      console.error('No se pudo actualizar pago:', error);
      setPedidos(prev);
      setSaving(false);
      return;
    }

    snack(`Pedido #${id} marcado como ${!actual ? 'Pagado' : 'Pendiente'}`);
    setSaving(false);
  }

  function openMaps() {
    if (!pedidoAbierto) return;
    const q = (pedidoAbierto.direccion || '').toString().trim();
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

      <header className="relative z-10 flex items-center justify-between px-4 lg:px-10 py-3 lg:py-5">
        <h1 className="font-bold text-base lg:text-xl">Entregar</h1>
        <button onClick={() => router.push('/base')} className="text-xs lg:text-sm text-white/90 hover:text-white">
          ← Volver
        </button>
      </header>

      <section className="relative z-10 w-full px-3 sm:px-6 lg:px-10 grid gap-4">
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

        {!loading && !errMsg && pedidos.map(p => {
          const isOpen = openId === p.id;
          const detOpen = !!openDetail[p.id];
          const totalCalc = p.items?.length ? p.items.reduce((a, it) => a + subtotal(it), 0) : p.total ?? 0;

          return (
            <div
              key={p.id}
              className={[
                'rounded-2xl bg-white/10 border backdrop-blur-md shadow-[0_6px_20px_rgba(0,0,0,0.15)]',
                isOpen ? 'border-white/40' : 'border-white/15',
              ].join(' ')}
            >
              <button
                onClick={() => setOpenId(isOpen ? null : p.id)}
                className="w-full flex items-center justify-between gap-3 lg:gap-4 px-3 sm:px-4 lg:px-6 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/15 border border-white/20">
                    <User size={18} />
                  </span>
                  <div className="text-left">
                    <div className="font-extrabold tracking-wide text-sm lg:text-base">N° {p.id}</div>
                    <div className="text-[10px] lg:text-xs uppercase text-white/85">
                      {p.cliente} {p.pagado ? '• PAGADO' : '• PENDIENTE'} {p.tipo_entrega ? `• ${p.tipo_entrega}` : ''}
                    </div>
                    <div className="text-[10px] lg:text-[11px] text-white/70 truncate">
                      {p.direccion ?? 'Sin dirección'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 lg:gap-4">
                  <div className="font-extrabold text-white/95 text-sm lg:text-base">{CLP.format(totalCalc)}</div>
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
              </button>

              {isOpen && (
                <div className="px-3 sm:px-4 lg:px-6 pb-3 lg:pb-5">
                  <div className="rounded-xl bg-white/8 border border-white/15 p-2 lg:p-3">
                    <button
                      onClick={() => setOpenDetail(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <Table size={16} />
                        <span className="font-semibold">Detalle Pedido</span>
                      </div>
                      {detOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    {detOpen && (
                      <div className="mt-3 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex justify-center">
                        <div className="overflow-x-auto w-full max-w-4xl">
                          <table className="w-full text-xs lg:text-sm text-white/95">
                            <thead className="bg-white/10 text-white/90">
                              <tr>
                                <th className="text-left px-3 py-2 w-[40%]">Artículo</th>
                                <th className="text-right px-3 py-2 w-[15%]">Can.</th>
                                <th className="text-right px-3 py-2 w-[20%]">Valor</th>
                                <th className="text-right px-3 py-2 w-[25%]">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                              {p.items?.length ? (
                                p.items.map((it, idx) => (
                                  <tr key={idx}>
                                    <td className="px-3 py-2 truncate">
                                      {it.articulo.length > 18 ? it.articulo.slice(0, 18) + '.' : it.articulo}
                                    </td>
                                    <td className="px-3 py-2 text-right">{it.qty}</td>
                                    <td className="px-3 py-2 text-right">{CLP.format(it.valor)}</td>
                                    <td className="px-3 py-2 text-right">{CLP.format(it.qty * it.valor)}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td className="px-3 py-4 text-center text-white/70" colSpan={4}>
                                    Sin artículos registrados.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                          <div className="px-3 py-3 bg-white/10 text-right font-extrabold text-white">
                            Total: {CLP.format(totalCalc)}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Foto solo lectura (no se sube en ENTREGAR) */}
                    {p.foto_url && !imageError[p.id] && (
                      <div className="mt-3 rounded-xl overflow-hidden bg-black/20 border border-white/10">
                        <div className="w-full bg-black/10 rounded-xl overflow-hidden border border-white/10">
                          <Image
                            src={p.foto_url}
                            alt={`Foto pedido ${p.id}`}
                            width={0}
                            height={0}
                            sizes="100vw"
                            style={{ width: '100%', height: 'auto', objectFit: 'contain', maxHeight: '70vh' }}
                            onError={() => setImageError(prev => ({ ...prev, [p.id]: true }))}
                            priority={false}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Acciones inferiores para ENTREGAR */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 px-4 sm:px-6 lg:px-10 pt-2 pb-4 backdrop-blur-md">
        <div className="mx-auto w-full rounded-2xl bg-white/10 border border-white/15 p-3">
          <div className="grid grid-cols-4 gap-3">
            <ActionBtn
              label="Maps"
              Icon={MapPinned}
              disabled={!pedidoAbierto}
              onClick={openMaps}
            />
            <ActionBtn
              label="Entregado"
              Icon={CheckCircle2}
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'ENTREGADO')}
              active={pedidoAbierto?.estado === 'ENTREGADO'}
            />
            <ActionBtn
              label={pedidoAbierto?.pagado ? 'Pago' : 'Pendiente'}
              Icon={Wallet}
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && togglePago(pedidoAbierto.id)}
              active={!!pedidoAbierto?.pagado}
            />
            <ActionBtn
              label="Volver"
              Icon={ArrowLeft}
              onClick={() => router.push('/base')}
            />
          </div>

          {pedidoAbierto ? (
            <div className="mt-2 text-center text-xs text-white/90">
              Pedido seleccionado: <b>#{pedidoAbierto.id}</b>{' '}
              {saving && (
                <span className="inline-flex items-center gap-1">
                  <Loader2 size={14} className="animate-spin" /> Guardando…
                </span>
              )}
            </div>
          ) : (
            <div className="mt-2 text-center text-xs text-white/70">Abre un pedido para habilitar las acciones.</div>
          )}
        </div>
      </nav>

      {notice && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg bg-black/70 text-white text-sm shadow">
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
        'rounded-xl py-3 text-sm font-medium border transition inline-flex items-center justify-center gap-2',
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
