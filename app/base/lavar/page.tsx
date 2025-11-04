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
} from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

type PedidoEstado = 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGADO';

type Pedido = {
  id: number;            // nro
  cliente: string;       // telefono o nombre si lo incluyes en la vista
  total: number | null;
  estado: PedidoEstado;
  foto_url?: string | null;
  pagado?: boolean | null;
  items_count?: number | null;
  items_text?: string | null; // resumen legible
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
  const [openDetail, setOpenDetail] = useState<Record<number, boolean>>({});
  const [imageError, setImageError] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // picker de foto
  const [pickerForPedido, setPickerForPedido] = useState<number | null>(null);
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const inputCamRef = useRef<HTMLInputElement>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);

  const pedidoAbierto = useMemo(
    () => pedidos.find((p) => p.id === openId) ?? null,
    [pedidos, openId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErrMsg(null);

        // Vista alineada a tu estructura actual
        const { data, error } = await supabase
          .from('vw_pedido_resumen')
          .select('nro, telefono, total, estado, pagado, items_count, items_text, foto_url')
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
    e.target.value = ''; // reset para permitir mismo archivo luego
    const pid = pickerForPedido;
    if (!file || !pid) {
      cerrarPicker();
      return;
    }

    try {
      setUploading((prev) => ({ ...prev, [pid]: true }));

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `pedido/${pid}/${Date.now()}.${ext}`;

      // bucket correcto según tu esquema actual
      const up = await supabase.storage.from('imagenes').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (up.error) throw up.error;

      const pub = supabase.storage.from('imagenes').getPublicUrl(path);
      const publicUrl = pub.data?.publicUrl;
      if (!publicUrl) throw new Error('No se obtuvo URL pública');

      // registra en pedido_foto: (pedido_id, foto_url)
      const ins = await supabase.from('pedido_foto').insert({ pedido_id: pid, foto_url: publicUrl });
      if (ins.error) throw ins.error;

      // refresco local
      setPedidos((prev) => prev.map((p) => (p.id === pid ? { ...p, foto_url: publicUrl } : p)));
      setImageError((prev) => ({ ...prev, [pid]: false }));
      snack(`Foto subida al pedido #${pid}`);
    } catch (err) {
      console.error(err);
      snack('No se pudo subir la foto.');
    } finally {
      setUploading((prev) => ({ ...prev, [pid!]: false }));
      cerrarPicker(); // se cierra automáticamente
    }
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
            const detOpen = !!openDetail[p.id];

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
                    <div className="rounded-xl bg-white/8 border border-white/15 p-2 lg:p-3">
                      <button
                        onClick={() =>
                          setOpenDetail((prev) => ({
                            ...prev,
                            [p.id]: !prev[p.id],
                          }))
                        }
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center gap-2">
                          <Table size={16} />
                          <span className="font-semibold">
                            Detalle Pedido {p.items_count != null ? `(${p.items_count})` : ''}
                          </span>
                        </div>
                        {detOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>

                      {detOpen && (
                        <div className="mt-3 rounded-xl bg-white/5 border border-white/10 p-3 text-sm leading-6">
                          {p.items_text || <span className="opacity-70">Sin detalle disponible.</span>}
                        </div>
                      )}

                      <div className="mt-3 rounded-xl overflow-hidden bg-black/20 border border-white/10">
                        {p.foto_url && !imageError[p.id] ? (
                          <div
                            className="w-full bg-black/10 rounded-xl overflow-hidden border border-white/10 cursor-pointer"
                            onDoubleClick={() => abrirPicker(p.id)}
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
                            onClick={() => abrirPicker(p.id)}
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

      {/* Modal simple para elegir origen de la imagen */}
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
