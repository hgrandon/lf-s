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

/* =========================
   Config adaptable
========================= */
const STORAGE_BUCKET = 'fotos';
const PEDIDO_FOTO_TABLE = 'pedido_foto';
const FOTO_COL_VARIANTS = [
  { pedidoCol: 'nro', urlCol: 'url' },
  { pedidoCol: 'pedido_id', urlCol: 'foto_url' },
] as const;

/* =========================
   Tipos
========================= */
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
  telefono: string | null;
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

const qtyOf = (l?: Linea) => Number(l?.qty ?? l?.cantidad ?? 0);
const valOf = (l?: Linea) => Number(l?.valor ?? l?.precio ?? 0);
const artOf = (l?: Linea) => String(l?.articulo ?? l?.nombre ?? '—');
const estOf = (l?: Linea) => (l?.estado ? String(l.estado) : 'LAVAR');

function computeTotalFrom(lineas?: Linea[] | null, fallback?: number | null) {
  if (lineas && lineas.length) {
    return lineas.reduce((a, l) => a + qtyOf(l) * valOf(l), 0);
  }
  return fallback ?? 0;
}

/* =========================
   Página principal
========================= */
export default function LavarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [imageError, setImageError] = useState<Record<number, boolean>>({});
  const [pickerForPedido, setPickerForPedido] = useState<number | null>(null);
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const inputCamRef = useRef<HTMLInputElement>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);

  const [detallesMap, setDetallesMap] = useState<Record<number, Linea[]>>({});
  const [detLoading, setDetLoading] = useState<Record<number, boolean>>({});
  const [nombresByTel, setNombresByTel] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pedidoAbierto = useMemo(() => pedidos.find((p) => p.id === openId) ?? null, [pedidos, openId]);

  /* =========================
     Carga inicial
  ========================= */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
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
          telefono: r.telefono ?? null,
          cliente: String(r.telefono ?? 'SIN NOMBRE'),
          total: r.total ?? null,
          estado: r.estado as PedidoEstado,
          foto_url: r.foto_url ?? null,
          pagado: !!r.pagado,
          items_count: r.items_count ?? null,
          items_text: r.items_text ?? null,
          detalle_lineas: Array.isArray(r.detalle_lineas) ? r.detalle_lineas : null,
        }));

        setPedidos(mapped);

        // Resolver nombres de clientes
        const telefonos = [...new Set((data ?? []).map((r: any) => String(r.telefono ?? '')).filter(Boolean))];
        if (telefonos.length) {
          const { data: cli } = await supabase
            .from('clientes')
            .select('telefono, nombre')
            .in('telefono', telefonos);
          const map: Record<string, string> = {};
          cli?.forEach((c: any) => (map[String(c.telefono)] = String(c.nombre ?? '')));
          setNombresByTel(map);
        }
      } catch (e: any) {
        setErrMsg(e.message ?? 'Error al cargar pedidos');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* =========================
     Carga detalle (fallback)
  ========================= */
  useEffect(() => {
    if (!openId) return;
    const yaTengo = detallesMap[openId];
    const enVista = pedidos.find((p) => p.id === openId)?.detalle_lineas;
    if ((enVista && enVista.length) || yaTengo?.length) return;
    ensureDetalle(openId);
  }, [openId, pedidos]);

  async function ensureDetalle(pedidoId: number) {
    try {
      setDetLoading((s) => ({ ...s, [pedidoId]: true }));
      const { data, error } = await supabase
        .from('pedido_linea')
        .select('cantidad, valor, estado, articulo:articulo_id(nombre), nombre, articulo, qty, precio')
        .or(`pedido_id.eq.${pedidoId},nro.eq.${pedidoId}`)
        .order('id');
      if (error) throw error;

      const rows: Linea[] = (data ?? []).map((r: any) => ({
        cantidad: Number(r.cantidad ?? r.qty ?? 0),
        valor: Number(r.valor ?? r.precio ?? 0),
        estado: r.estado ?? 'LAVAR',
        nombre: r?.articulo?.nombre ?? r?.nombre ?? r?.articulo ?? '—',
      }));
      setDetallesMap((m) => ({ ...m, [pedidoId]: rows }));
    } finally {
      setDetLoading((s) => ({ ...s, [pedidoId]: false }));
    }
  }

  /* =========================
     Imagen
  ========================= */
  function abrirPicker(nro: number) {
    setPickerForPedido(nro);
  }
  function cerrarPicker() {
    setPickerForPedido(null);
  }
  async function handlePick(kind: 'camera' | 'file') {
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
      setUploading((u) => ({ ...u, [pid]: true }));
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `pedido-${pid}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from(STORAGE_BUCKET).upload(path, file);
      if (up.error) throw up.error;
      const pub = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      const publicUrl = pub.data.publicUrl;
      for (const v of FOTO_COL_VARIANTS) {
        const ins = await supabase.from(PEDIDO_FOTO_TABLE).insert({
          [v.pedidoCol]: pid,
          [v.urlCol]: publicUrl,
        });
        if (!ins.error) break;
      }
      setPedidos((p) => p.map((x) => (x.id === pid ? { ...x, foto_url: publicUrl } : x)));
    } finally {
      setUploading((u) => ({ ...u, [pid!]: false }));
      cerrarPicker();
    }
  }

  /* =========================
     Render
  ========================= */
  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-32">
      <header className="flex items-center justify-between px-4 py-3">
        <h1 className="font-bold text-base lg:text-xl">Lavar</h1>
        <button onClick={() => router.push('/base')} className="text-sm text-white/90 hover:text-white">
          ← Volver
        </button>
      </header>

      <section className="px-4 grid gap-4">
        {loading && (
          <div className="flex items-center gap-2 text-white/90">
            <Loader2 className="animate-spin" size={18} /> Cargando pedidos…
          </div>
        )}
        {!loading && pedidos.map((p) => {
          const isOpen = openId === p.id;
          const nombre = p.telefono && nombresByTel[p.telefono] ? nombresByTel[p.telefono] : p.cliente;
          const lineas = p.detalle_lineas?.length ? p.detalle_lineas : detallesMap[p.id] ?? [];
          const totalCalc = computeTotalFrom(lineas, p.total);

          return (
            <div key={p.id} className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md">
              <button
                onClick={() => setOpenId(isOpen ? null : p.id)}
                className="w-full flex justify-between items-center px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 flex items-center justify-center rounded-full bg-white/15 border border-white/20">
                    <User size={18} />
                  </span>
                  <div>
                    <div className="font-extrabold text-sm">N° {p.id}</div>
                    <div className="text-xs text-white/80">
                      {nombre} {p.pagado ? '• PAGADO' : '• PENDIENTE'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{CLP.format(totalCalc)}</span>
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4">
                  {/* Imagen */}
                  <div className="rounded-xl overflow-hidden bg-black/20 border border-white/10 mb-3">
                    {p.foto_url ? (
                      <Image
                        src={p.foto_url}
                        alt="foto pedido"
                        width={500}
                        height={400}
                        className="w-full object-cover cursor-zoom-in"
                        onDoubleClick={() => abrirPicker(p.id)}
                      />
                    ) : (
                      <button
                        onClick={() => abrirPicker(p.id)}
                        className="w-full p-6 text-white/80 hover:text-white flex justify-center gap-2"
                      >
                        <Camera size={18} /> {uploading[p.id] ? 'Subiendo…' : 'Sin imagen adjunta. Toca para agregar.'}
                      </button>
                    )}
                  </div>

                  {/* Detalle Pedido */}
                  <div className="bg-white/10 rounded-xl border border-white/15 overflow-hidden">
                    <button
                      onClick={() => setOpenId(isOpen ? null : p.id)}
                      className="w-full flex items-center gap-2 bg-violet-600/70 hover:bg-violet-700/80 px-4 py-2 text-left font-semibold"
                    >
                      <Table size={16} />
                      Detalle Pedido ({p.items_count ?? lineas.length})
                    </button>

                    <div className="overflow-x-auto bg-white/5">
                      <table className="w-full text-sm text-white/95">
                        <thead className="bg-violet-200 text-violet-900">
                          <tr>
                            <th className="text-left px-3 py-2 w-[44%]">Artículo</th>
                            <th className="text-center px-3 py-2 w-[12%]">Cantidad</th>
                            <th className="text-right px-3 py-2 w-[14%]">Valor</th>
                            <th className="text-right px-3 py-2 w-[18%]">Subtotal</th>
                            <th className="text-left px-3 py-2 w-[12%]">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10 bg-white/5">
                          {lineas.map((l, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2">{artOf(l)}</td>
                              <td className="px-3 py-2 text-center">{qtyOf(l)}</td>
                              <td className="px-3 py-2 text-right">{CLP.format(valOf(l))}</td>
                              <td className="px-3 py-2 text-right">
                                {CLP.format(qtyOf(l) * valOf(l))}
                              </td>
                              <td className="px-3 py-2">{estOf(l)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div className="px-4 py-3 bg-violet-200/80 text-violet-900 font-semibold">
                        Total: <span className="text-xl font-extrabold">{CLP.format(totalCalc)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Modal imagen */}
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
                <Camera size={18} /> Sacar foto
              </button>
              <button
                onClick={() => handlePick('file')}
                className="flex items-center gap-2 rounded-xl bg-violet-100 text-violet-800 px-4 py-3 hover:bg-violet-200"
              >
                <ImagePlus size={18} /> Buscar en archivos
              </button>
              <button onClick={cerrarPicker} className="mt-1 rounded-xl px-3 py-2 text-sm hover:bg-violet-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inputs ocultos */}
      <input ref={inputCamRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileSelected} />
      <input ref={inputFileRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
    </main>
  );
}
