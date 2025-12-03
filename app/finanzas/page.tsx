// app/finanzas/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, ChevronLeft } from 'lucide-react';
import { Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
} from 'chart.js';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
);

/* =========================
   Tipos
========================= */

type Pedido = {
  nro: number;
  total: number | null;
  pagado: boolean | null;
  fecha_ingreso: string | null;
};

type Filtro = 'HOY' | 'SEMANA' | 'MES' | 'AÑO' | 'TODO';

type AuthMode = 'clave' | 'usuario';

type LfSession = {
  mode: AuthMode;
  display: string;
  rol?: string | null;
  ts: number;
  ttl: number;
};

/* =========================
   Utilidades UUD
========================= */

function readSessionSafely(): LfSession | null {
  try {
    const raw = localStorage.getItem('lf_auth');
    if (!raw) return null;
    const s = JSON.parse(raw) as LfSession;
    if (!s || !s.ts || !s.ttl) return null;

    const expired = Date.now() - s.ts > s.ttl;
    if (expired) {
      localStorage.removeItem('lf_auth');
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

/** Normaliza un string de fecha a Date (o null) */
function parseFecha(fecha: string | null): Date | null {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Devuelve la fecha "desde" según filtro, o null si es TODO */
function getDesdeISO(filtro: Filtro): string | null {
  const hoy = new Date();

  switch (filtro) {
    case 'HOY': {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      return d.toISOString();
    }
    case 'SEMANA': {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() - 7);
      return d.toISOString();
    }
    case 'MES': {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return d.toISOString();
    }
    case 'AÑO': {
      const d = new Date(hoy.getFullYear(), 0, 1);
      return d.toISOString();
    }
    case 'TODO':
    default:
      return null;
  }
}

/** Cantidad de días del mes de una fecha dada */
function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Llave AAAA-MM para agrupar por mes */
function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* =========================
   Página
========================= */

export default function FinanzasPage() {
  const router = useRouter();

  // --- Seguridad: solo ADMIN ---
  const [authChecked, setAuthChecked] = useState(false);
  const [roleOk, setRoleOk] = useState(false);

  useEffect(() => {
    const sess = readSessionSafely();

    if (!sess) {
      router.replace('/login?next=/finanzas');
      setRoleOk(false);
      setAuthChecked(true);
      return;
    }

    if ((sess.rol || '').toUpperCase() !== 'ADMIN') {
      router.replace('/base');
      setRoleOk(false);
      setAuthChecked(true);
      return;
    }

    setRoleOk(true);
    setAuthChecked(true);
  }, [router]);

  // --- Estados normales de la página ---
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('HOY'); // 👉 siempre parte en HOY
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Dataset histórico (para comparaciones y 5 meses)
  const [hist, setHist] = useState<Pedido[]>([]);
  const [histLoaded, setHistLoaded] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);

  /* ------- Carga para el filtro seleccionado (HOY / SEMANA / etc.) ------- */
  async function cargarDatos() {
    try {
      setLoading(true);
      setLoadError(null);

      const desde = getDesdeISO(filtro);

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
        setLoadError(error.message ?? 'No se pudieron cargar los datos.');
      } else {
        setPedidos((data ?? []) as Pedido[]);
      }
    } catch (e: any) {
      console.error(e);
      setPedidos([]);
      setLoadError(e?.message ?? 'No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  }

  /* ------- Carga histórica para comparaciones y 5 meses ------- */
  async function cargarHist() {
    try {
      setHistError(null);
      const hoy = new Date();
      // desde 5 meses atrás (inicio de mes)
      const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1);

      const { data, error } = await supabase
        .from('pedido')
        .select('nro, total, pagado, fecha_ingreso')
        .gte('fecha_ingreso', desde.toISOString());

      if (error) {
        console.error('Error cargando histórico finanzas', error);
        setHist([]);
        setHistError(error.message ?? 'No se pudo cargar histórico.');
      } else {
        setHist((data ?? []) as Pedido[]);
      }
    } catch (e: any) {
      console.error(e);
      setHist([]);
      setHistError(e?.message ?? 'No se pudo cargar histórico.');
    } finally {
      setHistLoaded(true);
    }
  }

  useEffect(() => {
    if (!roleOk) return;
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, roleOk]);

  useEffect(() => {
    if (!roleOk || histLoaded) return;
    cargarHist();
  }, [roleOk, histLoaded]);

  // Totales para el filtro actual
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

  /* =========================
     Comparación HOY vs AYER vs MISMO DÍA MES ANTERIOR
  ========================== */

  const {
    comparacionLabels,
    comparacionMontos,
    proyeccionFinDeMes,
    mesesLabels,
    mesesMontos,
  } = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);

    const mismoDiaMesAnterior = new Date(hoy);
    mismoDiaMesAnterior.setMonth(mismoDiaMesAnterior.getMonth() - 1);

    const sumForDay = (target: Date) =>
      hist
        .filter((p) => {
          const d = parseFecha(p.fecha_ingreso);
          return d ? isSameDay(d, target) : false;
        })
        .reduce((acc, p) => acc + (p.total ?? 0), 0);

    const montoHoy = sumForDay(hoy);
    const montoAyer = sumForDay(ayer);
    const montoMismoDiaMesAnterior = sumForDay(mismoDiaMesAnterior);

    const labelsComp = [
      mismoDiaMesAnterior.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
      }),
      ayer.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
      }),
      hoy.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
      }),
    ];

    const montosComp = [
      montoMismoDiaMesAnterior,
      montoAyer,
      montoHoy,
    ];

    // Proyección fin de mes (usando TOTAL de este mes, pagado + pendiente)
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const diasMes = daysInMonth(hoy);
    const diaActual = hoy.getDate();

    const totalMes = hist
      .filter((p) => {
        const d = parseFecha(p.fecha_ingreso);
        if (!d) return false;
        return (
          d.getFullYear() === hoy.getFullYear() &&
          d.getMonth() === hoy.getMonth()
        );
      })
      .reduce((acc, p) => acc + (p.total ?? 0), 0);

    const diasTranscurridos = Math.max(1, diaActual);
    const promedioDiario = totalMes / diasTranscurridos;
    const proy = promedioDiario * diasMes;

    // Últimos 5 meses (incluyendo el actual)
    const meses: { key: string; label: string }[] = [];
    for (let i = 4; i >= 0; i--) {
      const base = new Date(
        hoy.getFullYear(),
        hoy.getMonth() - i,
        1,
      );
      meses.push({
        key: monthKey(base),
        label: base.toLocaleString('es-CL', {
          month: 'short',
          year: '2-digit',
        }),
      });
    }

    const montosPorMes = new Map<string, number>();
    hist.forEach((p) => {
      const d = parseFecha(p.fecha_ingreso);
      if (!d) return;
      const key = monthKey(d);
      const prev = montosPorMes.get(key) ?? 0;
      montosPorMes.set(key, prev + (p.total ?? 0));
    });

    const montosMeses = meses.map(
      (m) => montosPorMes.get(m.key) ?? 0,
    );
    const labelsMeses = meses.map((m) => m.label);

    return {
      comparacionLabels: labelsComp,
      comparacionMontos: montosComp,
      proyeccionFinDeMes: proy,
      mesesLabels: labelsMeses,
      mesesMontos: montosMeses,
    };
  }, [hist]);

  const comparacionLineData = {
    labels: comparacionLabels,
    datasets: [
      {
        label: 'Total día (pagado + pendiente)',
        data: comparacionMontos,
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 4,
      },
    ],
  };

  const mesesLineData = {
    labels: mesesLabels,
    datasets: [
      {
        label: 'Total mensual (pagado + pendiente)',
        data: mesesMontos,
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 4,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: '#ffffff',
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255,255,255,0.08)' },
      },
      y: {
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255,255,255,0.08)' },
      },
    },
  } as const;

  /* =========================
     Renders según seguridad
  ========================== */

  if (!authChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin" size={28} />
          <span className="text-sm opacity-80">
            Verificando acceso UUD…
          </span>
        </div>
      </main>
    );
  }

  if (!roleOk) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white">
        <span className="text-sm opacity-80">
          Acceso restringido. Redirigiendo…
        </span>
      </main>
    );
  }

  /* =========================
     Página visible solo ADMIN
  ========================== */

  const hoyTexto = new Date().toLocaleDateString('es-CL', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white px-4 py-4">
      {/* HEADER */}
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/base')}
            className="rounded-full bg-white/10 hover:bg-white/20 p-2 border border-white/30"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="font-bold text-lg">Finanzas</h1>
            <p className="text-xs text-white/80">
              Resumen de ingresos y pagos (solo ADMIN)
            </p>
            <p className="text-[11px] text-white/70">
              Hoy: {hoyTexto}
            </p>
          </div>
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
                'px-3 py-2 rounded-2xl text-xs border whitespace-nowrap',
                filtro === f
                  ? 'bg-white text-violet-700 border-white'
                  : 'bg-white/10 border-white/30 text-white/90',
              ].join(' ')}
            >
              {f}
            </button>
          ))}
        </div>

        {/* RESUMEN RÁPIDO DEL RANGO SELECCIONADO */}
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

        {/* PROYECCIÓN A FIN DE MES */}
        <div className="rounded-2xl bg-black/25 border border-emerald-400/40 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-emerald-200">
                Proyección fin de mes (total)
              </div>
              <div className="text-xl font-extrabold text-emerald-100">
                $
                {Math.round(proyeccionFinDeMes || 0).toLocaleString(
                  'es-CL',
                )}
              </div>
            </div>
            <div className="text-[11px] text-white/70 text-right">
              Basado en el promedio diario del mes actual
              (ingresos pagados + pendientes).
            </div>
          </div>
        </div>

        {/* GRÁFICO DONUT PAGADO / PENDIENTE */}
        <div className="rounded-2xl bg-black/20 border border-white/20 p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-white/90">
              <Loader2 className="animate-spin" size={18} />
              Cargando…
            </div>
          ) : (
            <>
              {loadError && (
                <div className="mb-2 text-xs text-amber-200">
                  {loadError}
                </div>
              )}
              <Doughnut data={chartData} />
            </>
          )}
        </div>

        {/* GRÁFICO LÍNEA: HOY vs AYER vs MISMO DÍA MES ANTERIOR */}
        <div className="rounded-2xl bg-black/25 border border-white/20 p-4">
          <div className="mb-2 text-xs text-white/80">
            Comparación diaria (monto total del día, pagado + pendiente):
          </div>
          {histLoaded && hist.length > 0 ? (
            <Line data={comparacionLineData} options={lineOptions} />
          ) : (
            <div className="text-xs text-white/70">
              Aún no hay histórico suficiente para la comparación.
              {histError && (
                <div className="mt-1 text-amber-200">{histError}</div>
              )}
            </div>
          )}
        </div>

        {/* GRÁFICO LÍNEA: ÚLTIMOS 5 MESES */}
        <div className="rounded-2xl bg-black/25 border border-white/20 p-4">
          <div className="mb-2 text-xs text-white/80">
            Últimos 5 meses (total mensual, pagado + pendiente):
          </div>
          {histLoaded && hist.length > 0 ? (
            <Line data={mesesLineData} options={lineOptions} />
          ) : (
            <div className="text-xs text-white/70">
              Sin datos para los últimos meses.
              {histError && (
                <div className="mt-1 text-amber-200">{histError}</div>
              )}
            </div>
          )}
        </div>

        {/* TABLA DEL RANGO SELECCIONADO */}
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
                    {(p.total ?? 0).toLocaleString('es-CL', {
                      style: 'currency',
                      currency: 'CLP',
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="py-1 text-center">
                    {p.pagado ? 'Pagado' : 'Pendiente'}
                  </td>
                </tr>
              ))}
              {pedidos.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={3}
                    className="py-3 text-center text-white/70"
                  >
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
