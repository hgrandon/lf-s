// app/pedido/nuevo/NuevoPedido.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Save, UserRound } from 'lucide-react';
import NewArticleModal from '@/app/components/NewArticleModal';
import EditLineaModal from '@/app/components/EditLineaModal';

/* =========================
   Tipos
========================= */
type NextNumber = { nro: number; fecha: string; entrega: string };
type Articulo   = { id: number; nombre: string; precio: number };
type EstadoLinea = 'LAVAR';
type Linea      = { articulo_id: number; nombre: string; precio: number; qty: number; estado: EstadoLinea };
type Cliente    = { telefono: string; nombre: string; direccion: string };

/* =========================
   Constantes & helpers
========================= */
const CLP = new Intl.NumberFormat('es-CL');
const ESTADO_DEF: EstadoLinea = 'LAVAR';

const money = (n: number) => CLP.format(Math.max(0, Math.round(n || 0)));
const clampInt = (n: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  Math.min(max, Math.max(min, Math.trunc(Number.isFinite(n) ? n : 0)));

const byNombreAsc = <T extends { nombre: string }>(a: T, b: T) =>
  a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });

/* =========================
   Página
========================= */
export default function NuevoPedido() {
  const router = useRouter();
  const params = useSearchParams();
  const tel = (params.get('tel') || '').replace(/\D+/g, '').slice(0, 9);

  const [nro, setNro] = useState<number | null>(null);
  const [fecha, setFecha] = useState('');
  const [entrega, setEntrega] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);

  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [fotos, setFotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Modales
  const [modalOpen, setModalOpen] = useState(false);
  const [articuloSeleccionado, setArticuloSeleccionado] = useState<Articulo | null>(null);
  const [lineaEnEdicion, setLineaEnEdicion] = useState<Linea | null>(null);
  const [showNewArt, setShowNewArt] = useState(false);

  // Select controlado
  const [selectedId, setSelectedId] = useState<string>('');

  const total = useMemo(
    () => lineas.reduce((acc, l) => acc + l.precio * l.qty, 0),
    [lineas]
  );

  // Sin duplicados en el select
  const articulosDisponibles = useMemo(
    () => articulos.filter(a => !lineas.some(l => l.articulo_id === a.id)),
    [articulos, lineas]
  );

  /* ---------- Carga inicial ---------- */
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
        setNro(row.nro);
        setFecha(row.fecha);
        setEntrega(row.entrega);

        // cliente
        const q = await supabase.rpc('clientes_get_by_tel', { p_telefono: tel });
        if (q.error) throw q.error;
        const cli = ((q.data as Cliente[] | null)?.[0]) ?? null;
        if (!cli) { router.replace('/pedido'); return; }
        setCliente(cli);

        // artículos
        const rpc = await supabase.rpc('active_articles_list');
        if (!rpc.error && rpc.data) {
          setArticulos((rpc.data as Articulo[]).sort(byNombreAsc));
        } else {
          const f = await supabase
            .from('articulo')
            .select('id,nombre,precio')
            .eq('activo', true)
            .order('nombre', { ascending: true });
          if (f.error) throw f.error;
          setArticulos(((f.data || []) as Articulo[]).sort(byNombreAsc));
        }
      } catch (e: any) {
        setMsg('Error cargando datos: ' + (e?.message ?? e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tel]);

  /* ---------- Acciones ---------- */
  const abrirModalParaArticulo = useCallback((art: Articulo) => {
    const existente = lineas.find(l => l.articulo_id === art.id) ?? null;
    setArticuloSeleccionado(art);
    setLineaEnEdicion(existente);
    setModalOpen(true);
  }, [lineas]);

  const onSelectArticuloChange = useCallback((value: string) => {
    if (!value) return;
    if (value === '__new__') {
      setSelectedId('');
      setShowNewArt(true);
      return;
    }
    const id = Number(value);
    const art = articulos.find(a => a.id === id);
    if (art) abrirModalParaArticulo(art);
    setSelectedId('');
  }, [abrirModalParaArticulo, articulos]);

  const upsertLinea = useCallback((art: Articulo, precio: number, qty: number) => {
    setLineas(prev => {
      const i = prev.findIndex(l => l.articulo_id === art.id);
      if (i >= 0) {
        const c = [...prev];
        c[i] = { ...c[i], precio: clampInt(precio, 0), qty: clampInt(qty, 1) };
        return c.sort(byNombreAsc);
      }
      return [
        ...prev,
        { articulo_id: art.id, nombre: art.nombre, precio: clampInt(precio, 0), qty: clampInt(qty, 1), estado: ESTADO_DEF }
      ].sort(byNombreAsc);
    });
  }, []);

  const onSaveNewDefaultPrice = useCallback(async (art: Articulo, nuevoPrecio: number) => {
    const { error } = await supabase
      .from('articulo')
      .update({ precio: clampInt(nuevoPrecio, 0) })
      .eq('id', art.id);
    if (error) throw error;
    setArticulos(prev =>
      prev.map(a => (a.id === art.id ? { ...a, precio: clampInt(nuevoPrecio, 0) } : a)).sort(byNombreAsc)
    );
  }, []);

  const changeQty = useCallback((id: number, d: number) => {
    setLineas(prev =>
      prev.map(l => l.articulo_id === id ? { ...l, qty: clampInt(l.qty + d, 1) } : l)
    );
  }, []);

  const removeLinea = useCallback((id: number) => {
    setLineas(prev => prev.filter(l => l.articulo_id !== id));
  }, []);

  const onFiles = useCallback(async (files: FileList | null) => {
    if (!files || !nro) return;
    setLoading(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map(async (file) => {
          const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
          const path = `${nro}/${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage
            .from('pedido_fotos')
            .upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' });
          if (error) throw error;
          return path;
        })
      );
      setFotos(prev => [...prev, ...uploaded]);
      setMsg(`📷 ${uploaded.length} foto(s) subida(s).`);
    } catch (e: any) {
      setMsg('Error subiendo fotos: ' + (e?.message ?? e));
    } finally { setLoading(false); }
  }, [nro]);

  const save = useCallback(async () => {
    if (!nro || !cliente) return;
    if (lineas.length === 0) { setMsg('Agrega al menos un artículo.'); return; }
    if (loading) return; // evita doble clic

    setLoading(true); setMsg('Guardando pedido...');
    try {
      // Cabecera (snapshot)
      const p_pedido = {
        nro,
        fecha,
        entrega,
        telefono: cliente.telefono,
        nombre: cliente.nombre,
        direccion: cliente.direccion,
        estado_pago: 'PENDIENTE',
        tipo_entrega: 'LOCAL',
        total
      };

      // Líneas
      const p_lineas = lineas.map(l => ({
        articulo_id: l.articulo_id,
        nombre: l.nombre,
        precio: l.precio,
        qty: l.qty,
        estado: l.estado
      }));

      // RPC oficial
      const { error: rpcError } = await supabase.rpc('pedido_upsert', { p_pedido, p_lineas, p_fotos: fotos });

      // Fallback
      if (rpcError) {
        const { error: upErr } = await supabase.from('pedido').upsert([p_pedido], { onConflict: 'nro' });
        if (upErr) throw upErr;

        const { error: delErr } = await supabase.from('pedido_linea').delete().eq('nro', nro);
        if (delErr) throw delErr;

        const { error: insErr } = await supabase.from('pedido_linea').insert(p_lineas.map(l => ({ nro, ...l })));
        if (insErr) throw insErr;
      }

      setMsg('✅ Pedido guardado correctamente.');
      // router.push('/menu');
    } catch (e: any) {
      setMsg('❌ Error guardando pedido: ' + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [cliente, fecha, entrega, fotos, lineas, loading, nro, total]);

  /* ---------- UI ---------- */
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
              <div>{fecha && new Date(fecha).toLocaleDateString('es-CL')}</div>
              <div>{entrega && new Date(entrega).toLocaleDateString('es-CL')}</div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => router.push('/pedido')} className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow hover:bg-white" title="Volver" aria-label="Volver">
                <ArrowLeft className="text-violet-700" size={18} />
              </button>
              <button disabled={loading} onClick={save} className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow hover:bg-white disabled:opacity-60" title="Guardar" aria-label="Guardar">
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
              value={selectedId}
              onChange={(e) => onSelectArticuloChange(e.target.value)}
              className="w-full rounded border px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Seleccionar artículo…</option>
              {articulosDisponibles.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
              <option value="__new__">➕ Nuevo artículo…</option>
            </select>
          </div>

          {/* Seleccionados */}
          {!!lineas.length && (
            <>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Artículos Seleccionados</h3>

              {/* Encabezado: solo en >= sm */}
              <div className="mb-1 hidden grid-cols-[1fr_120px_100px_110px] gap-2 px-2 text-xs font-semibold text-gray-500 sm:grid">
                <div>Artículo</div>
                <div className="text-center">Cantidad</div>
                <div className="text-center">Estado</div>
                <div className="text-right">Subtotal</div>
              </div>

              <div className="mb-3 space-y-3">
                {[...lineas].sort(byNombreAsc).map((l) => {
                  const subtotal = l.precio * l.qty;
                  return (
                    <div
                      key={l.articulo_id}
                      className="rounded-lg border p-3 sm:grid sm:grid-cols-[1fr_120px_100px_110px] sm:items-center sm:gap-2"
                    >
                      {/* Fila 1 (nombre y precio unitario). En móvil, subtotal a la derecha */}
                      <div className="flex items-start justify-between gap-3 sm:block">
                        <div
                          className="min-w-0 cursor-pointer"
                          title="Editar línea"
                          onClick={() => {
                            const art = articulos.find(a => a.id === l.articulo_id);
                            if (art) abrirModalParaArticulo(art);
                          }}
                        >
                          <div className="truncate text-base font-semibold text-gray-900 sm:text-[15px]">
                            {l.nombre}
                          </div>
                          <div className="mt-0.5 text-[11px] font-bold text-blue-700">{money(l.precio)}</div>
                        </div>

                        {/* Subtotal en móvil (derecha). En desktop va en su columna al final */}
                        <div className="text-right text-[15px] font-semibold sm:hidden">
                          {money(subtotal)}
                        </div>
                      </div>

                      {/* Fila 2: Cantidad (centro) */}
                      <div className="mt-2 flex items-center justify-between sm:mt-0 sm:justify-center">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => changeQty(l.articulo_id, -1)}
                            className="grid h-8 w-8 place-items-center rounded-full border text-sm sm:h-7 sm:w-7"
                            aria-label="Disminuir cantidad"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-base sm:text-[13px]">{l.qty}</span>
                          <button
                            onClick={() => changeQty(l.articulo_id, +1)}
                            className="grid h-8 w-8 place-items-center rounded-full border text-sm sm:h-7 sm:w-7"
                            aria-label="Aumentar cantidad"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Estado */}
                      <div className="mt-2 text-right sm:mt-0 sm:text-center">
                        <span className="inline-block rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700 sm:bg-transparent sm:px-0 sm:py-0 sm:text-xs">
                          {l.estado}
                        </span>
                      </div>

                      {/* Subtotal en columna fija (desktop) */}
                      <div className="hidden text-right text-[15px] font-semibold sm:block">
                        {money(subtotal)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Total & guardar */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xl font-extrabold text-gray-900">Total {money(total)}</div>
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

      {/* Modal agregar/editar línea */}
      <EditLineaModal
        open={modalOpen}
        articulo={articuloSeleccionado}
        lineaActual={lineaEnEdicion}
        onCancel={() => setModalOpen(false)}
        onConfirm={(precio, qty) => {
          if (!articuloSeleccionado) return;
          upsertLinea(articuloSeleccionado, precio, qty);
          setModalOpen(false);
        }}
        onSaveNewPrice={async (nuevoPrecio) => {
          if (!articuloSeleccionado) return;
          await onSaveNewDefaultPrice(articuloSeleccionado, nuevoPrecio);
        }}
      />

      {/* Modal NUEVO ARTÍCULO (componente externo) */}
      <NewArticleModal
        open={showNewArt}
        onClose={() => setShowNewArt(false)}
        onCreate={async ({ nombre, precio, qty }) => {
          // 1) crear artículo en Supabase
          const { data, error } = await supabase
            .from('articulo')
            .insert({ nombre: nombre.toUpperCase(), precio: clampInt(precio, 0), activo: true })
            .select('id,nombre,precio')
            .single();
          if (error) throw error;
          const created = data as Articulo;

          // 2) catálogo en memoria (ordenado)
          setArticulos(prev => [...prev, created].sort(byNombreAsc));

          // 3) agregar línea al pedido (ordenada)
          setLineas(prev =>
            [...prev, { articulo_id: created.id, nombre: created.nombre, precio: created.precio, qty: clampInt(qty, 1), estado: ESTADO_DEF }]
              .sort(byNombreAsc)
          );

          // 4) cerrar y resetear
          setShowNewArt(false);
          setSelectedId('');
          setMsg('✅ Artículo creado y agregado.');
        }}
      />
    </div>
  );
}






