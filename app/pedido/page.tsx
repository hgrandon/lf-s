'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Save } from 'lucide-react';

type NextNumber = { nro: number; fecha: string; entrega: string };
type Articulo = { id: number; nombre: string; precio: number };
type Linea = { articulo_id: number; nombre: string; precio: number; qty: number };

function useAuthGuard() {
  const router = useRouter();
  useEffect(() => {
    const ok = typeof window !== 'undefined' && localStorage.getItem('auth') === 'ok';
    if (!ok) router.replace('/login');
  }, [router]);
}

export default function PedidoPage() {
  useAuthGuard();
  const router = useRouter();

  // Cabecera
  const [nro, setNro] = useState<number | null>(null);
  const [fecha, setFecha] = useState<string>('');
  const [entrega, setEntrega] = useState<string>('');

  // Cliente
  const [telefono, setTelefono] = useState('');

  // Artículos
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [selectedId, setSelectedId] = useState<number | ''>('');

  // Líneas
  const [lineas, setLineas] = useState<Linea[]>([]);

  // Fotos (paths subidos)
  const [fotos, setFotos] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Total
  const total = useMemo(
    () => lineas.reduce((acc, l) => acc + l.precio * l.qty, 0),
    [lineas]
  );

  // Cargar Nº siguiente + fechas
  useEffect(() => {
    const go = async () => {
      const { data, error } = await supabase.rpc('pedido_next_number');
      if (error) {
        setMsg('Error al cargar correlativo: ' + error.message);
        return;
      }
      const row = (data as NextNumber[])[0];
      setNro(row.nro);
      setFecha(row.fecha);
      setEntrega(row.entrega);
    };
    go();
  }, []);

  // Cargar artículos activos
  useEffect(() => {
    const go = async () => {
      const { data, error } = await supabase.rpc('active_articles_list');
      if (error) {
        setMsg('Error al cargar artículos: ' + error.message);
        return;
      }
      setArticulos(data as Articulo[]);
    };
    go();
  }, []);

  // Añadir artículo seleccionado
  const addArticulo = () => {
    if (!selectedId) return;
    const art = articulos.find(a => a.id === Number(selectedId));
    if (!art) return;

    setLineas(prev => {
      // si ya existe, sumar qty
      const idx = prev.findIndex(l => l.articulo_id === art.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { articulo_id: art.id, nombre: art.nombre, precio: art.precio, qty: 1 }];
    });
    setSelectedId('');
  };

  const changeQty = (id: number, delta: number) => {
    setLineas(prev => {
      const copy = prev.map(l =>
        l.articulo_id === id ? { ...l, qty: Math.max(1, l.qty + delta) } : l
      );
      return copy;
    });
  };

  const removeLinea = (id: number) => {
    setLineas(prev => prev.filter(l => l.articulo_id !== id));
  };

  // Subir fotos al bucket `pedido_fotos`
  const onFiles = async (files: FileList | null) => {
    if (!files || !nro) return;
    setLoading(true);
    try {
      const up = Array.from(files);
      const uploaded: string[] = [];

      for (const file of up) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${nro}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('pedido_fotos').upload(path, file, {
          upsert: false,
          contentType: file.type || 'image/jpeg',
        });
        if (error) throw error;
        uploaded.push(path);
      }
      setFotos(prev => [...prev, ...uploaded]);
      setMsg(`📷 ${uploaded.length} foto(s) subida(s).`);
    } catch (e: any) {
      setMsg('Error al subir fotos: ' + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  // Guardar pedido (RPC upsert)
  const save = async () => {
    if (!nro) return;
    if (!telefono.trim()) {
      setMsg('Ingresa el teléfono del cliente.');
      return;
    }
    if (lineas.length === 0) {
      setMsg('Agrega al menos un artículo.');
      return;
    }
    setLoading(true);
    setMsg('Guardando...');
    try {
      const p_pedido = {
        nro,
        fecha,
        entrega,
        telefono,
        total,
      };
      const p_lineas = lineas.map(l => ({
        articulo_id: l.articulo_id,
        nombre: l.nombre,
        precio: l.precio,
        qty: l.qty,
      }));

      const { error } = await supabase.rpc('pedido_upsert', {
        p_pedido,
        p_lineas,
        p_fotos: fotos,
      });

      if (error) throw error;
      setMsg('✅ Pedido guardado');
      // Opcional: limpiar
      // router.push('/menu')
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800">
      {/* glow sutil */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />

      <div className="relative z-10 mx-auto w-full max-w-4xl p-4 sm:p-6">
        {/* Encabezado */}
        <header className="mb-4 flex items-center justify-between">
          <div className="text-white">
            <div className="text-lg sm:text-xl">N° <span className="font-bold">{nro ?? '...'}</span></div>
            <div className="text-white/80 text-sm">
              {fecha && new Date(fecha).toLocaleDateString()} &nbsp;→&nbsp; {entrega && new Date(entrega).toLocaleDateString()}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push('/menu')}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/90 hover:bg-white shadow"
              title="Volver"
            >
              <ArrowLeft className="text-violet-700" size={18} />
            </button>
            <button
              disabled={loading}
              onClick={save}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/90 hover:bg-white shadow disabled:opacity-60"
              title="Guardar"
            >
              <Save className="text-violet-700" size={18} />
            </button>
          </div>
        </header>

        {/* Tarjeta principal */}
        <div className="rounded-xl bg-white p-4 shadow">
          {/* Teléfono cliente */}
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">TELÉFONO</label>
            <input
              placeholder="EJ: 998877665"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value.replace(/\s+/g, ''))}
              className="w-full rounded border px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Select artículos */}
          <div className="mb-3 flex gap-2">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded border px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">SELECCIONE UN ARTÍCULO</option>
              {articulos.map(a => (
                <option key={a.id} value={a.id}>
                  {a.nombre} — {a.precio.toFixed(2)}
                </option>
              ))}
            </select>
            <button
              onClick={addArticulo}
              className="rounded bg-purple-600 px-3 py-2 text-white font-semibold hover:bg-purple-700"
            >
              Añadir
            </button>
          </div>

          {/* Detalle */}
          {!!lineas.length && (
            <div className="mb-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="text-gray-500">
                  <tr>
                    <th className="border-b py-1 text-left">Artículo</th>
                    <th className="border-b py-1 w-24">Precio</th>
                    <th className="border-b py-1 w-36">Cantidad</th>
                    <th className="border-b py-1 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map(l => (
                    <tr key={l.articulo_id}>
                      <td className="border-b py-2">{l.nombre}</td>
                      <td className="border-b py-2 text-right">{l.precio.toFixed(2)}</td>
                      <td className="border-b py-2">
                        <div className="flex items-center gap-2">
                          <button onClick={() => changeQty(l.articulo_id, -1)} className="rounded border px-2">-</button>
                          <span className="w-8 text-center">{l.qty}</span>
                          <button onClick={() => changeQty(l.articulo_id, +1)} className="rounded border px-2">+</button>
                        </div>
                      </td>
                      <td className="border-b py-2 text-right">
                        <button onClick={() => removeLinea(l.articulo_id)} className="rounded border px-2 text-red-600">
                          X
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Total */}
          <div className="mb-3 rounded bg-purple-50 px-3 py-2 text-purple-900">
            <span className="font-semibold">Total:&nbsp;</span>
            <span className="text-lg font-bold">{total.toFixed(2)}</span>
          </div>

          {/* Subida de fotos */}
          <div className="mb-2">
            <label className="block text-xs text-gray-500 mb-1">FOTOS (opcional)</label>
            <input type="file" multiple onChange={(e) => onFiles(e.target.files)} />
            {!!fotos.length && (
              <div className="mt-1 text-xs text-gray-600">
                {fotos.length} archivo(s) seleccionado(s)
              </div>
            )}
          </div>

          {/* Mensajes */}
          {msg && <div className="mt-3 text-sm text-gray-700">{msg}</div>}
        </div>
      </div>
    </main>
  );
}


