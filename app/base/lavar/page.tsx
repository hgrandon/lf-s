'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  User,
  Loader2,
  AlertTriangle,
  Camera,
  ImagePlus,
  Table,
} from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

type PedidoEstado = 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGADO';

type Linea = {
  articulo?: string;
  nombre?: string;
  qty?: number;
  cantidad?: number;
  valor?: number;
  precio?: number;
  estado?: string | null;
};

type Pedido = {
  id: number;
  cliente: string;
  total: number | null;
  estado: PedidoEstado;
  foto_url?: string | null;
  pagado?: boolean | null;
  items_count?: number | null;
  items_text?: string | null;
  detalle_lineas?: Linea[] | null;
};

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export default function LavarPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [imageError, setImageError] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Foto (picker)
  const [pickerForPedido, setPickerForPedido] = useState<number | null>(null);
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const inputCamRef = useRef<HTMLInputElement>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);

  // Fallback de detalle si la vista no lo trae
  const [detallesMap, setDetallesMap] = useState<Record<number, Linea[]>>({});
  const [detLoading, setDetLoading] = useState<Record<number, boolean>>({});

  const pedidoAbierto = useMemo(
    () => pedidos.find((p) => p.id === openId) ?? null,
    [pedidos, openId]
  );

  // Carga inicial (vista)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErrMsg(null);

        const { data, error } = await supabase
          .from('vw_pedido_resumen')
          .select(
            'nro, telefono, total, estado, pagado, items_count, items_text, foto_url, detalle_lineas'
          )
          .eq('estado', 'LAVAR')
          .order('nro', { ascending: false });

        if (error) throw error;

        const mapped: Pedido[] = (data ?? []).map((r: any) => ({
          id: Number(r.nro),
          cliente: String(r.telefono ?? 'SIN NOMBRE'),
          total: r.total ?? null,
          estado: r.estado as PedidoEstado,
          foto_url: r.foto_url ?? null,
          pagado: !!r.pagado,
          items_count: r.items_count ?? null,
          items_text: r.items_text ?? null,
          detalle_lineas: Array.isArray(r.detalle_lineas) ? r.detalle_lineas : null,
        }));

        if (!cancelled) {
          setPedidos(mapped);
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setErrMsg(err?.message ?? 'Error al cargar pedidos');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cuando abres un pedido: si no hay detalle en la vista, traerlo desde pedido_linea
  useEffect(() => {
    if (!openId) return;
    const yaTengo = detallesMap[openId];
    const enVista = pedidos.find((p) => p.id === openId)?.detalle_lineas;
    if ((enVista && enVista.length) || yaTengo?.length) return;
    ensureDetalle(openId).catch(() => {});
  }, [openId, pedidos]);

  async function ensureDetalle(pedidoId: number) {
    try {
      setDetLoading((s) => ({ ...s, [pedidoId]: true }));
      const { data, error } = await supabase
        .from('pedido_linea')
        .select('cantidad, valor, estado, articulo:articulo_id(nombre)')
        .eq('pedido_id', pedidoId)
        .order('id', { ascending: true });

      if (error) throw error;

      const rows: Linea[] =
        (data ?? []).map((r: any) => ({
          cantidad: Number(r.cantidad ?? 0),
          valor: Number(r.valor ?? 0),
          estado: r.estado ?? 'LAVAR',
          nombre: r?.articulo?.nombre ?? '—',
        })) ?? [];

      setDetallesMap((m) => ({ ...m, [pedidoId]: rows }));
    } catch (e) {
      console.error('No se pudo cargar detalle fallback', e);
    } finally {
      setDetLoading((s) => ({ ...s, [pedidoId]: false }));
    }
  }

  function snack(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 1600);
  }

  async function changeEstado(id: number, next: PedidoEstado) {
    if (!id) return;
    setSaving(true);
    const prev = pedidos;
    setPedidos(prev.map((p) => (p.id === id ? { ...p, estado: next } : p)));

    const { error } = await supabase.from('pedido').update({ estado: next }).eq('nro', id);
    if (error) {
      console.error('No se pudo actualizar estado:', error);
      setPedidos(prev);
      setSaving(false);
      return;
    }

    if (next !== 'LAVAR') {
      setPedidos((curr) => curr.filter((p) => p.id !== id));
      setOpenId(null);
      snack(`Pedido #${id} movido a ${next}`);
    }
    setSaving(false);
  }

  async function togglePago(id: number) {
    if (!id) return;
    setSaving(true);
    const prev = pedidos;
    const actual = prev.find((p) => p.id === id)?.pagado ?? false;
    setPedidos(prev.map((p) => (p.id === id ? { ...p, pagado: !actual } : p)));

    const { error } = await supabase.from('pedido').update({ pagado: !actual }).eq('nro', id);
    if (error) {
      console.error('No se pudo actualizar pago:', error);
      setPedidos(prev);
      setSaving(false);
      return;
    }
    snack(`Pedido #${id} marcado como ${!actual ? 'Pagado' : 'Pendiente'}`);
    setSaving(false);
  }

  // ---------- Subida/registro de foto ----------
  function abrirPicker(nro: number) {
    setPickerForPedido(nro);
  }
  function cerrarPicker() {
    setPickerForPedido(null);
  }

  async function handlePick(kind: 'camera' | 'file') {
    if (!pickerForPedido) return;
    if (kind === 'camera') inputCamRef.current?.click();
    else inputFileRef.current?.click();
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const pid = pickerForPedido;
    if (!file || !pid) {
      cerrarPicker();
      return;
    }

    try {
      setUploading((prev) => ({ ...prev, [pid]: true }));

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `pedido/${pid}/${Date.now()}.${ext}`;

      const up = await supabase.storage.from('imagenes').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (up.error) throw up.error;

      const pub = supabase.storage.from('imagenes').getPublicUrl(path);
      const publicUrl = pub.data?.publicUrl;
      if (!publicUrl) throw new Error('No se obtuvo URL pública');

      const ins = await supabase.from('pedido_foto').insert({ pedido_id: pid, foto_url: publicUrl });
      if (ins.error) throw ins.error;

      setPedidos((prev) => prev.map((p) => (p.id === pid ? { ...p, foto_url: publicUrl } : p)));
      setImageError((prev) => ({ ...prev, [pid]: false }));
      snack(`Foto subida al pedido #${pid}`);
    } catch (err) {
      console.error(err);
      snack('No se pudo subir la foto.');
    } finally {
      setUploading((prev) => ({ ...prev, [pid!]: false }));
      cerrarPicker();
    }
  }

  // helpers de tabla
  const qtyOf = (l?: Linea) => Number(l?.qty ?? l?.cantidad ?? 0);
  const valOf = (l?: Linea) => Number(l?.valor ?? l?.precio ?? 0);
  const artOf = (l?: Linea) => String(l?.articulo ?? l?.nombre ?? '—');
  const estOf = (l?: Linea) => (l?.estado ? String(l.estado) : 'LAVAR');

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      <header className="relative z-10 flex items-center justify-between px-4 lg:px-10 py-3 lg:py-5">
        <h1 className="font-bold text-base lg:text-xl">Lavar</h1>
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
          <div className="text-white/80">No hay pedidos en estado LAVAR.</div>
        )}

        {!loading &&
          !errMsg &&
          pedidos.map((p) => {
            const isOpen = openId === p.id;
            const lineasVista = Array.isArray(p.detalle_lineas) ? p.detalle_lineas : null;
            const lineasFallback = detallesMap[p.id];
            const lineas = lineasVista?.length ? lineasVista : lineasFallback ?? null;

            return (
              <div
                key={p.id}
                className={[
                  'rounded-2xl bg-white/10 border backdrop-blur-md shadow-[0_6px_20px_rgba(0,0,0,0.15)]',
                  isOpen ? 'border-white/40' : 'border-white/15',
                ].join(' ')}
              >
                {/* Cabecera */}
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
                        {p.cliente} {p.pagado ? '• PAGADO' : '• PENDIENTE'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 lg:gap-4">
                    <div className="font-extrabold text-white/95 text-sm lg:text-base">
                      {CLP.format(p.total ?? 0)}
                    </div>
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-3 sm:px-4 lg:px-6 pb-3 lg:pb-5">
                    <div className="rounded-xl bg-white/8 border border-white/15 p-2 lg:p-3 space-y-3">
                      {/* IMAGEN (sin cabecera/abanico) */}
                      <div className="rounded-xl overflow-hidden bg-black/20 border border-white/10">
                        {p.foto_url && !imageError[p.id] ? (
                          <div
                            className="bg-black/10 rounded-xl overflow-hidden border border-white/10 cursor-zoom-in"
                            onDoubleClick={() => abrirPicker(p.id)}
                            title="Doble clic para cambiar la imagen"
                          >
                            <Image
                              src={p.foto_url}
                              alt={`Foto pedido ${p.id}`}
                              width={0}
                              height={0}
                              sizes="100vw"
                              style={{ width: '100%', height: 'auto', objectFit: 'contain', maxHeight: '70vh' }}
                              onError={() => setImageError((prev) => ({ ...prev, [p.id]: true }))}
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => abrirPicker(p.id)}
                            className="w-full p-6 text-sm text-white/80 hover:text-white hover:bg-white/5 transition flex items-center justify-center gap-2"
                          >
                            <Camera size={18} />
                            <span>{uploading[p.id] ? 'Subiendo…' : 'Sin imagen adjunta. Toca para agregar.'}</span>
                          </button>
                        )}
                      </div>

                      {/* DETALLE (grilla SIEMPRE visible) */}
                      <div className="rounded-xl overflow-hidden bg-white/5 border border-white/10 flex justify-center">
                        <div className="overflow-x-auto w-full max-w-4xl">
                          <div className="px-3 py-2 flex items-center gap-2 text-white/90 bg-white/10">
                            <Table size={16} />
                            <span className="font-semibold">
                              Detalle Pedido {p.items_count != null ? `(${p.items_count})` : ''}
                            </span>
                          </div>

                          {detLoading[p.id] ? (
                            <div className="p-4 text-sm flex items-center gap-2">
                              <Loader2 className="animate-spin" size={16} /> Cargando detalle…
                            </div>
                          ) : lineas && lineas.length ? (
                            <>
                              <table className="w-full text-[13px] lg:text-sm text-white/95">
                                <thead className="bg-violet-200/90 text-violet-900">
                                  <tr className="font-semibold">
                                    <th className="text-left px-3 py-2 w-[44%]">Artículo</th>
                                    <th className="text-center px-3 py-2 w-[12%]">Cantidad</th>
                                    <th className="text-right px-3 py-2 w-[14%]">Valor</th>
                                    <th className="text-right px-3 py-2 w-[18%]">Subtotal</th>
                                    <th className="text-left px-3 py-2 w-[12%]">Estado</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10 bg-white/5">
                                  {lineas.map((l, i) => {
                                    const q = qtyOf(l);
                                    const v = valOf(l);
                                    const sub = q * v;
                                    const art = artOf(l);
                                    const est = estOf(l);
                                    return (
                                      <tr key={i}>
                                        <td className="px-3 py-2">{art}</td>
                                        <td className="px-3 py-2 text-center">{q}</td>
                                        <td className="px-3 py-2 text-right">{CLP.format(v)}</td>
                                        <td className="px-3 py-2 text-right">{CLP.format(sub)}</td>
                                        <td className="px-3 py-2">{est}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>

                              <div className="px-4 py-3 bg-violet-200/70 text-violet-900">
                                <span className="font-medium">Total:</span>{' '}
                                <span className="font-extrabold text-violet-800 text-[20px] align-middle">
                                  {CLP.format(p.total ?? 0)}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="p-3 text-sm leading-6">
                              {p.items_text || <span className="opacity-70">Sin detalle disponible.</span>}
                              <div className="mt-3 bg-violet-200/70 text-violet-900 px-4 py-3">
                                <span className="font-medium">Total:</span>{' '}
                                <span className="font-extrabold text-violet-800 text-[20px] align-middle">
                                  {CLP.format(p.total ?? 0)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </section>

      <nav className="fixed bottom-0 left-0 right-0 z-20 px-4 sm:px-6 lg:px-10 pt-2 pb-4 backdrop-blur-md">
        <div className="mx-auto w-full rounded-2xl bg-white/10 border border-white/15 p-3">
          <div className="grid grid-cols-5 gap-3">
            <ActionBtn
              label="Lavando"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'LAVANDO')}
              active={pedidoAbierto?.estado === 'LAVANDO'}
            />
            <ActionBtn
              label="Guardado"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'GUARDADO')}
              active={pedidoAbierto?.estado === 'GUARDADO'}
            />
            <ActionBtn
              label="Entregar"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'GUARDAR')}
              active={pedidoAbierto?.estado === 'GUARDAR'}
            />
            <ActionBtn
              label="Entregado"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'ENTREGADO')}
              active={pedidoAbierto?.estado === 'ENTREGADO'}
            />
            <ActionBtn
              label={pedidoAbierto?.pagado ? 'Pago' : 'Pendiente'}
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && togglePago(pedidoAbierto.id)}
              active={!!pedidoAbierto?.pagado}
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

      {/* Modal: elegir origen de la imagen */}
      {pickerForPedido && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50">
          <div className="w-[420px] max-w-[92vw] rounded-2xl bg-white p-4 text-violet-800 shadow-2xl">
            <h3 className="text-lg font-semibold mb-3">
              Agregar imagen al pedido #{pickerForPedido}
            </h3>
            <div className="grid gap-2">
              <button
                onClick={() => handlePick('camera')}
                className="flex items-center gap-2 rounded-xl bg-violet-600 text-white px-4 py-3 hover:bg-violet-700"
              >
                <Camera size={18} />
                Sacar foto
              </button>
              <button
                onClick={() => handlePick('file')}
                className="flex items-center gap-2 rounded-xl bg-violet-100 text-violet-800 px-4 py-3 hover:bg-violet-200"
              >
                <ImagePlus size={18} />
                Buscar en archivos
              </button>
              <button onClick={cerrarPicker} className="mt-1 rounded-xl px-3 py-2 text-sm hover:bg-violet-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* inputs ocultos */}
      <input
        ref={inputCamRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileSelected}
      />
      <input ref={inputFileRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
    </main>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  active,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'rounded-xl py-3 text-sm font-medium border transition',
        active ? 'bg-white/20 border-white/30 text-white' : 'bg-white/5 border-white/10 text-white/90 hover:bg-white/10',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
