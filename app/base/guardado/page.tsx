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
  MessageCircle,
} from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import html2canvas from 'html2canvas';

type Item = { articulo: string; qty: number; valor: number };
type PedidoEstado = 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGADO' | 'ENTREGAR';

type Pedido = {
  id: number;         // nro
  cliente: string;    // nombre o teléfono
  telefono?: string | null;
  total: number | null;
  estado: PedidoEstado;
  detalle?: string | null;
  foto_url?: string | null;
  pagado?: boolean | null;
  items?: Item[];
};

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

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

export default function GuardadoPage() {
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

  // Modal “¿Desea editar?”
  const [askEditForId, setAskEditForId] = useState<number | null>(null);

  // Ref de tarjeta por pedido (para captura con html2canvas)
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const pedidoAbierto = useMemo(() => pedidos.find((p) => p.id === openId) ?? null, [pedidos, openId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErrMsg(null);

        // Pedidos en GUARDADO
        const { data: rows, error: e1 } = await supabase
          .from('pedido')
          .select('id:nro, telefono, total, estado, detalle, pagado, foto_url')
          .eq('estado', 'GUARDADO')
          .order('nro', { ascending: false });

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

        // Líneas de pedido
        const { data: lineas, error: e2 } = await supabase
          .from('pedido_linea')
          .select('pedido_id, articulo, cantidad, valor')
          .in('pedido_id', ids);
        if (e2) throw e2;

        // Fotos (fallback)
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
        (cli ?? []).forEach((c) => nombreByTel.set(String((c as any).telefono), (c as any).nombre ?? ''));

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

        // Foto principal (prioriza pedido.foto_url)
        const fotoByPedido = new Map<number, string>();
        (rows ?? []).forEach((r: any) => {
          const f = firstFotoFromMixed(r.foto_url);
          if (f) fotoByPedido.set(r.id, f);
        });
        (fotos ?? []).forEach((f: any) => {
          const pid = Number(f.pedido_id ?? f.nro);
          if (!fotoByPedido.has(pid) && typeof f.url === 'string' && f.url) {
            fotoByPedido.set(pid, f.url);
          }
        });

        const mapped: Pedido[] = (rows ?? []).map((r: any) => {
          const tel = r.telefono ? String(r.telefono) : null;
          const nombre = tel ? (nombreByTel.get(tel) || '') : '';
          return {
            id: r.id,
            cliente: nombre || tel || 'SIN NOMBRE',
            telefono: tel,
            total: r.total ?? null,
            estado: r.estado,
            detalle: r.detalle ?? null,
            foto_url: fotoByPedido.get(r.id) ?? null,
            pagado: r.pagado ?? false,
            items: itemsByPedido.get(r.id) ?? [],
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

  function snack(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 1800);
  }

  // Cambios de estado
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

    // Al mover desde GUARDADO a otro estado, lo sacamos de la lista
    if (next !== 'GUARDADO') {
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

  // ------- Mensaje de WhatsApp (texto) -------
  function buildWhatsAppMessage(p: Pedido) {
    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos días' : 'Buenas tardes';
    const totalCalc =
      p.items?.length ? p.items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.valor) || 0), 0) : Number(p.total || 0);

    const detalle =
      p.items && p.items.length
        ? p.items
            .map((i) => `${i.articulo} x${i.qty} = ${new Intl.NumberFormat('es-CL').format((i.qty || 0) * (i.valor || 0))}`)
            .join('\n')
        : 'Sin detalle';

    return `
${saludo} ${p.cliente} 👋
Tu servicio N° ${p.id} está LISTO ✅

🧺 *Detalle del pedido:*
${detalle}

💵 *Total:* ${CLP.format(totalCalc)}
📍 Retiro en Periodista Mario Peña Carreño #5304
🕐 Atención Lunes a Viernes 10:00 a 20:00 hrs.
💬 Gracias por preferir *Lavandería Fabiola* 💜`.trim();
  }

  // ------- Compartir comprobante por WhatsApp (imagen + texto si es posible) -------
  async function shareComprobanteWhatsApp(p?: Pedido | null) {
    if (!p) return;

    const el = cardRefs.current[p.id];
    if (!el) {
      snack('Abre el pedido y vuelve a intentar.');
      return;
    }

    try {
      const canvas = await html2canvas(el, {
        backgroundColor: '#6D28D9', // respaldo para fondos semitransparentes (violeta)
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
      const text = buildWhatsAppMessage(p);
      const telefono = (p.telefono || '').replace(/\D/g, '') || '56991335828'; // fallback fijo

      // Intento de compartir (móviles modernos)
      if (blob && (navigator as any).canShare?.({ files: [new File([blob], 'comprobante.png', { type: 'image/png' })] })) {
        const file = new File([blob], `comprobante-${p.id}.png`, { type: 'image/png' });
        try {
          await (navigator as any).share({ files: [file], text });
          return;
        } catch {
          // Si cancelan o falla, seguimos al fallback
        }
      }

      // Fallback: descargar imagen y abrir WhatsApp con texto
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comprobante-${p.id}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }

      const waUrl = `https://wa.me/${telefono}?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
    } catch (e) {
      console.error(e);
      snack('No se pudo generar la imagen del comprobante.');
    }
  }

  // ------- Cargar/Adjuntar foto -------
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
    if (!pid) {
      setPickerForPedido(null);
      return;
    }
    if (!file) {
      setPickerForPedido(null);
      return;
    }

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

      // Guarda relación y setea como foto principal del pedido
      const { error: insErr } = await supabase.from('pedido_foto').insert({ pedido_id: pid, url: publicUrl });
      if (insErr) throw insErr;

      await supabase.from('pedido').update({ foto_url: publicUrl }).eq('nro', pid);

      setPedidos((prev) => prev.map((p) => (p.id === pid ? { ...p, foto_url: publicUrl } : p)));
      setImageError((prev) => ({ ...prev, [pid]: false }));
      snack(`Foto subida al pedido #${pid}`);
    } catch (err: any) {
      console.error(err);
      snack('No se pudo subir la foto.');
    } finally {
      setUploading((prev) => ({ ...prev, [pid!]: false }));
      setPickerForPedido(null);
    }
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
        <h1 className="font-bold text-base lg:text-xl">Guardado</h1>
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
          <div className="text-white/80">No hay pedidos en estado GUARDADO.</div>
        )}

        {!loading &&
          !errMsg &&
          pedidos.map((p) => {
            const isOpen = openId === p.id;
            const detOpen = !!openDetail[p.id];
            const totalCalc =
              p.items?.length ? p.items.reduce((a, it) => a + it.qty * it.valor, 0) : Number(p.total ?? 0);

            return (
              <div
                key={p.id}
                ref={(el) => { cardRefs.current[p.id] = el; }}
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
                    <div className="rounded-xl bg-white/8 border border-white/15 p-2 lg:p-3">
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
                                        {it.articulo.length > 30 ? it.articulo.slice(0, 30) + '…' : it.articulo}
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

                      <div className="mt-3 rounded-xl overflow-hidden bg-black/20 border border-white/10">
                        {p.foto_url && !imageError[p.id] ? (
                          <div
                            className="w-full bg-black/10 rounded-xl overflow-hidden border border-white/10 cursor-zoom-in"
                            onDoubleClick={() => openPickerFor(p.id)}
                            title="Doble clic para cambiar la imagen"
                          >
                            <Image
                              src={p.foto_url!}
                              alt={`Foto pedido ${p.id}`}
                              width={0}
                              height={0}
                              sizes="100vw"
                              style={{ width: '100%', height: 'auto', objectFit: 'contain', maxHeight: '70vh' }}
                              onError={() => setImageError((prev) => ({ ...prev, [p.id]: true }))}
                              priority={false}
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => openPickerFor(p.id)}
                            className="w-full p-6 text-sm text-white/80 hover:text-white hover:bg-white/5 transition flex items-center justify-center gap-2"
                            title="Agregar imagen"
                          >
                            <ImagePlus size={18} />
                            <span>{uploading[p.id] ? 'Subiendo…' : 'Sin imagen adjunta. Toca para agregar.'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </section>

      {/* Barra de acciones */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 px-4 sm:px-6 lg:px-10 pt-2 pb-4 backdrop-blur-md" data-no-print="true">
        <div className="mx-auto w-full rounded-2xl bg-white/10 border border-white/15 p-3">
          <div className="grid grid-cols-6 gap-3">
            <IconBtn
              title="WhatsApp"
              disabled={!pedidoAbierto || saving}
              onClick={() => shareComprobanteWhatsApp(pedidoAbierto)}
              Icon={MessageCircle}
              variant="success"
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
              title="Lavar"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'LAVAR')}
              active={pedidoAbierto?.estado === 'LAVAR'}
              Icon={Droplet}
            />
            <IconBtn
              title="Lavando"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'LAVANDO')}
              active={pedidoAbierto?.estado === 'LAVANDO'}
              Icon={WashingMachine}
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
  variant,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  variant?: 'success' | 'default';
}) {
  const base =
    'rounded-xl p-3 text-sm font-medium border transition inline-flex items-center justify-center';
  const styles =
    variant === 'success'
      ? 'bg-emerald-600/80 border-emerald-300/40 text-white hover:bg-emerald-600'
      : active
      ? 'bg-white/20 border-white/30 text-white'
      : 'bg-white/5 border-white/10 text-white/90 hover:bg-white/10';
  const dis = disabled ? 'opacity-50 cursor-not-allowed' : '';
  return (
    <button onClick={onClick} disabled={disabled} aria-label={title} title={title} className={[base, styles, dis].join(' ')}>
      <Icon size={18} />
    </button>
  );
}
