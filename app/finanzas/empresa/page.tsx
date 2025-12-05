// app/finanzas/empresa/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, ChevronLeft, FileDown } from 'lucide-react';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
);

/* =========================
   Tipos
========================= */

type PedidoEmpresa = {
  nro: number;
  total: number | null;
  pagado: boolean | null;
  fecha_ingreso: string | null;
  tipo_entrega: string | null;
};

type AuthMode = 'clave' | 'usuario';

type LfSession = {
  mode: AuthMode;
  display: string;
  rol?: string | null;
  ts: number;
  ttl: number;
};

/* =========================
   Utilidades
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

/** Normaliza string de fecha a Date local (solo AAAA-MM-DD) */
function parseFecha(fecha: string | null): Date | null {
  if (!fecha) return null;
  const s = fecha.slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function quincenaKey(d: Date): string {
  const q = d.getDate() <= 15 ? 1 : 2;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-Q${q}`;
}

function quincenaLabel(d: Date): string {
  const q = d.getDate() <= 15 ? 1 : 2;
  const base = new Date(d.getFullYear(), d.getMonth(), 1);
  const mes = base.toLocaleString('es-CL', { month: 'short', year: '2-digit' });
  return `${mes.toUpperCase()} · Q${q}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleString('es-CL', { month: 'short', year: '2-digit' }).toUpperCase();
}

function yearKey(d: Date): string {
  return String(d.getFullYear());
}

type GrupoStats = {
  totalPagado: number;
  totalPendiente: number;
  totalGeneral: number;
  cantidadPedidos: number;
};

function addToGrupo(
  map: Map<string, GrupoStats>,
  key: string,
  p: PedidoEmpresa,
) {
  const prev = map.get(key) ?? {
    totalPagado: 0,
    totalPendiente: 0,
    totalGeneral: 0,
    cantidadPedidos: 0,
  };
  const monto = p.total ?? 0;
  const pagado = !!p.pagado;
  const next: GrupoStats = {
    totalPagado: prev.totalPagado + (pagado ? monto : 0),
    totalPendiente: prev.totalPendiente + (!pagado ? monto : 0),
    totalGeneral: prev.totalGeneral + monto,
    cantidadPedidos: prev.cantidadPedidos + 1,
  };
  map.set(key, next);
}

/* =========================
   Página
========================= */

export default function FinanzasEmpresaPage() {
  const router = useRouter();

  // --- Seguridad solo ADMIN ---
  const [authChecked, setAuthChecked] = useState(false);
  const [roleOk, setRoleOk] = useState(false);

  useEffect(() => {
    const sess = readSessionSafely();
    if (!sess) {
      router.replace('/login?next=/finanzas/empresa');
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

  const [pedidos, setPedidos] = useState<PedidoEmpresa[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!roleOk) return;
    (async () => {
      try {
        setLoading(true);
        setLoadError(null);

        // Solo pedidos DOMICILIO (tu definición de EMPRESA)
        const { data, error } = await supabase
          .from('pedido')
          .select('nro, total, pagado, fecha_ingreso, tipo_entrega')
          .eq('tipo_entrega', 'DOMICILIO');

        if (error) {
          console.error('Error cargando pedidos empresa', error);
          setPedidos([]);
          setLoadError(error.message ?? 'No se pudieron cargar los datos.');
        } else {
          setPedidos((data ?? []) as PedidoEmpresa[]);
        }
      } catch (e: any) {
        console.error(e);
        setPedidos([]);
        setLoadError(e?.message ?? 'No se pudieron cargar los datos.');
      } finally {
        setLoading(false);
      }
    })();
  }, [roleOk]);

  /* =========================
     Cálculos generales
  ========================== */

  const {
    totalPagado,
    totalPendiente,
    totalGeneral,
    quincenasArray,
    diarioLabels,
    diarioValores,
    quinLabels,
    quinValores,
    mesLabels,
    mesValores,
    anioLabels,
    anioValores,
  } = useMemo(() => {
    let totalPagado = 0;
    let totalPendiente = 0;
    let totalGeneral = 0;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const desdeDiario = new Date(hoy);
    desdeDiario.setDate(hoy.getDate() - 29); // últimos 30 días

    const quincenaMap = new Map<string, GrupoStats>();
    const diarioMap = new Map<string, number>();
    const quinMap = new Map<string, number>();
    const mesMap = new Map<string, number>();
    const anioMap = new Map<string, number>();

    pedidos.forEach((p) => {
      const monto = p.total ?? 0;
      const pag = !!p.pagado;
      const d = parseFecha(p.fecha_ingreso);
      if (!d) return;

      totalGeneral += monto;
      if (pag) totalPagado += monto;
      else totalPendiente += monto;

      // Quincenas
      const qKey = quincenaKey(d);
      addToGrupo(quincenaMap, qKey, p);

      // Diario (últimos 30 días)
      if (d >= desdeDiario && d <= hoy) {
        const iso = d.toISOString().slice(0, 10);
        diarioMap.set(iso, (diarioMap.get(iso) ?? 0) + monto);
      }

      // Quincenal para gráfico (sólo total general)
      quinMap.set(qKey, (quinMap.get(qKey) ?? 0) + monto);

      // Mensual
      const mKey = monthKey(d);
      mesMap.set(mKey, (mesMap.get(mKey) ?? 0) + monto);

      // Anual
      const yKey = yearKey(d);
      anioMap.set(yKey, (anioMap.get(yKey) ?? 0) + monto);
    });

    // Array de quincenas ordenadas
    const quincenasArray = Array.from(quincenaMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, stats]) => {
        const [yyyy, mm, q] = key.split('-');
        const d = new Date(Number(yyyy), Number(mm) - 1, q === 'Q1' ? 1 : 16);
        return {
          key,
          label: quincenaLabel(d),
          ...stats,
        };
      });

    // Diario
    const diarioKeys = Array.from(diarioMap.keys()).sort();
    const diarioLabels = diarioKeys.map((k) => {
      const [y, m, d] = k.split('-');
      return `${d}-${m}`;
    });
    const diarioValores = diarioKeys.map((k) => diarioMap.get(k) ?? 0);

    // Gráfico quincenal
    const quinKeys = Array.from(quinMap.keys()).sort();
    const quinLabels = quinKeys.map((k) => {
      const [yyyy, mm, q] = k.split('-');
      const d = new Date(Number(yyyy), Number(mm) - 1, q === 'Q1' ? 1 : 16);
      return quincenaLabel(d);
    });
    const quinValores = quinKeys.map((k) => quinMap.get(k) ?? 0);

    // Mensual
    const mesKeys = Array.from(mesMap.keys()).sort();
    const mesLabels = mesKeys.map((k) => {
      const [yyyy, mm] = k.split('-');
      const d = new Date(Number(yyyy), Number(mm) - 1, 1);
      return monthLabel(d);
    });
    const mesValores = mesKeys.map((k) => mesMap.get(k) ?? 0);

    // Anual
    const anioKeys = Array.from(anioMap.keys()).sort();
    const anioLabels = anioKeys;
    const anioValores = anioKeys.map((k) => anioMap.get(k) ?? 0);

    return {
      totalPagado,
      totalPendiente,
      totalGeneral,
      quincenasArray,
      diarioLabels,
      diarioValores,
      quinLabels,
      quinValores,
      mesLabels,
      mesValores,
      anioLabels,
      anioValores,
    };
  }, [pedidos]);

  const lineOptions = {
    responsive: true,
    plugins: {
      legend: {
        labels: { color: '#ffffff' },
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

  const barOptions = lineOptions;

  const diarioData = {
    labels: diarioLabels,
    datasets: [
      {
        label: 'Total diario (DOMICILIO)',
        data: diarioValores,
        borderColor: '#ffffff',
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 3,
      },
    ],
  };

  const quinData = {
    labels: quinLabels,
    datasets: [
      {
        label: 'Total por quincena (DOMICILIO)',
        data: quinValores,
        backgroundColor: 'rgba(245, 158, 11, 0.7)',
        borderColor: '#fbbf24',
        borderWidth: 1.5,
      },
    ],
  };

  const mesData = {
    labels: mesLabels,
    datasets: [
      {
        label: 'Total mensual (DOMICILIO)',
        data: mesValores,
        borderColor: '#ffffff',
        backgroundColor: 'rgba(96, 165, 250, 0.5)',
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 3,
      },
    ],
  };

  const anioData = {
    labels: anioLabels,
    datasets: [
      {
        label: 'Total anual (DOMICILIO)',
        data: anioValores,
        backgroundColor: 'rgba(74, 222, 128, 0.7)',
        borderColor: '#22c55e',
        borderWidth: 1.5,
      },
    ],
  };

  function handleExportPdf() {
    if (typeof window === 'undefined') return;
    // Usas "Imprimir" del navegador y eliges "Guardar como PDF"
    window.print();
  }

  /* =========================
     Renders según seguridad
  ========================== */

  if (!authChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin" size={28} />
          <span className="text-sm opacity-80">Verificando acceso UUD…</span>
        </div>
      </main>
    );
  }

  if (!roleOk) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white">
        <span className="text-sm opacity-80">Acceso restringido. Redirigiendo…</span>
      </main>
    );
  }

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
            onClick={() => router.push('/finanzas')}
            className="rounded-full bg-white/10 hover:bg-white/20 p-2 border border-white/30"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="font-bold text-lg">Finanzas Empresa</h1>
            <p className="text-xs text-white/80">
              Reportes de pedidos de empresas (DOMICILIO).
            </p>
            <p className="text-[11px] text-white/70">Hoy: {hoyTexto}</p>
          </div>
        </div>

        <button
          onClick={handleExportPdf}
          className="inline-flex items-center gap-2 rounded-2xl bg-white/90 text-violet-800 px-4 py-2 text-xs font-semibold shadow hover:bg-white"
        >
          <FileDown size={16} />
          <span>Exportar a PDF</span>
        </button>
      </header>

      <section className="grid gap-4">
        {/* Resumen rápido */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-emerald-500/90 text-white px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide">Pagado (DOMICILIO)</div>
            <div className="text-lg font-extrabold">
              ${totalPagado.toLocaleString('es-CL')}
            </div>
          </div>
          <div className="rounded-2xl bg-amber-500/90 text-white px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide">Pendiente (DOMICILIO)</div>
            <div className="text-lg font-extrabold">
              ${totalPendiente.toLocaleString('es-CL')}
            </div>
          </div>
          <div className="col-span-2 rounded-2xl bg-black/15 border border-white/20 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide">Total general</div>
            <div className="text-xl font-extrabold">
              ${totalGeneral.toLocaleString('es-CL')}
            </div>
          </div>
        </div>

        {/* Histórico por quincenas */}
        <div className="rounded-2xl bg-black/20 border border-white/25 p-3 text-xs">
          <div className="mb-2 text-white/90 font-semibold">
            Histórico por quincenas (1–15 / 16–fin de mes)
          </div>
          <div className="overflow-auto max-h-[32vh]">
            <table className="w-full">
              <thead className="border-b border-white/20 text-[11px] text-white/80">
                <tr>
                  <th className="text-left py-1 px-2">Periodo</th>
                  <th className="text-right py-1 px-2">Pagado</th>
                  <th className="text-right py-1 px-2">Pendiente</th>
                  <th className="text-right py-1 px-2">Total</th>
                  <th className="text-center py-1 px-2"># Ped.</th>
                </tr>
              </thead>
              <tbody>
                {quincenasArray.map((q) => (
                  <tr key={q.key} className="border-b border-white/10">
                    <td className="py-1 px-2">{q.label}</td>
                    <td className="py-1 px-2 text-right">
                      ${q.totalPagado.toLocaleString('es-CL')}
                    </td>
                    <td className="py-1 px-2 text-right">
                      ${q.totalPendiente.toLocaleString('es-CL')}
                    </td>
                    <td className="py-1 px-2 text-right">
                      ${q.totalGeneral.toLocaleString('es-CL')}
                    </td>
                    <td className="py-1 px-2 text-center">{q.cantidadPedidos}</td>
                  </tr>
                ))}
                {quincenasArray.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-3 text-center text-white/70"
                    >
                      Aún no hay pedidos DOMICILIO para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gráfico diario */}
        <div className="rounded-2xl bg-black/25 border border-white/20 p-4">
          <div className="mb-2 text-xs text-white/80">
            Gráfico diario (últimos 30 días, pedidos DOMICILIO):
          </div>
          {diarioLabels.length > 0 ? (
            <Line data={diarioData} options={lineOptions} />
          ) : (
            <div className="text-xs text-white/70">
              Sin datos suficientes para el gráfico diario.
            </div>
          )}
        </div>

        {/* Gráfico quincenal */}
        <div className="rounded-2xl bg-black/25 border border-white/20 p-4">
          <div className="mb-2 text-xs text-white/80">
            Gráfico por quincenas (1–15 y 16–fin de mes):
          </div>
          {quinLabels.length > 0 ? (
            <Bar data={quinData} options={barOptions} />
          ) : (
            <div className="text-xs text-white/70">
              Sin datos para el gráfico quincenal.
            </div>
          )}
        </div>

        {/* Gráfico mensual */}
        <div className="rounded-2xl bg-black/25 border border-white/20 p-4">
          <div className="mb-2 text-xs text-white/80">
            Gráfico mensual (DOMICILIO – últimos meses):
          </div>
          {mesLabels.length > 0 ? (
            <Line data={mesData} options={lineOptions} />
          ) : (
            <div className="text-xs text-white/70">
              Sin datos para el gráfico mensual.
            </div>
          )}
        </div>

        {/* Gráfico anual */}
        <div className="rounded-2xl bg-black/25 border border-white/20 p-4 mb-4">
          <div className="mb-2 text-xs text-white/80">
            Gráfico anual (DOMICILIO):
          </div>
          {anioLabels.length > 0 ? (
            <Bar data={anioData} options={barOptions} />
          ) : (
            <div className="text-xs text-white/70">
              Sin datos para el gráfico anual.
            </div>
          )}
        </div>

        {loadError && (
          <div className="text-xs text-amber-200">
            {loadError}
          </div>
        )}
      </section>
    </main>
  );
}
