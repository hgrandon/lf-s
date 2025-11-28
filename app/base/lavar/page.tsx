'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  User,
  Table,
  Loader2,
  AlertTriangle,
  Camera,
  ImagePlus,
  Truck,
  PackageCheck,
  Droplet,
  WashingMachine,
  CreditCard,
  Archive,
  CheckCircle2,
} from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

type Item = { articulo: string; qty: number; valor: number };
type PedidoEstado = 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGADO' | 'ENTREGAR';

type Pedido = {
  id: number; // nro
  cliente: string;
  total: number | null;
  estado: PedidoEstado;
  detalle?: string | null;
  foto_url?: string | null; // puede ser string o JSON con varias URLs
  fotos?: string[]; // lista de fotos para el slider
  pagado?: boolean | null;
  items?: Item[];
};

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

// SACA SOLO LA PRIMERA FOTO (por compatibilidad con pantallas antiguas)
function firstFotoFromMixed(input: unknown): string | null {
  const all = allFotosFromMixed(input);
  return all[0] ?? null;
}

// NUEVO: SACA TODAS LAS FOTOS POSIBLES DESDE string | JSON | array
function allFotosFromMixed(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
  }
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return [];
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) {
          return arr.filter((x: unknown): x is string => typeof x === 'string' && x.trim() !== '');
        }
      } catch {
        // si falla el JSON, lo tomamos como string simple
      }
    }
    return [s];
  }
  return [];
}

/* Pequeño contenedor para evitar que un error de render deje la pantalla en blanco */
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [err, setErr] = useState<Error | null>(null);
  if (err) {
    return (
      <div className="rounded-xl bg-red-500/15 border border-red-400/30 p-4 text-sm">
        <div className="font-semibold mb-1">Ocurrió un error al renderizar.</div>
        <div className="opacity-80">{String(err.message || err)}</div>
      </div>
    );
  }
  return (
    <div
      onErrorCapture={(e) => {
        e.preventDefault();
        setErr(new Error('Error de render capturado.'));
      }}
    >
      {children}
    </div>
  );
}

