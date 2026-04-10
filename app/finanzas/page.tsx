// app/finanzas/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, ChevronLeft, ChevronDown, CreditCard } from 'lucide-react';
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

type DeudorInfo = { 
  nro: number; 
  total: number; 
  telefono: string | null; 
  clienteNombre: string; 
  fecha_ingreso: string | null 
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

/**
 * Normaliza un string de fecha a Date local SIN problemas de zona horaria.
 * Asume formato "AAAA-MM-DD" o ISO y usa solo los primeros 10 caracteres.
 */
function parseFecha(fecha: string | null): Date | null {
  if (!fecha) return null;
  const s = fecha.slice(0, 10); // "2025-12-02"
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
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
  const [filtro, setFiltro] = useState<Filtro>('HOY'); // siempre parte en HOY
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Deuda total global
  const [deudaHistorica, setDeudaHistorica] = useState(0);

  // Dataset histórico (para comparaciones y 12 meses)
  const [hist, setHist] = useState<Pedido[]>([]);
  const [histLoaded, setHistLoaded] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);

  // acordeón del gráfico circular
  const [showPie, setShowPie] = useState(false);

  // modal de deudores
  const [showDeudores, setShowDeudores] = useState(false);
  const [deudoresList, setDeudoresList] = useState<DeudorInfo[]>([]);
  const [loadingDeudores, setLoadingDeudores] = useState(false);

  async function abrirYcargarDeudores() {
    setShowDeudores(true);
    if (deudoresList.length > 0) return; // cachear
    setLoadingDeudores(true);
    try {
       const { data: pData } = await supabase.from('pedido').select('nro, total, telefono, fecha_ingreso').eq('pagado', false).eq('estado', 'ENTREGADO');
       if (!pData || pData.length === 0) {
          setDeudoresList([]);
          return;
       }
       
       const rawDeudores = pData as {nro: number, total: number | null, telefono: string | null, fecha_ingreso: string | null}[];
       const tels = [...new Set(rawDeudores.map(r => r.telefono).filter(Boolean))] as string[];
       
       const cliMap = new Map<string, string>();
       if (tels.length > 0) {
         const { data: cData } = await supabase.from('clientes').select('telefono, nombre').in('telefono', tels);
         (cData || []).forEach(c => cliMap.set(c.telefono, c.nombre));
       }

       const mapped = rawDeudores.map(r => ({
         nro: r.nro,
         total: r.total ?? 0,
         telefono: r.telefono ?? null,
         clienteNombre: (r.telefono && cliMap.get(r.telefono)) ? cliMap.get(r.telefono)! : 'Sin Nombre',
         fecha_ingreso: r.fecha_ingreso
       })).sort((a,b) => b.nro - a.nro);
       
       setDeudoresList(mapped);
    } catch (e) {
       console.error(e);
    } finally {
       setLoadingDeudores(false);
    }
  }

  const generarWA = (p: DeudorInfo) => {
    if (!p.telefono) return '#';
    const numero = String(p.telefono).replace(/\D/g, '');
    const finalNum = numero.startsWith('56') ? numero : (numero.length === 9 ? `56${numero}` : numero);
    const mensaje = `Hola ${p.clienteNombre || ''}! Te recordamos de Lavandería Fabiola que tienes pendiente el pago del servicio N° ${p.nro} por un total de $${(p.total ?? 0).toLocaleString('es-CL')}.`;
    return `https://wa.me/${finalNum}?text=${encodeURIComponent(mensaje)}`;
  }

  async function marcarDeudaPagada(nro: number) {
    if (!confirm(`¿Estás seguro de marcar el servicio N° ${nro} como pagado?`)) return;
    try {
      const { error } = await supabase.from('pedido').update({ pagado: true }).eq('nro', nro);
      if (error) throw error;
      setDeudoresList(prev => prev.filter(d => d.nro !== nro));
      cargarDatos();
      cargarDeudaHistorica();
    } catch (e) {
      console.error(e);
      alert('Hubo un error al marcar el pedido como pagado.');
    }
  }

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

  /* ------- Carga de Deuda Histórica Total ------- */
  async function cargarDeudaHistorica() {
    try {
      const { data, error } = await supabase
        .from('pedido')
        .select('total')
        .eq('pagado', false)
        .eq('estado', 'ENTREGADO');
        
      if (!error && data) {
        setDeudaHistorica(data.reduce((acc, p) => acc + (p.total ?? 0), 0));
      }
    } catch (e) {
      console.error(e);
    }
  }

  /* ------- Carga histórica para comparaciones y 12 meses ------- */
  async function cargarHist() {
    try {
      setHistError(null);
      const hoy = new Date();
      // desde 12 meses atrás (inicio de mes) para comparar YoY
      const desde = new Date(hoy.getFullYear() - 1, hoy.getMonth(), 1);

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
    cargarDeudaHistorica();
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
    deudaMesActual,
    totalEsteMes,
    totalMismoMesAnoPasado,
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

    const montosComp = [montoMismoDiaMesAnterior, montoAyer, montoHoy];

    // Proyección fin de mes (usando TOTAL de este mes, pagado + pendiente)
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
      const base = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
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

    const montosMeses = meses.map((m) => montosPorMes.get(m.key) ?? 0);
    const labelsMeses = meses.map((m) => m.label);

    const deudaMesAct = hist
      .filter((p) => {
        const d = parseFecha(p.fecha_ingreso);
        if (!d) return false;
        return !p.pagado && d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth();
      })
      .reduce((acc, p) => acc + (p.total ?? 0), 0);

    const totalAnoPasado = hist
      .filter((p) => {
        const d = parseFecha(p.fecha_ingreso);
        if (!d) return false;
        return d.getFullYear() === hoy.getFullYear() - 1 && d.getMonth() === hoy.getMonth();
      })
      .reduce((acc, p) => acc + (p.total ?? 0), 0);

    return {
      comparacionLabels: labelsComp,
      comparacionMontos: montosComp,
      proyeccionFinDeMes: proy,
      mesesLabels: labelsMeses,
      mesesMontos: montosMeses,
      deudaMesActual: deudaMesAct,
      totalEsteMes: totalMes,
      totalMismoMesAnoPasado: totalAnoPasado,
    };
  }, [hist]);

  const comparacionLineData = {
    labels: comparacionLabels,
    datasets: [
      {
        label: 'Total día (pagado + pendiente)',
        data: comparacionMontos,
        borderColor: '#ffffff',
        borderWidth: 2.5,
        tension: 0.35,
        pointBackgroundColor: '#facc15',
        pointBorderColor: '#000000',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointHoverBorderWidth: 2.5,
      },
    ],
  };

  const mesesLineData = {
    labels: mesesLabels,
    datasets: [
      {
        label: 'Total mensual (pagado + pendiente)',
        data: mesesMontos,
        borderColor: '#ffffff',
        borderWidth: 2.5,
        tension: 0.25,
        pointBackgroundColor: '#facc15',
        pointBorderColor: '#000000',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointHoverBorderWidth: 2.5,
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

  // Calculate percentage variation YoY
  let varPct = 0;
  if (totalMismoMesAnoPasado && totalMismoMesAnoPasado > 0) {
    varPct = ((totalEsteMes - totalMismoMesAnoPasado) / totalMismoMesAnoPasado) * 100;
  }
  const isVarPositive = varPct >= 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white px-4 py-4 pb-16">
      {/* HEADER */}
      <header className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/base')}
            className="rounded-full bg-white/10 hover:bg-white/20 p-2 border border-white/30 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="font-extrabold text-xl tracking-tight">Finanzas</h1>
            <p className="text-xs text-white/70 font-medium">
              Hoy: {hoyTexto}
            </p>
          </div>
        </div>
        <button
            onClick={() => router.push('/finanzas/empresa')}
            className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 px-3 py-2 text-xs font-bold transition-colors shadow-sm"
          >
            Empresa
          </button>
      </header>

      <section className="grid gap-5">
        {/* PANELES DE DEUDA FIJAS */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col justify-between hover:bg-white/15 transition-colors">
            <span className="text-[10px] uppercase tracking-wider text-white/70 font-bold mb-1">Deuda Histórica</span>
            {loading && deudaHistorica === 0 ? (
                <div className="h-7 w-20 bg-white/20 animate-pulse rounded"></div>
            ) : (
                <span className="text-xl sm:text-2xl font-extrabold text-amber-300 drop-shadow-[0_2px_10px_rgba(251,191,36,0.3)]">
                ${deudaHistorica.toLocaleString('es-CL')}
                </span>
            )}
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col justify-between hover:bg-white/15 transition-colors">
            <span className="text-[10px] uppercase tracking-wider text-white/70 font-bold mb-1">Deuda Mes Actual</span>
            {loading && deudaMesActual === undefined ? (
                <div className="h-7 w-20 bg-white/20 animate-pulse rounded"></div>
            ) : (
                <span className="text-xl sm:text-2xl font-extrabold text-emerald-300 drop-shadow-[0_2px_10px_rgba(52,211,153,0.3)]">
                ${(deudaMesActual || 0).toLocaleString('es-CL')}
                </span>
            )}
          </div>
        </div>

        <button
           onClick={abrirYcargarDeudores}
           className="w-full rounded-2xl bg-gradient-to-r from-red-500/20 to-amber-500/20 border border-white/20 p-4 shadow-lg flex items-center justify-between hover:bg-white/10 transition-all font-extrabold text-amber-100"
        >
           <div className="flex items-center gap-3">
             <div className="bg-red-500/30 p-2 rounded-full">
                <svg className="w-5 h-5 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
             </div>
             Ver Todo el Listado de Deudores
           </div>
           <span>→</span>
        </button>

        {/* COMPARATIVA AÑO A AÑO */}
        <div className="rounded-2xl bg-black/25 backdrop-blur-md border border-white/15 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.15)] flex items-center justify-between hover:bg-black/30 transition-colors">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/70 font-bold">Variación (YoY)</div>
            <div className="text-xs text-white/50 mt-0.5 font-medium">Este mes vs {hoyTexto.slice(-4) ? Number(hoyTexto.slice(-4)) - 1 : 'año pasado'}</div>
          </div>
          <div className="text-right">
             <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-black ${isVarPositive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                {isVarPositive ? '+' : ''}{varPct.toFixed(1)}%
             </div>
          </div>
        </div>

        {/* FILTROS TIPO PÍLDORA */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
          {(['HOY', 'SEMANA', 'MES', 'AÑO', 'TODO'] as Filtro[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={[
                'px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 snap-center',
                filtro === f
                  ? 'bg-white text-violet-900 shadow-[0_0_15px_rgba(255,255,255,0.4)]'
                  : 'bg-white/10 hover:bg-white/20 text-white/80 border border-white/5'
              ].join(' ')}
            >
              {f}
            </button>
          ))}
        </div>

        {/* RESUMEN DEL FILTRO */}
        <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-black/20 border border-white/10 p-3 text-center transition-colors">
                <div className="text-[10px] text-emerald-200/80 uppercase font-bold mb-1">Pagado</div>
                <div className="font-extrabold text-sm">${totalPagado.toLocaleString('es-CL')}</div>
            </div>
            <div className="rounded-xl bg-black/20 border border-white/10 p-3 text-center transition-colors">
                <div className="text-[10px] text-amber-200/80 uppercase font-bold mb-1">Pendiente</div>
                <div className="font-extrabold text-sm">${totalPendiente.toLocaleString('es-CL')}</div>
            </div>
            <div className="rounded-xl bg-white/15 border border-white/20 p-3 text-center ring-1 ring-white/10 transition-colors">
                <div className="text-[10px] text-white/80 uppercase font-bold mb-1">Total Rango</div>
                <div className="font-extrabold text-white text-sm">${totalGeneral.toLocaleString('es-CL')}</div>
            </div>
        </div>

        {/* GRÁFICO DONUT EN ACORDEÓN */}
        <div className="rounded-2xl bg-black/20 border border-white/15 overflow-hidden transition-colors">
          <button
            type="button"
            onClick={() => setShowPie((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold hover:bg-white/5 transition-colors"
          >
            <span>Distribución de pagos</span>
            <ChevronDown
              size={18}
              className={`transition-transform duration-300 ${showPie ? 'rotate-180' : ''}`}
            />
          </button>

          {showPie && (
            <div className="p-4 border-t border-white/10">
              {loading && pedidos.length === 0 ? (
                <div className="flex items-center justify-center gap-2 text-white/70 py-4">
                  <Loader2 className="animate-spin" size={18} />
                  <span className="text-xs">Cargando gráfico…</span>
                </div>
              ) : (
                <>
                  {loadError && (
                    <div className="mb-2 text-xs text-amber-200">
                      {loadError}
                    </div>
                  )}
                  <div className="max-w-[200px] mx-auto">
                    <Doughnut data={chartData} options={{ maintainAspectRatio: true }} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* COMPARATIVA DIARIA Y PROYECCIÓN */}
        <div className="rounded-2xl bg-black/20 border border-white/15 p-4 shadow-lg transition-colors">
          <div className="flex justify-between items-start mb-3">
            <div className="text-xs text-white/80 font-bold uppercase tracking-wide">
              Evolución Diaria
            </div>
            <div className="text-right">
                <div className="text-[10px] text-white/60 mb-0.5">Proyección Fin de Mes</div>
                <div className="text-sm font-black text-emerald-200">
                  ${Math.round(proyeccionFinDeMes || 0).toLocaleString('es-CL')}
                </div>
            </div>
          </div>
          {histLoaded && hist.length > 0 ? (
            <Line data={comparacionLineData} options={lineOptions} />
          ) : (
            <div className="text-xs text-white/50 italic flex items-center gap-2 py-4 justify-center">
              {loading ? <Loader2 className="w-3 h-3 animate-spin"/> : null} 
              Comparativa no disponible.
            </div>
          )}
        </div>

        {/* RENDIMIENTO MENSUAL */}
        <div className="rounded-2xl bg-black/20 border border-white/15 p-4 shadow-lg transition-colors">
          <div className="mb-3 text-xs text-white/80 font-bold uppercase tracking-wide">
            Evolución Mensual (Total)
          </div>
          {histLoaded && hist.length > 0 ? (
            <div className="mt-2">
              <Line data={mesesLineData} options={lineOptions} />
            </div>
          ) : (
            <div className="text-xs text-white/50 italic flex items-center gap-2 py-4 justify-center">
              {loading ? <Loader2 className="w-3 h-3 animate-spin"/> : null}
              Rendimiento no disponible.
            </div>
          )}
        </div>
        
        {/* ESPACIO EXTRA AL FINAL PARA NO CORTAR CON NAVEGACIÓN U OTROS */}
        <div className="h-10"></div>
      </section>

      {/* MODAL DE DEUDORES */}
      {showDeudores && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="bg-gradient-to-b from-indigo-900 to-violet-900 border border-white/20 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                ⚠️ Listado Oficial de Deudores
              </h2>
              <button onClick={() => setShowDeudores(false)} className="bg-white/10 hover:bg-white/20 rounded-full p-2">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
              {loadingDeudores ? (
                 <div className="text-center text-white/60 py-8 text-sm flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Buscando deudores históricos...
                 </div>
              ) : deudoresList.length === 0 ? (
                 <div className="text-center text-white/60 py-8 text-sm">No hay deudas sin pagar en el sistema 🎉.</div>
              ) : (
                 deudoresList.map(p => (
                    <div key={p.nro} className="bg-black/25 rounded-2xl p-3 border border-red-500/30 flex items-center justify-between shadow-sm">
                       <div>
                         <div className="font-extrabold text-white text-base">{p.clienteNombre}</div>
                         <div className="text-xs text-white/60 font-medium">Servicio N° {p.nro} • {p.telefono || 'Sin Teléfono'}</div>
                         <div className="text-amber-300 font-black mt-1 text-lg">${p.total.toLocaleString('es-CL')}</div>
                       </div>
                       <div className="flex items-center gap-2">
                         <button 
                           onClick={() => marcarDeudaPagada(p.nro)}
                           title="Marcar como Pagado"
                           className="bg-indigo-600/90 hover:bg-indigo-500 text-white p-3 rounded-full flex items-center shadow-lg transition-transform active:scale-95"
                         >
                            <CreditCard className="w-5 h-5" />
                         </button>
                         {p.telefono && (
                           <a href={generarWA(p)} target="_blank" rel="noopener noreferrer" className="bg-emerald-500 hover:bg-emerald-400 text-white p-3 rounded-full flex items-center shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-transform active:scale-95">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.385 0 0 5.388 0 12.038c0 2.127.553 4.198 1.604 6.02L0 24l6.115-1.604A11.972 11.972 0 0012.031 24c6.646 0 12.031-5.388 12.031-12.038S18.677 0 12.031 0zm0 21.962c-1.802 0-3.564-.486-5.111-1.405l-.367-.217-3.805.998.998-3.805-.218-.367c-.918-1.547-1.404-3.309-1.404-5.111 0-5.513 4.49-10.002 10.002-10.002 5.513 0 10.002 4.489 10.002 10.002 0 5.512-4.489 10.002-10.002 10.002zm5.503-7.514c-.302-.15-1.782-.878-2.059-.979-.277-.101-.478-.15-.68.15s-.781.979-.957 1.18c-.176.201-.353.226-.655.076-2.583-1.296-3.83-2.42-4.437-3.473-.134-.233.136-.217.432-.806.101-.202.05-.378-.025-.529-.076-.151-.68-1.642-.932-2.25-.246-.593-.497-.512-.68-.521-.176-.009-.378-.009-.579-.009-.201 0-.529.076-.806.378-.277.302-1.057 1.033-1.057 2.518 0 1.485 1.082 2.92 1.233 3.121.151.201 2.129 3.25 5.155 4.552 1.939.833 2.723.905 3.738.761 1.139-.161 2.766-1.131 3.156-2.224.39-.1093.39-2.03.275-2.224-.112-.194-.413-.295-.715-.445z"/></svg>
                           </a>
                         )}
                       </div>
                    </div>
                 ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
