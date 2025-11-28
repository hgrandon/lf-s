'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, ChevronLeft } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { useRouter } from 'next/navigation';

ChartJS.register(ArcElement, Tooltip, Legend);

type Pedido = {
  nro: number;
  total: number;
  pagado: boolean;
  fecha_ingreso: string;
};

type Filtro = 'HOY' | 'SEMANA' | 'MES' | 'AÑO' | 'TODO';

export default function FinanzasPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('MES');
  const [loading, setLoading] = useState(false);

  async function cargar() {
    setLoading(true);

    const hoy = new Date();
    let desde: string | null = null;

    switch (filtro) {
      case 'HOY':
        desde = hoy.toISOString().slice(0, 10);
        break;

      case 'SEMANA': {
        const d = new Date();
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
      .select('nro,total,pagado,fecha_ingreso');

    if (desde) query = query.gte('fecha_ingreso', desde);

    const { data, error } = await query;

    if (!error && data) {
      setPedidos(data as Pedido[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, [filtro]);

  const totalPagado = pedidos.filter(p => p.pagado).reduce((a, b) => a + (b.total ?? 0), 0);
  const totalPendiente = pedidos.filter(p => !p.pagado).reduce((a, b) => a + (b.total ?? 0), 0);

  const dataChart = {
    labels: ['Pagado', 'Pendiente'],
    datasets: [
      {
        data: [totalPagado, totalPendiente],
        backgroundColor: ['#10b981', '#f59e0b'],
        borderColor: ['#064e3b', '#b45309'],
        borderWidth: 2,
      },
    ],
  };

  const totalGeneral = totalPagado + totalPendiente;

  return (
    <main className="min-h-screen bg-white text-violet-800 p-6">
      <header className="flex items-center gap-4 mb-4">
        <button
          onClick={() => router.push('/base')}
          className="text-violet-600 hover:text-violet-800"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="font-bold text-xl">Finanzas</h1>
      </header>

      <div className="grid gap-4">
        {/* FILTROS */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['HOY', 'SEMANA', 'MES', 'AÑO', 'TODO'] as Filtro[]).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-2 rounded-xl border text-sm
              ${filtro === f ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-700 border-violet-300'}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* RESUMEN */}
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl p-4 bg-emerald-200 text-emerald-900 font-semibold">
            PAGADO
            <div className="text-lg">${totalPagado.toLocaleString('es-CL')}</div>
          </div>
          <div className="rounded-xl p-4 bg-amber-200 text-amber-900 font-semibold">
            PENDIENTE
            <div className="text-lg">${totalPendiente.toLocaleString('es-CL')}</div>
          </div>
          <div className="col-span-2 rounded-xl p-4 bg-violet-500 text-white font-bold">
            TOTAL: ${totalGeneral.toLocaleString('es-CL')}
          </div>
        </div>

        {/* GRÁFICO */}
        <div className="rounded-2xl bg-white shadow p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-violet-800">
              <Loader2 className="animate-spin" size={18} />
              Cargando...
            </div>
          ) : (
            <Doughnut data={dataChart} />
          )}
        </div>

        {/* LISTADO */}
        <div className="rounded-2xl bg-violet-100 p-4 border border-violet-200 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-violet-700">
              <tr>
                <th>Pedido</th>
                <th>Total</th>
                <th>Pago</th>
              </tr>
            </thead>
            <tbody className="text-violet-900">
              {pedidos.map((p) => (
                <tr key={p.nro} className="border-b border-violet-300/30">
                  <td>#{p.nro}</td>
                  <td>${p.total?.toLocaleString('es-CL') ?? '0'}</td>
                  <td>{p.pagado ? 'Pagado' : 'Pendiente'}</td>
                </tr>
              ))}

              {pedidos.length === 0 && (
                <tr>
                  <td className="py-3 text-center text-violet-700" colSpan={3}>
                    Sin datos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}
