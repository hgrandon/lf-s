// app/finanzas/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, ChevronLeft } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

type Pedido = {
  nro: number;
  total: number | null;
  pagado: boolean | null;
  fecha_ingreso: string | null;
};

type Filtro = 'HOY' | 'SEMANA' | 'MES' | 'AÑO' | 'TODO';

export default function FinanzasPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('MES');
  const [loading, setLoading] = useState(false);

  async function cargarDatos() {
    setLoading(true);

    const hoy = new Date();
    let desde: string | null = null;

    switch (filtro) {
      case 'HOY': {
        const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        desde = d.toISOString();
        break;
      }
      case 'SEMANA': {
        const d = new Date(hoy);
        d.setDate(hoy.getDate() - 7);
        desde = d.toISOString();
        break;
      }
      case 'MES': {
        const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        desde = d.toISOString();
        break;
      }
      case 'AÑO': {
        const d = new Date(hoy.getFullYear(), 0, 1);
        desde = d.toISOString();
        break;
      }
      case 'TODO':
        desde = null;
        break;
    }

    let query = supabase
      .from('pedido')
      .select('nro, total, pagado, fecha_ingreso');

    if (desde) {
      query = query.gte('fecha_ingreso', desde);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error cargando pedidos finanzas', error);
      setPedidos([]);
    } else {
      setPedidos((data ?? []) as Pedido[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  const totalPagado = pedidos
    .filter((p) => p.pagado)
    .reduce((acc, p) => acc + (p.total ?? 0), 0);

  const totalPendiente = pedidos
    .filter((p) => !p.pagado)
    .reduce((acc, p) => acc + (p.total ?? 0), 0);

  const totalGeneral = totalPagado + totalPendiente;

  const chartData = {
    labels: ['Pagado', 'Pendiente'],
    datasets: [
      {
        data: [totalPagado, totalPendiente],
        backgroundColor: ['#22c55e', '#eab308'],
        borderColor: ['#15803d', '#b45309'],
        borderWidth: 2,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white px-4 py-4">
      {/* HEADER */}
      <header className="flex items-center gap-3 mb-4">
        <button
          onClick={() => router.push('/base')}
          className="rounded-full bg-white/10 hover:bg-white/20 p-2 border border-white/30"
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="font-bold text-lg">Finanzas</h1>
          <p className="text-xs text-white/80">
            Resumen de ingresos y pagos
          </p>
        </div>
      </header>

      <section className="grid gap-4">
        {/* FILTROS */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['HOY', 'SEMANA', 'MES', 'AÑO', 'TODO'] as Filtro[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={[
                'px-3 py-2 rounded-2xl text-xs border',
                filtro === f
                  ? 'bg-white text-violet-700 border-white'
                  : 'bg-white/10 border-white/30 text-white/90',
              ].join(' ')}
            >
              {f}
            </button>
          ))}
        </div>

        {/* RESUMEN */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-emerald-500/90 text-white px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide">
              Pagado
            </div>
            <div className="text-lg font-extrabold">
              ${totalPagado.toLocaleString('es-CL')}
            </div>
          </div>
          <div className="rounded-2xl bg-amber-500/90 text-white px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide">
              Pendiente
            </div>
            <div className="text-lg font-extrabold">
              ${totalPendiente.toLocaleString('es-CL')}
            </div>
          </div>
          <div className="col-span-2 rounded-2xl bg-black/15 border border-white/20 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide">
              Total
            </div>
            <div className="text-xl font-extrabold">
              ${totalGeneral.toLocaleString('es-CL')}
            </div>
          </div>
        </div>

        {/* GRÁFICO */}
        <div className="rounded-2xl bg-black/20 border border-white/20 p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-white/90">
              <Loader2 className="animate-spin" size={18} />
              Cargando…
            </div>
          ) : (
            <Doughnut data={chartData} />
          )}
        </div>

        {/* TABLA */}
        <div className="rounded-2xl bg-black/20 border border-white/20 p-3 text-xs overflow-auto max-h-[40vh]">
          <table className="w-full">
            <thead className="text-white/80 border-b border-white/20">
              <tr>
                <th className="text-left py-1">Pedido</th>
                <th className="text-right py-1">Total</th>
                <th className="text-center py-1">Pago</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.nro} className="border-b border-white/10">
                  <td className="py-1">#{p.nro}</td>
                  <td className="py-1 text-right">
                    ${(p.total ?? 0).toLocaleString('es-CL')}
                  </td>
                  <td className="py-1 text-center">
                    {p.pagado ? 'Pagado' : 'Pendiente'}
                  </td>
                </tr>
              ))}
              {pedidos.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-white/70">
                    Sin datos en este rango.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
