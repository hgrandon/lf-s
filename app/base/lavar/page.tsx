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
  WashingMachine,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

type Item = { articulo: string; qty: number; valor: number };
type PedidoEstado = 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGADO' | 'ENTREGAR';

type Pedido = {
  id: number;
  telefono?: string | null;
  cliente: string;
  total: number | null;
  estado: PedidoEstado;
  pagado?: boolean | null;
  detalle?: string | null;
  fotos?: string[];
};

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

// Extrae fotos desde pedido_foto
function groupFotos(data: any[] | null | undefined): Map<number, string[]> {
  const map = new Map<number, string[]>();
  (data ?? []).forEach((row: any) => {
    const pid = Number(row.pedido_id ?? row.id);
    const url = String(row.url ?? '').trim();
    if (!pid || !url) return;
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push(url);
  });
  return map;
}

export default function LavarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const [pickerForPedido, setPickerForPedido] = useState<number | null>(null);
  const inputCamRef = useRef<HTMLInputElement>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);

  const pedidoAbierto = useMemo(() => pedidos.find((p) => p.id === openId) ?? null, [pedidos, openId]);

  const [currentSlide, setCurrentSlide] = useState<Record<number, number>>({});

  const goSlide = (pid: number, dir: number) => {
    const fotos = pedidos.find((p) => p.id === pid)?.fotos ?? [];
    if (fotos.length <= 1) return;
    const total = fotos.length;
    setCurrentSlide(prev => ({
      ...prev,
      [pid]: ((prev[pid] ?? 0) + dir + total) % total,
    }));
  };

  async function loadPedidos() {
    try {
      setLoading(true);
      setErrMsg(null);

      const { data: pedidosRaw, error: e1 } = await supabase
        .from('pedido')
        .select('nro, telefono, total, estado, detalle, pagado')
        .eq('estado', 'LAVAR')
        .order('nro', { ascending: true });

      if (e1) throw e1;

      const ids = (pedidosRaw ?? []).map((r: any) => r.nro);

      const { data: clientes } = await supabase
        .from('clientes')
        .select('telefono, nombre')
        .in('telefono', pedidosRaw.map((r: any) => r.telefono));

      const nameMap = new Map(
        (clientes ?? []).map((c: any) => [String(c.telefono), c.nombre ?? 'SIN NOMBRE'])
      );

      const { data: lineas } = await supabase
        .from('pedido_linea')
        .select('pedido_id, articulo, cantidad, valor')
        .in('pedido_id', ids);

      const itemMap = new Map<number, Item[]>();
      (lineas ?? []).forEach((l: any) => {
        const arr = itemMap.get(l.pedido_id) ?? [];
        arr.push({
          articulo: l.articulo,
          qty: Number(l.cantidad),
          valor: Number(l.valor),
        });
        itemMap.set(l.pedido_id, arr);
      });

      const { data: fotos } = await supabase
        .from('pedido_foto')
        .select('pedido_id, url')
        .in('pedido_id', ids);

      const fotosMap = groupFotos(fotos);

      const mapped: Pedido[] = (pedidosRaw ?? []).map((r: any) => ({
        id: r.nro,
        telefono: r.telefono ?? '',
        cliente: nameMap.get(String(r.telefono)) ?? 'SIN NOMBRE',
        total: r.total ?? 0,
        estado: r.estado,
        detalle: r.detalle ?? '',
        pagado: r.pagado ?? false,
        fotos: fotosMap.get(r.nro) ?? [],
        items: itemMap.get(r.nro) ?? [],
      }));

      setPedidos(mapped);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setErrMsg(err.message);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPedidos();
  }, []);

  function snack(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 1800);
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
    if (!pid || !file) return setPickerForPedido(null);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `pedido-${pid}/${Date.now()}.${ext}`;

      await supabase.storage.from('fotos').upload(path, file);
      const { data: pub } = supabase.storage.from('fotos').getPublicUrl(path);
      const url = pub.publicUrl;

      await supabase.from('pedido_foto').insert({ pedido_id: pid, url });

      snack('Foto subida');
      loadPedidos();
    } catch (err) {
      snack('Error al subir foto');
    } finally {
      setPickerForPedido(null);
    }
  }

  async function changeEstado(id: number, next: PedidoEstado) {
    await supabase.from('pedido').update({ estado: next }).eq('nro', id);
    snack(`Pedido #${id} a ${next}`);
    loadPedidos();
    setOpenId(null);
  }

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-purple-700 to-indigo-900 pb-32">
      <header className="flex justify-between p-3">
        <span className="font-bold text-lg">Lavar</span>
        <button onClick={() => router.push('/base')}>← Volver</button>
      </header>

      <section className="p-3 grid gap-4">
        {loading && <div>Cargando…</div>}
        {errMsg && <div className="text-red-300">{errMsg}</div>}

        {pedidos.map((p) => {
          const isOpen = openId === p.id;
          const slide = currentSlide[p.id] ?? 0;

          return (
            <div key={p.id} className="rounded-xl bg-white/10 backdrop-blur-xl border border-white/20">
              <button
                onClick={() => setOpenId(isOpen ? null : p.id)}
                className="flex justify-between w-full items-center p-3"
              >
                <div>
                  <div className="font-bold">N° {p.id}</div>
                  <div className="text-xs opacity-80">{p.cliente}</div>
                </div>
                <ChevronRight />
              </button>

              {isOpen && (
                <div className="p-3 grid gap-3">
                  {p.items && p.items.length > 0 && (
                    <table className="w-full text-sm">
                      <thead className="opacity-80">
                        <tr>
                          <th className="text-left">Artículo</th>
                          <th className="text-right">Cant</th>
                          <th className="text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="truncate">{it.articulo}</td>
                            <td className="text-right">{it.qty}</td>
                            <td className="text-right">{CLP.format(it.qty * it.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Galería deslizable */}
                  {p.fotos && p.fotos.length > 0 && (
                    <div className="relative w-full overflow-hidden rounded-xl">
                      <Image
                        src={p.fotos[slide]}
                        alt="foto"
                        width={800}
                        height={600}
                        className="rounded-xl object-cover max-h-[50vh] w-full"
                      />

                      {p.fotos.length > 1 && (
                        <>
                          <button className="absolute left-2 top-1/2" onClick={() => goSlide(p.id, -1)}>◀</button>
                          <button className="absolute right-2 top-1/2" onClick={() => goSlide(p.id, 1)}>▶</button>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setPickerForPedido(p.id)}
                      className="bg-white/10 p-2 rounded-lg border border-white/20 flex items-center gap-2"
                    >
                      <Camera size={16} /> Agregar foto
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {notice && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 p-2 rounded-xl bg-black/70">
          {notice}
        </div>
      )}

      {pickerForPedido && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center">
          <div className="bg-white p-4 text-purple-800 rounded-xl">
            <div className="font-bold mb-2">Agregar foto #{pickerForPedido}</div>
            <button
              onClick={() => handlePick('camera')}
              className="bg-purple-600 text-white p-2 rounded-lg mb-2 w-full"
            >
              Cámara
            </button>
            <button
              onClick={() => handlePick('file')}
              className="bg-purple-100 text-purple-800 p-2 rounded-lg w-full"
            >
              Archivos
            </button>
            <button className="mt-2 text-sm w-full" onClick={() => setPickerForPedido(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Inputs ocultos */}
      <input ref={inputCamRef} type="file" accept="image/*" capture="environment" onChange={onFileSelected} className="hidden" />
      <input ref={inputFileRef} type="file" accept="image/*" onChange={onFileSelected} className="hidden" />
    </main>
  );
}