export default function LavarPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [openDetail, setOpenDetail] = useState<Record<number, boolean>>({});
  const [imageError, setImageError] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Picker / upload
  const [pickerForPedido, setPickerForPedido] = useState<number | null>(null);
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const inputCamRef = useRef<HTMLInputElement>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);

  // Modal “¿Desea editar?” al hacer doble clic en Total
  const [askEditForId, setAskEditForId] = useState<number | null>(null);

  // Índice de la foto actual por pedido (para el slider)
  const [currentSlide, setCurrentSlide] = useState<Record<number, number>>({});

  // NUEVO: timer para detectar la pulsación larga (3 segundos)
  const longPressTimer = useRef<number | null>(null);

  const pedidoAbierto = useMemo(() => pedidos.find((p) => p.id === openId) ?? null, [pedidos, openId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErrMsg(null);

        // Pedidos en LAVAR
        const { data: rows, error: e1 } = await supabase
          .from('pedido')
          .select('id:nro, telefono, total, estado, detalle, pagado, foto_url')
          .eq('estado', 'LAVAR')
          .order('nro', { ascending: true });

        if (e1) throw e1;

        const ids = (rows ?? []).map((r) => (r as any).id);
        const tels = (rows ?? []).map((r) => (r as any).telefono).filter(Boolean);

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
          .select('pedido_id, articulo, cantidad, valor')
          .in('pedido_id', ids);
        if (e2) throw e2;

        // Fotos (todas las filas de pedido_foto)
        const { data: fotos, error: e3 } = await supabase
          .from('pedido_foto')
          .select('pedido_id, url')
          .in('pedido_id', ids);
        if (e3) throw e3;

        // Clientes
        const { data: cli, error: e4 } = await supabase
          .from('clientes')
          .select('telefono, nombre')
          .in('telefono', tels);
        if (e4) throw e4;

        const nombreByTel = new Map<string, string>();
        (cli ?? []).forEach((c) => nombreByTel.set(String((c as any).telefono), (c as any).nombre ?? 'SIN NOMBRE'));

        const itemsByPedido = new Map<number, Item[]>();
        (lineas ?? []).forEach((l: any) => {
          const pid = Number(l.pedido_id ?? l.pedido_nro ?? l.nro);
          if (!pid) return;

          const label =
            String(l.articulo ?? l.nombre ?? l.descripcion ?? l.item ?? l.articulo_nombre ?? l.articulo_id ?? '')
              .trim() || 'SIN NOMBRE';

          const qty = Number(l.cantidad ?? l.qty ?? l.cantidad_item ?? 0);
          const valor = Number(l.valor ?? l.precio ?? l.monto ?? 0);

          const arr = itemsByPedido.get(pid) ?? [];
          arr.push({ articulo: label, qty, valor });
          itemsByPedido.set(pid, arr);
        });

        // Agrupar fotos por pedido desde tabla pedido_foto
        const fotosByPedido = new Map<number, string[]>();
        (fotos ?? []).forEach((f: any) => {
          const pid = Number(f.pedido_id ?? f.nro);
          const url = typeof f.url === 'string' ? f.url.trim() : '';
          if (!pid || !url) return;
          const arr = fotosByPedido.get(pid) ?? [];
          arr.push(url);
          fotosByPedido.set(pid, arr);
        });

        const mapped: Pedido[] = (rows ?? []).map((r: any) => {
          // fotos base que puedan venir en foto_url (string o JSON)
          const baseFotos = allFotosFromMixed(r.foto_url);
          const extra = fotosByPedido.get(r.id) ?? [];

          const fotosArr: string[] = [];
          baseFotos.forEach((u) => {
            if (u && !fotosArr.includes(u)) fotosArr.push(u);
          });
          extra.forEach((u) => {
            if (u && !fotosArr.includes(u)) fotosArr.push(u);
          });

          const principal = fotosArr[0] ?? firstFotoFromMixed(r.foto_url) ?? null;

          return {
            id: r.id,
            cliente: nombreByTel.get(String(r.telefono)) ?? String(r.telefono ?? 'SIN NOMBRE'),
            total: r.total ?? null,
            estado: r.estado,
            detalle: r.detalle ?? null,
            foto_url: principal,
            fotos: fotosArr,
            pagado: r.pagado ?? false,
            items: itemsByPedido.get(r.id) ?? [],
          };
        });

        mapped.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

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

  function snack(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 1800);
  }

  // Cambios de estado en Lavar
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

    // En Lavar, si pasa a otro estado lo sacamos de la lista
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

  // ------- Subida de foto -------
  function openPickerFor(pid: number) {
    setPickerForPedido(pid);
  }

  async function handlePick(kind: 'camera' | 'file') {
    if (!pickerForPedido) return;
    if (kind === 'camera') inputCamRef.current?.click();
    else inputFileRef.current?.click();
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    const pid = pickerForPedido;
    if (!pid) return setPickerForPedido(null);
    if (!file) return setPickerForPedido(null);

    try {
      setUploading((prev) => ({ ...prev, [pid]: true }));

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `pedido-${pid}/${Date.now()}.${ext}`;

      const { data: up, error: upErr } = await supabase.storage.from('fotos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('fotos').getPublicUrl(up!.path);
      const publicUrl = pub.publicUrl;

      const { error: insErr } = await supabase.from('pedido_foto').insert({ pedido_id: pid, url: publicUrl });
      if (insErr) throw insErr;

      // Obtener fotos actuales del pedido para actualizar JSON en foto_url
      const pedidoActual = pedidos.find((p) => p.id === pid);
      const fotosActuales = pedidoActual?.fotos ?? allFotosFromMixed(pedidoActual?.foto_url ?? null);
      const nuevasFotos = [...fotosActuales, publicUrl];

      // Guardamos la lista completa en foto_url como JSON
      await supabase.from('pedido').update({ foto_url: JSON.stringify(nuevasFotos) }).eq('nro', pid);

      // Actualizar estado local
      setPedidos((prev) =>
        prev.map((p) =>
          p.id === pid
            ? {
                ...p,
                foto_url: publicUrl,
                fotos: nuevasFotos,
              }
            : p,
        ),
      );
      setImageError((prev) => ({ ...prev, [pid]: false }));
      setCurrentSlide((prev) => ({ ...prev, [pid]: nuevasFotos.length - 1 }));
      snack(`Foto subida al pedido #${pid}`);
    } catch (err: any) {
      console.error(err);
      snack('No se pudo subir la foto.');
    } finally {
      setUploading((prev) => ({ ...prev, [pid!]: false }));
      setPickerForPedido(null);
    }
  }

  // ------- NUEVO: borrado de foto por pulsación larga (3 segundos) -------
  async function handleLongPressDelete(pedidoId: number, fotoUrl: string) {
    if (!pedidoId || !fotoUrl) return;

    try {
      // Intentar borrar del storage (si la URL es pública de Supabase)
      try {
        const urlObj = new URL(fotoUrl);
        const pathname = urlObj.pathname; // /storage/v1/object/public/fotos/...
        const marker = '/object/public/';
        const idx = pathname.indexOf(marker);
        if (idx >= 0) {
          let path = pathname.substring(idx + marker.length); // fotos/...
          if (path.startsWith('fotos/')) {
            path = path.substring('fotos/'.length); // solo ruta interna
          }
          if (path) {
            await supabase.storage.from('fotos').remove([path]);
          }
        }
      } catch (e) {
        console.warn('No se pudo borrar la imagen del bucket (no es URL de storage o falló el parseo).', e);
      }

      // Borrar de tabla pedido_foto
      await supabase.from('pedido_foto').delete().match({ pedido_id: pedidoId, url: fotoUrl });

      // Actualizar lista de fotos para el pedido
      const pedidoActual = pedidos.find((p) => p.id === pedidoId);
      const fotosActuales = pedidoActual?.fotos ?? allFotosFromMixed(pedidoActual?.foto_url ?? null);
      const nuevasFotos = fotosActuales.filter((u) => u !== fotoUrl);

      // Actualizar foto_url en pedido (JSON o null)
      await supabase
        .from('pedido')
        .update({ foto_url: nuevasFotos.length ? JSON.stringify(nuevasFotos) : null })
        .eq('nro', pedidoId);

      // Actualizar estado local
      setPedidos((prev) =>
        prev.map((p) =>
          p.id === pedidoId
            ? {
                ...p,
                fotos: nuevasFotos,
                foto_url: nuevasFotos[0] ?? null,
              }
            : p,
        ),
      );

      setCurrentSlide((prev) => {
        const next = { ...prev };
        if (!nuevasFotos.length) {
          delete next[pedidoId];
        } else {
          next[pedidoId] = Math.min(prev[pedidoId] ?? 0, nuevasFotos.length - 1);
        }
        return next;
      });

      setImageError((prev) => ({ ...prev, [pedidoId]: false }));

      snack(`Foto eliminada del pedido #${pedidoId}`);
    } catch (err) {
      console.error(err);
      snack('No se pudo eliminar la foto.');
    }
  }

  function startLongPress(pedidoId: number, fotoUrl: string | null) {
    if (!fotoUrl) return;
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
    }
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      // Ejecutar borrado
      void handleLongPressDelete(pedidoId, fotoUrl);
    }, 3000); // 3 segundos
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  // Slider: cambiar de foto
  function changeSlide(pedidoId: number, direction: -1 | 1) {
    const pedido = pedidos.find((p) => p.id === pedidoId);
    const fotos = pedido?.fotos ?? [];
    const total = fotos.length;
    if (!pedido || total <= 1) return;

    setCurrentSlide((prev) => {
      const current = prev[pedidoId] ?? 0;
      const next = (current + direction + total) % total;
      return { ...prev, [pedidoId]: next };
    });
  }

  // Modal de edición
  function askEdit(id: number) {
    setAskEditForId(id);
  }
  function closeAskEdit() {
    setAskEditForId(null);
  }
  function goEdit() {
    const id = askEditForId;
    if (!id) return;
    setAskEditForId(null);
    router.push(`/pedido/editar/${id}`);
  }

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
        <ErrorBoundary>
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

          {!loading && !errMsg && (Array.isArray(pedidos) ? pedidos.length === 0 : true) && (
            <div className="text-white/80">No hay pedidos en estado LAVAR.</div>
          )}

          {!loading &&
            !errMsg &&
            Array.isArray(pedidos) &&
            pedidos.map((p) => {
              const isOpen = openId === p.id;
              const detOpen = !!openDetail[p.id];
              const totalCalc =
                Array.isArray(p.items) && p.items.length ? p.items.reduce((a, it) => a + it.qty * it.valor, 0) : p.total ?? 0;

              const fotos = p.fotos && p.fotos.length ? p.fotos : p.foto_url ? [p.foto_url] : [];
              const totalFotos = fotos.length;
              const slideIndex =
                totalFotos > 0
                  ? Math.min(currentSlide[p.id] ?? 0, totalFotos - 1)
                  : 0;
              const activeFoto = totalFotos > 0 ? fotos[slideIndex] : null;

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
                      <span
                        className={[
                          'inline-flex items-center justify-center w-10 h-10 rounded-full border-2 shadow text-white/90',
                          p.pagado
                            ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]'
                            : 'bg-red-500 border-red-300 shadow-[0_0_0_3px_rgba(239,68,68,0.25)]',
                        ].join(' ')}
                        aria-label={p.pagado ? 'Pagado' : 'Pendiente'}
                      >
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
                      <div className="font-extrabold text-white/95 text-sm lg:text-base">{CLP.format(totalCalc)}</div>
                      {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-3 sm:px-4 lg:px-6 pb-3 lg:pb-5">
                      <div className="rounded-xl bg.white/8 border border-white/15 p-2 lg:p-3 bg-white/8">
                        <button
                          onClick={() => setOpenDetail((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
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
                            <div className="overflow-x-auto w.full max-w-4xl">
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
                                  {Array.isArray(p.items) && p.items.length ? (
                                    p.items.map((it, idx) => (
                                      <tr key={idx}>
                                        <td className="px-3 py-2 truncate">
                                          {it.articulo.length > 15 ? it.articulo.slice(0, 15) + '.' : it.articulo}
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

                              <div
                                className="px-3 py-3 bg-white/10 text-right font-extrabold text-white select-none cursor-pointer"
                                title="Doble clic para editar pedido"
                                onDoubleClick={() => askEdit(p.id)}
                              >
                                Total: {CLP.format(totalCalc)}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Galería de fotos */}
                        <div className="mt-3 rounded-xl overflow-hidden bg-black/20 border border-white/10">
                          {activeFoto && !imageError[p.id] ? (
                            <div
                              className="relative w-full bg-black/10 rounded-xl overflow-hidden border border-white/10 cursor-zoom-in"
                              onDoubleClick={() => openPickerFor(p.id)}
                              title="Doble clic para cambiar/agregar imagen"
                              onMouseDown={() => startLongPress(p.id, activeFoto)}
                              onMouseUp={cancelLongPress}
                              onMouseLeave={cancelLongPress}
                              onTouchStart={() => startLongPress(p.id, activeFoto)}
                              onTouchEnd={cancelLongPress}
                              onTouchCancel={cancelLongPress}
                            >
                              <Image
                                src={activeFoto}
                                alt={`Foto pedido ${p.id}`}
                                width={0}
                                height={0}
                                sizes="100vw"
                                style={{ width: '100%', height: 'auto', objectFit: 'contain', maxHeight: '70vh' }}
                                onError={() => setImageError((prev) => ({ ...prev, [p.id]: true }))}
                                priority={false}
                              />

                              {totalFotos > 1 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      cancelLongPress();
                                      changeSlide(p.id, -1);
                                    }}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-2 py-1 text-xs"
                                  >
                                    ◀
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      cancelLongPress();
                                      changeSlide(p.id, 1);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-2 py-1 text-xs"
                                  >
                                    ▶
                                  </button>
                                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[10px]">
                                    {slideIndex + 1} / {totalFotos}
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => openPickerFor(p.id)}
                              className="w-full p-6 text-sm text-white/80 hover:text-white hover:bg-white/5 transition flex items-center justify-center gap-2"
                              title="Agregar imagen"
                            >
                              <ImagePlus size={18} />
                              <span>{(uploading[p.id] ?? false) ? 'Subiendo…' : 'Sin imagen adjunta. Toca para agregar.'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </ErrorBoundary>
      </section>

      {/* Barra de acciones (Lavar) - sin botón "Lavar" */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 px-4 sm:px-6 lg:px-10 pt-2 pb-4 backdrop-blur-md">
        <div className="mx-auto w-full rounded-2xl bg-white/10 border border-white/15 p-3">
          <div className="grid grid-cols-5 gap-3">
            <IconBtn
              title="Lavando"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'LAVANDO')}
              active={pedidoAbierto?.estado === 'LAVANDO'}
              Icon={WashingMachine}
            />
            <IconBtn
              title="Guardardo"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'GUARDADO')}
              active={pedidoAbierto?.estado === 'GUARDADO'}
              Icon={CheckCircle2}
            />
            <IconBtn
              title="Entregar"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'ENTREGAR')}
              active={pedidoAbierto?.estado === 'ENTREGAR'}
              Icon={Truck}
            />
            <IconBtn
              title="Entregado"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'ENTREGADO')}
              active={pedidoAbierto?.estado === 'ENTREGADO'}
              Icon={PackageCheck}
            />
            <IconBtn
              title={pedidoAbierto?.pagado ? 'Pagado' : 'Pendiente de Pago'}
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && togglePago(pedidoAbierto.id)}
              active={!!pedidoAbierto?.pagado}
              Icon={CreditCard}
            />
          </div>

          {pedidoAbierto ? (
            <div className="mt-2 text-center text-xs text.white/90">
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

      {/* Modal “¿Desea editar?” */}
      {askEditForId && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-black/50"
          onClick={closeAskEdit}
          onKeyDown={(e) => e.key === 'Escape' && closeAskEdit()}
          tabIndex={-1}
        >
          <div
            className="w-[420px] max-w-[92vw] rounded-2xl bg-white p-4 text-violet-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-1">Editar pedido #{askEditForId}</h3>
            <p className="text-sm text-black/70 mb-4">¿Desea editar este pedido?</p>
            <div className="flex gap-2">
              <button onClick={goEdit} className="flex-1 rounded-xl bg-violet-600 text-white px-4 py-3 hover:bg-violet-700">
                Editar
              </button>
              <button
                onClick={closeAskEdit}
                className="flex-1 rounded-xl bg-violet-100 text-violet-800 px-4 py-3 hover:bg-violet-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para elegir cámara/archivo */}
      {pickerForPedido && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50">
          <div className="w-[420px] max-w-[92vw] rounded-2xl bg-white p-4 text-violet-800 shadow-2xl">
            <h3 className="text-lg font-semibold mb-3">Agregar imagen al pedido #{pickerForPedido}</h3>
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
              <button onClick={() => setPickerForPedido(null)} className="mt-1 rounded-xl px-3 py-2 text-sm hover:bg-violet-50">
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

function IconBtn({
  title,
  onClick,
  disabled,
  active,
  Icon,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      title={title}
      className={[
        'rounded-xl p-3 text-sm font-medium border transition inline-flex items-center justify-center',
        active ? 'bg-white/20 border-white/30 text-white' : 'bg-white/5 border-white/10 text-white/90 hover:bg-white/10',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <Icon size={18} />
    </button>
  );
}
