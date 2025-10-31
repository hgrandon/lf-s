'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, User, Table, Loader2, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

type Item = { articulo: string; qty: number; valor: number };
type Pedido = {
  id: number;
  cliente: string;
  total: number | null;
  estado: 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGADO';
  detalle?: string | null;
  foto_url?: string | null;
  pagado?: boolean | null;
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
      } catch {
        return null;
      }
    }
    return s;
  }
  if (Array.isArray(input) && input.length > 0 && typeof input[0] === 'string') return input[0] as string;
  return null;
}

export default function LavandoPage() {
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

        const { data: rows, error: e1 } = await supabase
          .from('pedido')
          .select('id:nro, telefono, total, estado, detalle, pagado, fotos_urls')
          .eq('estado', 'LAVANDO')
          .order('nro', { ascending: false });

        if (e1) throw e1;

        const ids = (rows ?? []).map(r => r.id);
        const tels = (rows ?? []).map(r => r.telefono).filter(Boolean);

        if (!rows?.length) {
          if (!cancelled) {
            setPedidos([]);
            setLoading(false);
          }
          return;
        }

        const { data: lineas } = await supabase.from('pedido_linea').select('*').in('nro', ids);
        const { data: fotos } = await supabase.from('pedido_foto').select('nro, url').in('nro', ids);
        const { data: cli } = await supabase.from('clientes').select('telefono, nombre').in('telefono', tels);

        const nombreByTel = new Map<string, string>();
        (cli ?? []).forEach(c => nombreByTel.set(String((c as any).telefono), (c as any).nombre ?? 'SIN NOMBRE'));

        const itemsByPedido = new Map<number, Item[]>();
        (lineas ?? []).forEach((l: any) => {
          const pid = Number(l.nro ?? l.pedido_id ?? l.pedido_nro);
          if (!pid) return;
          const label = String(l.articulo ?? l.nombre ?? '').trim() || 'SIN NOMBRE';
          const qty = Number(l.cantidad ?? l.qty ?? 0);
          const valor = Number(l.valor ?? l.precio ?? 0);
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
          if (!fotoByPedido.has(pid) && typeof f.url === 'string' && f.url)
            fotoByPedido.set(pid, f.url);
        });

        const mapped: Pedido[] = (rows ?? []).map((r: any) => ({
          id: r.id,
          cliente: nombreByTel.get(String(r.telefono)) ?? String(r.telefono ?? 'SIN NOMBRE'),
          total: r.total ?? null,
          estado: r.estado,
          detalle: r.detalle ?? null,
          foto_url: fotoByPedido.get(r.id) ?? null,
          pagado: r.pagado ?? false,
          items: itemsByPedido.get(r.id) ?? [],
        }));

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

  const subtotal = (it: Item) => it.qty * it.valor;
  function snack(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 1800);
  }

  async function changeEstado(id: number, next: Pedido['estado']) {
    if (!id) return;
    setSaving(true);
    const prev = pedidos;
    setPedidos(prev.map(p => (p.id === id ? { ...p, estado: next } : p)));
    const { error } = await supabase.from('pedido').update({ estado: next }).eq('nro', id);
    if (error) {
      console.error(error);
      setPedidos(prev);
      setSaving(false);
      return;
    }
    setPedidos(curr => curr.filter(p => p.id !== id));
    setOpenId(null);
    snack(`Pedido #${id} movido a ${next}`);
    setSaving(false);
  }

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-32">
      <header className="relative z-10 flex items-center justify-between px-4 lg:px-10 py-3 lg:py-5">
        <h1 className="font-bold text-base lg:text-xl">Lavando</h1>
        <button onClick={() => router.push('/base')} className="text-xs lg:text-sm text-white/90 hover:text-white">
          ← Volver
        </button>
      </header>

      <section className="relative z-10 w-full px-3 sm:px-6 lg:px-10 grid gap-4">
        {loading && <div className="flex items-center gap-2"><Loader2 className="animate-spin" /> Cargando pedidos…</div>}
        {!loading && errMsg && <div className="bg-red-500/20 p-3 rounded-xl">{errMsg}</div>}

        {pedidos.map(p => {
          const isOpen = openId === p.id;
          const totalCalc = p.items?.length ? p.items.reduce((a, it) => a + subtotal(it), 0) : p.total ?? 0;
          return (
            <div key={p.id} className="rounded-2xl bg-white/10 border border-white/15 shadow-lg">
              <button onClick={() => setOpenId(isOpen ? null : p.id)} className="w-full flex justify-between px-4 py-3">
                <div className="flex gap-3 items-center">
                  <User size={18} />
                  <div>
                    <div className="font-bold">N° {p.id}</div>
                    <div className="text-xs">{p.cliente} • {p.pagado ? 'PAGADO' : 'PENDIENTE'}</div>
                  </div>
                </div>
                <div className="flex gap-3 items-center">
                  <div className="font-bold">{CLP.format(totalCalc)}</div>
                  {isOpen ? <ChevronDown /> : <ChevronRight />}
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4">
                  <div className="rounded-xl overflow-hidden bg-black/20 border border-white/10">
                    {p.foto_url && !imageError[p.id] ? (
                      <div className="w-full bg-black/10 rounded-xl overflow-hidden border border-white/10">
                        <Image
                          src={p.foto_url}
                          alt={`Foto pedido ${p.id}`}
                          width={0}
                          height={0}
                          sizes="100vw"
                          style={{ width: '100%', height: 'auto', objectFit: 'contain', maxHeight: '70vh' }}
                          onError={() => setImageError(prev => ({ ...prev, [p.id]: true }))}
                        />
                      </div>
                    ) : (
                      <div className="p-6 text-sm text-white/70">Sin imagen adjunta.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <nav className="fixed bottom-0 left-0 right-0 z-20 px-4 sm:px-6 lg:px-10 pt-2 pb-4 backdrop-blur-md">
        <div className="mx-auto w-full rounded-2xl bg-white/10 border border-white/15 p-3">
          <div className="grid grid-cols-4 gap-3">
            <ActionBtn label="Guardar" disabled={!pedidoAbierto || saving} onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'GUARDAR')} />
            <ActionBtn label="Guardado" disabled={!pedidoAbierto || saving} onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'GUARDADO')} />
            <ActionBtn label="Entregar" disabled={!pedidoAbierto || saving} onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'ENTREGADO')} />
            <ActionBtn label={pedidoAbierto?.pagado ? 'Pago' : 'Pendiente'} disabled={!pedidoAbierto || saving} onClick={() => pedidoAbierto && snack('Función pago pronto')} active={!!pedidoAbierto?.pagado} />
          </div>
        </div>
      </nav>
    </main>
  );
}

function ActionBtn({ label, onClick, disabled, active }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'rounded-xl py-3 text-sm font-medium border transition',
        active
          ? 'bg-white/20 border-white/30 text-white'
          : 'bg-white/5 border-white/10 text-white/90 hover:bg-white/10',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
