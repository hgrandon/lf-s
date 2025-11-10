'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

type PedidoEstado = 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGADO' | 'ENTREGAR';
type Item = { articulo: string; qty: number; valor: number };
type Pedido = {
  id: number;            // nro
  cliente: string;       // nombre o teléfono
  telefono?: string|null;
  total: number|null;
  estado: PedidoEstado;
  detalle?: string|null;
  foto_url?: string|null;
  pagado?: boolean|null;
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
        return Array.isArray(arr) && typeof arr[0] === 'string' ? arr[0] : null;
      } catch { return null; }
    }
    return s;
  }
  if (Array.isArray(input) && typeof input[0] === 'string') return input[0];
  return null;
}

export default function ComprobantePage() {
  const { id } = useParams<{ id: string }>();
  const nro = Number(id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [pedido, setPedido] = useState<Pedido | null>(null);

  const totalCalc = useMemo(() => {
    if (!pedido) return 0;
    if (pedido.items?.length) {
      return pedido.items.reduce((a, it) => a + (Number(it.qty)||0) * (Number(it.valor)||0), 0);
    }
    return Number(pedido.total || 0);
  }, [pedido]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) pedir pedido base
        const { data: rows, error: e1 } = await supabase
          .from('pedido')
          .select('id:nro, telefono, total, estado, detalle, pagado, foto_url, created_at')
          .eq('nro', nro)
          .limit(1);
        if (e1) throw e1;
        const r = rows?.[0];
        if (!r) throw new Error('Pedido no encontrado');

        // 2) líneas
        const { data: lineas, error: e2 } = await supabase
          .from('pedido_linea')
          .select('pedido_id, articulo, cantidad, valor')
          .eq('pedido_id', nro);
        if (e2) throw e2;

        // 3) cliente (nombre por teléfono si existe)
        let nombre = '';
        if (r.telefono) {
          const { data: cli } = await supabase
            .from('clientes')
            .select('telefono, nombre, direccion')
            .eq('telefono', r.telefono)
            .limit(1);
          nombre = cli?.[0]?.nombre || '';
        }

        // 4) foto fallback en pedido_foto si no hay principal
        let foto = firstFotoFromMixed(r.foto_url);
        if (!foto) {
          const { data: fotos } = await supabase
            .from('pedido_foto')
            .select('url')
            .eq('pedido_id', nro)
            .limit(1);
          foto = fotos?.[0]?.url || null;
        }

        const items: Item[] = (lineas ?? []).map((l: any) => ({
          articulo: String(l.articulo ?? '').trim() || 'SIN NOMBRE',
          qty: Number(l.cantidad ?? 0),
          valor: Number(l.valor ?? 0),
        }));

        const mapped: Pedido = {
          id: r.id,
          cliente: nombre || String(r.telefono ?? 'SIN NOMBRE'),
          telefono: r.telefono ?? null,
          total: r.total ?? null,
          estado: r.estado,
          detalle: r.detalle ?? null,
          pagado: r.pagado ?? null,
          foto_url: foto,
          items,
        };

        if (!cancelled) {
          setPedido(mapped);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? 'Error al cargar comprobante');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [nro]);

  return (
    <main className="min-h-screen bg-white text-neutral-900 flex items-start justify-center py-8 print:py-0">
      {/* Botonera (oculta al imprimir) */}
      <div className="fixed top-3 right-3 flex gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-violet-600 text-white px-4 py-2 text-sm hover:bg-violet-700"
        >
          Imprimir
        </button>
      </div>

      <div className="w-[420px] max-w-[92vw] bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden print:shadow-none print:border-0">
        {/* Header */}
        <div className="flex items-center gap-3 bg-violet-700 text-white px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-white/20 grid place-items-center font-bold">LF</div>
          <h1 className="font-bold text-lg">Lavandería Fabiola</h1>
        </div>

        <div className="px-4 py-3">
          {loading && <div className="text-sm text-neutral-600">Cargando comprobante…</div>}
          {error && <div className="text-sm text-red-600">⚠️ {error}</div>}

          {pedido && (
            <>
              {/* Encabezado de datos */}
              <div className="text-sm leading-5">
                <div className="font-semibold">Comprobante N° {pedido.id}</div>
                <div>Cliente: {pedido.cliente}</div>
                {pedido.telefono && <div>Teléfono: +{String(pedido.telefono)}</div>}
                <div>Fecha: {new Date().toLocaleString('es-CL')}</div>
              </div>

              <hr className="my-3 border-neutral-300" />

              {/* Tabla */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-neutral-300">
                    <th className="py-2">Artículo</th>
                    <th className="py-2 text-right">Cant.</th>
                    <th className="py-2 text-right">Valor</th>
                    <th className="py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {pedido.items?.length ? (
                    pedido.items.map((it, i) => (
                      <tr key={i} className="border-b border-neutral-200 last:border-0">
                        <td className="py-2 pr-2">{it.articulo}</td>
                        <td className="py-2 text-right">{it.qty}</td>
                        <td className="py-2 text-right">{CLP.format(it.valor)}</td>
                        <td className="py-2 text-right">{CLP.format((it.qty || 0) * (it.valor || 0))}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-2" colSpan={4}>Sin detalle</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Total */}
              <div className="flex justify-end mt-3">
                <div className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 font-extrabold text-violet-700">
                  Total: {CLP.format(totalCalc)}
                </div>
              </div>

              {/* Foto opcional */}
              {typeof pedido.foto_url === 'string' && pedido.foto_url && (
                <div className="mt-4">
                  <Image
                    src={pedido.foto_url}
                    alt={`Foto del pedido ${pedido.id}`}
                    width={800}
                    height={600}
                    className="rounded-lg border border-neutral-200"
                    style={{ width: '100%', height: 'auto' }}
                    unoptimized
                    crossOrigin="anonymous"
                  />
                </div>
              )}

              {/* Footer */}
              <div className="mt-5 text-center">
                <div className="font-semibold text-violet-700">
                  Gracias por preferir Lavandería Fabiola
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  — Comprobante no válido como boleta tributaria —
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reglas de impresión */}
      <style jsx global>{`
        @page { margin: 10mm; }
        @media print {
          html, body { background: #fff !important; }
        }
      `}</style>
    </main>
  );
}
