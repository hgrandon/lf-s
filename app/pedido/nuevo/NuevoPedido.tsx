// app/pedido/nuevo/NuevoPedido.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Save, UserRound } from 'lucide-react';
import NewArticleModal from '@/app/components/NewArticleModal';

type NextNumber = { nro: number; fecha: string; entrega: string };
type Articulo   = { id: number; nombre: string; precio: number };
type Linea      = { articulo_id: number; nombre: string; precio: number; qty: number; estado: 'LAVAR' };
type Cliente    = { telefono: string; nombre: string; direccion: string };

const CLP = new Intl.NumberFormat('es-CL');

export default function NuevoPedido() {
  const router = useRouter();
  const params = useSearchParams();
  const tel = (params.get('tel') || '').replace(/\D+/g, '').slice(0, 9);

  const [nro, setNro] = useState<number | null>(null);
  const [fecha, setFecha] = useState('');
  const [entrega, setEntrega] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);

  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [selectedId, setSelectedId] = useState<number | '__new__' | ''>('');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [fotos, setFotos] = useState<string[]>([]);
  const [showNewArt, setShowNewArt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const total = useMemo(() => lineas.reduce((acc, l) => acc + l.precio * l.qty, 0), [lineas]);

  useEffect(() => {
    if (!tel || tel.length !== 9) {
      router.replace('/pedido');
      return;
    }
    (async () => {
      try {
        // correlativo
        const { data, error } = await supabase.rpc('pedido_next_number');
        if (error) throw error;
        const row = (data as NextNumber[])[0];
        setNro(row.nro); setFecha(row.fecha); setEntrega(row.entrega);

        // cliente
        const q = await supabase.rpc('clientes_get_by_tel', { p_telefono: tel });
        if (q.error) throw q.error;
        const cli = ((q.data as Cliente[] | null)?.[0]) ?? null;
        if (!cli) { router.replace('/pedido'); return; }
        setCliente(cli);

        // artículos
        const rpc = await supabase.rpc('active_articles_list');
        if (!rpc.error && rpc.data) {
          setArticulos(rpc.data as Articulo[]);
        } else {
          const f = await supabase
            .from('articulo')
            .select('id,nombre,precio')
            .eq('activo', true)
            .order('nombre', { ascending: true });
          if (f.error) throw f.error;
          setArticulos((f.data || []) as Articulo[]);
        }
      } catch (e: any) {
        setMsg('Error cargando datos: ' + (e?.message ?? e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tel]);

  /** Agrega o incrementa el artículo indicado */
  function pushArticulo(art: Articulo) {
    setLineas(prev => {
      const i = prev.findIndex(l => l.articulo_id === art.id);
      if (i >= 0) {
        const c = [...prev];
        c[i] = { ...c[i], qty: c[i].qty + 1 };
        return c;
        }
      return [...prev, { articulo_id: art.id, nombre: art.nombre, precio: art.precio, qty: 1, estado: 'LAVAR' }];
    });
  }

  /** Cambio del select:
   * - si es "__new__": abre modal
   * - si es un ID válido: agrega inmediatamente
   */
  function onSelectArticulo(v: string) {
    if (!v) return;
    if (v === '__new__') {
      setSelectedId('');
      setShowNewArt(true);
      return;
    }
    const id = Number(v);
    const art = articulos.find(a => a.id === id);
    if (art) pushArticulo(art);
    setSelectedId('');
  }

  function changeQty(id: number, d: number) {
    setLineas(prev => prev.map(l => l.articulo_id === id ? { ...l, qty: Math.max(1, l.qty + d) } : l));
  }

  function removeLinea(id: number) {
    setLineas(prev => prev.filter(l => l.articulo_id !== id));
  }

  async function onFiles(files: FileList | null) {
    if (!files || !nro) return;
    setLoading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${nro}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from('pedido_fotos')
          .upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' });
        if (error) throw error;
        uploaded.push(path);
      }
      setFotos(prev => [...prev, ...uploaded]);
      setMsg(`📷 ${uploaded.length} foto(s) subida(s).`);
    } catch (e: any) {
      setMsg('Error subiendo fotos: ' + (e?.message ?? e));
    } finally { setLoading(false); }
  }

  async function save() {
    if (!nro || !cliente) return;
    if (lineas.length === 0) { setMsg('Agrega al menos un artículo.'); return; }
    setLoading(true); setMsg('Guardando pedido...');
    try {
      const p_pedido = { nro, fecha, entrega, telefono: cliente.telefono, total };
      const p_lineas = lineas.map(l => ({
        articulo_id: l.articulo_id, nombre: l.nombre, precio: l.precio, qty: l.qty, estado: l.estado
      }));
      const { error } = await supabase.rpc('pedido_upsert', { p_pedido, p_lineas, p_fotos: fotos });
      if (error) throw error;
      setMsg('✅ Pedido guardado');
      // router.push('/menu');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? e));
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />
      <div className="relative z-10 mx-auto w-full max-w-md sm:max-w-lg p-4 sm:p-6">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between text-white">
          <div>
            <div className="text-lg sm:text-xl font-semibold">Detalles del Pedido</div>
            <div className="text-2xl sm:text-3xl font-extrabold">N° {nro ?? '...'}</div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-right text-white/90 text-xs sm:text-sm leading-5">
              <div>{fecha && new Date(fecha).toLocaleDateString()}</div>
              <div>{entrega && new Date(entrega).toLocaleDateString()}</div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => router.push('/pedido')} className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow hover:bg-white" title="Volver">
                <ArrowLeft className="text-violet-700" size={18} />
              </button>
              <button disabled={loading} onClick={save} className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow hover:bg-white disabled:opacity-60" title="Guardar">
                <Save className="text-violet-700" size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow">
          {/* Tarjeta cliente */}
          {cliente && (
            <div className="mb-4 rounded-xl border bg-white shadow-sm">
              <div className="flex items-center justify-between p-3">
                <div>
                  <div className="text-base font-semibold text-gray-900">{cliente.nombre}</div>
                  <div className="text-sm text-gray-600">{cliente.telefono}</div>
                  <div className="text-sm text-gray-600">{cliente.direccion}</div>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-full bg-purple-50 text-purple-700">
                  <UserRound size={18} />
                </div>
              </div>
            </div>
          )}

          {/* Añadir artículo */}
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Añadir Artículo</h3>
          <div className="mb-3">
            <select
              value={selectedId || ''}
              onChange={(e) => onSelectArticulo(e.target.value)}
              className="w-full rounded border px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Seleccionar artículo…</option>
              {articulos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
              <option value="__new__">➕ Nuevo artículo…</option>
            </select>
          </div>

          {/* Seleccionados */}
          {!!lineas.length && (
            <>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Artículos Seleccionados</h3>
              <div className="mb-3 space-y-2">
                {lineas.map((l) => (
                  <div key={l.articulo_id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="font-semibold text-gray-900">{l.nombre}</div>
                      <div className="text-xs text-blue-700 font-bold">{CLP.format(l.precio)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => changeQty(l.articulo_id, -1)} className="rounded-full border px-3 py-1">−</button>
                      <span className="w-6 text-center">{l.qty}</span>
                      <button onClick={() => changeQty(l.articulo_id, +1)} className="rounded-full border px-3 py-1">+</button>
                    </div>
                    <div className="min-w-[80px] text-right font-semibold">{CLP.format(l.precio * l.qty)}</div>
                    <button onClick={() => removeLinea(l.articulo_id)} className="text-red-600 text-sm underline">Quitar</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Total & guardar */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xl font-extrabold text-gray-900">Total {CLP.format(total)}</div>
            <button
              onClick={save}
              disabled={loading || !lineas.length}
              className="rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Guardar Pedido
            </button>
          </div>

          {/* Fotos */}
          <div className="mt-4">
            <label className="mb-1 block text-xs text-gray-500">FOTOS (opcional)</label>
            <input type="file" multiple onChange={(e) => onFiles(e.target.files)} />
          </div>

          {msg && <div className="mt-3 text-sm text-gray-700">{msg}</div>}
        </div>
      </div>

      {/* Modal nuevo artículo */}
      <NewArticleModal
        open={showNewArt}
        onClose={() => setShowNewArt(false)}
        onCreate={async ({ nombre, precio, qty }) => {
          try {
            setLoading(true);
            const { data, error } = await supabase
              .from('articulo')
              .insert({ nombre, precio, activo: true })
              .select('id,nombre,precio')
              .single();
            if (error) throw error;
            const created = data as Articulo;

            // Mantener catálogo ordenado
            setArticulos(prev => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));

            // Agregar al pedido inmediatamente
            setLineas(prev => [...prev, {
              articulo_id: created.id,
              nombre: created.nombre,
              precio: created.precio,
              qty,
              estado: 'LAVAR'
            }]);

            setShowNewArt(false);
            setSelectedId('');
            setMsg('✅ Artículo creado y agregado.');
          } catch (e: any) {
            setMsg('❌ ' + (e?.message ?? e));
          } finally {
            setLoading(false);
          }
        }}
      />
    </div>
  );
}

