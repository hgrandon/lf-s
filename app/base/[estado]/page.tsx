// app/base/[estado]/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  User, ChevronDown, ChevronRight, MapPin, Route, Car, Truck,
  CheckCircle2, Droplet, PackageCheck, CreditCard, AlertTriangle,
  ImagePlus, Loader2, RefreshCw,
} from 'lucide-react';

/* =========================
   Tipos y constantes
========================= */
type EstadoKey = 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGAR' | 'ENTREGADO';

type Item = { articulo: string; qty: number; valor: number };

type PedidoRow = {
  nro: number;
  telefono: string | null;
  total: number | null;
  estado: EstadoKey | null;
  pagado: boolean | null;
  detalle: string | null;
  foto_url: string | null;
};

type ClienteRow = {
  telefono: string;
  nombre: string | null;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
};

type PedidoUI = {
  id: number;
  total: number;
  estado: EstadoKey;
  pagado: boolean;
  detalle: string | null;
  foto_url: string | null;
  items: Item[];
  telefono?: string | null;
};

type GrupoCliente = {
  telefono: string;
  nombre: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
  distanciaKm: number | null;
  pedidos: PedidoUI[];
};

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

// Región fija (La Serena / Coquimbo y alrededores)
const ORIGIN_ADDR = 'Periodista Mario Peña Carreño 5304, La Serena, Coquimbo, Chile';
const REGION_HINT = 'La Serena, Coquimbo, Chile';
const NOMINATIM_HEADERS = { 'User-Agent': 'lf-app/1.0 (contact: lf-app@example.local)' };

/* =========================
   Utils compartidas
========================= */
const isEstado = (v: string): v is EstadoKey =>
  ['LAVAR', 'LAVANDO', 'GUARDAR', 'GUARDADO', 'ENTREGAR', 'ENTREGADO'].includes(v);

function firstFotoFromMixed(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return null;
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string') return arr[0] as string;
        return null;
      } catch { return null; }
    }
    return s;
  }
  if (Array.isArray(input) && input.length > 0 && typeof input[0] === 'string') return input[0] as string;
  return null;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function geocodeNominatim(q: string): Promise<{ lat: number; lng: number } | null> {
  try {
    // Forzamos búsqueda en Coquimbo (La Serena / Coquimbo y alrededores)
    const query = `${q}, ${REGION_HINT}`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cl&viewbox=-71.4,-29.8,-70.9,-30.1&bounded=1&q=${encodeURIComponent(query)}`;
    const r = await fetch(url, { headers: NOMINATIM_HEADERS });
    const j = (await r.json()) as any[];
    if (!Array.isArray(j) || j.length === 0) return null;
    const best = j[0];
    return { lat: parseFloat(best.lat), lng: parseFloat(best.lon) };
  } catch {
    return null;
  }
}

function gmapsSingle(origin: { lat: number; lng: number } | null, lat?: number | null, lng?: number | null, dir?: string) {
  if (typeof lat === 'number' && typeof lng === 'number' && origin) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${lat},${lng}&travelmode=driving`;
  }
  const dest = encodeURIComponent(`${(dir ?? '').trim()}, ${REGION_HINT}`);
  const originStr = origin ? `${origin.lat},${origin.lng}` : encodeURIComponent(ORIGIN_ADDR);
  return `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${dest}&travelmode=driving`;
}

function wazeSingle(lat?: number | null, lng?: number | null, dir?: string) {
  if (typeof lat === 'number' && typeof lng === 'number') {
    return `https://waze.com/ul?ll=${lat}%2C${lng}&navigate=yes&zoom=16`;
  }
  return `https://waze.com/ul?q=${encodeURIComponent(`${dir ?? ''}, ${REGION_HINT}`)}&navigate=yes&zoom=16`;
}

/* =========================
   Página unificada
========================= */
export default function EstadoPage() {
  const router = useRouter();
  const params = useParams<{ estado: string }>();
  const estadoParam = String(params?.estado ?? '').toUpperCase();

  // Normalizamos alias como /entregar -> ENTREGAR, etc.
  const estado: EstadoKey = isEstado(estadoParam as EstadoKey)
    ? (estadoParam as EstadoKey)
    : (estadoParam === 'ENTREGAR' ? 'ENTREGAR' : 'LAVAR');

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Datos genéricos para listas por pedido:
  const [pedidos, setPedidos] = useState<PedidoUI[]>([]);
  const [openPedido, setOpenPedido] = useState<number | null>(null);
  const [openDetail, setOpenDetail] = useState<Record<number, boolean>>({});
  const [imageError, setImageError] = useState<Record<number, boolean>>({});

  // Datos para ENTREGAR (agrupado por cliente + origen):
  const [grupos, setGrupos] = useState<GrupoCliente[]>([]);
  const [openTel, setOpenTel] = useState<string | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);

  // Realtime canal
  const channelRef = useRef<RealtimeChannel | null>(null);

  /* -------- Snack -------- */
  function snack(s: string) {
    setNotice(s);
    setTimeout(() => setNotice(null), 1700);
  }

  /* -------- Carga principal según estado -------- */
  useEffect(() => {
    let cancelled = false;

    async function loadForPedidosEstados(target: EstadoKey) {
      // Carga para LAVAR, LAVANDO, GUARDADO
      const { data: rows, error: e1 } = await supabase
        .from('pedido')
        .select('nro, telefono, total, estado, detalle, pagado, foto_url')
        .eq('estado', target)
        .order('nro', { ascending: target !== 'GUARDADO' }); // en guardado mostrabas descendente, puedes ajustar

      if (e1) throw e1;

      const ids = (rows ?? []).map((r) => (r as PedidoRow).nro);
      const tels = (rows ?? []).map((r) => (r as PedidoRow).telefono).filter(Boolean) as string[];

      const { data: lineas, error: e2 } = await supabase
        .from('pedido_linea')
        .select('pedido_id, articulo, cantidad, valor')
        .in('pedido_id', ids);
      if (e2) throw e2;

      const { data: cli, error: e3 } = await supabase
        .from('clientes')
        .select('telefono, nombre')
        .in('telefono', tels);
      if (e3) throw e3;

      const nombreByTel = new Map<string, string>();
      (cli ?? []).forEach((c: any) => {
        nombreByTel.set(String(c.telefono), (c.nombre ?? 'SIN NOMBRE').toUpperCase());
      });

      const itemsByPedido = new Map<number, Item[]>();
      (lineas ?? []).forEach((l: any) => {
        const pid = Number(l.pedido_id);
        if (!pid) return;
        const label = String(l.articulo ?? '').trim() || 'SIN NOMBRE';
        const qty = Number(l.cantidad ?? 0);
        const valor = Number(l.valor ?? 0);
        const arr = itemsByPedido.get(pid) ?? [];
        arr.push({ articulo: label, qty, valor });
        itemsByPedido.set(pid, arr);
      });

      const mapped: PedidoUI[] = (rows ?? []).map((r: any) => ({
        id: r.nro,
        total: Number(r.total ?? (itemsByPedido.get(r.nro) ?? []).reduce((a, it) => a + it.qty * it.valor, 0)),
        estado: (r.estado ?? target) as EstadoKey,
        pagado: !!r.pagado,
        detalle: r.detalle ?? null,
        foto_url: firstFotoFromMixed(r.foto_url),
        items: itemsByPedido.get(r.nro) ?? [],
        telefono: r.telefono,
      }));

      if (!cancelled) setPedidos(mapped);
    }

    async function loadForEntregar() {
      // Origen cacheado (La Serena / Coquimbo)
      const oCache = localStorage.getItem('lf_origin_coords');
      if (oCache) {
        try {
          const p = JSON.parse(oCache);
          if (p && typeof p.lat === 'number' && typeof p.lng === 'number') {
            setOrigin(p);
          } else {
            const g = await geocodeNominatim(ORIGIN_ADDR);
            if (g) { setOrigin(g); localStorage.setItem('lf_origin_coords', JSON.stringify(g)); }
          }
        } catch {
          const g = await geocodeNominatim(ORIGIN_ADDR);
          if (g) { setOrigin(g); localStorage.setItem('lf_origin_coords', JSON.stringify(g)); }
        }
      } else {
        const g = await geocodeNominatim(ORIGIN_ADDR);
        if (g) { setOrigin(g); localStorage.setItem('lf_origin_coords', JSON.stringify(g)); }
      }

      // Pedidos ENTREGAR
      const { data: pedidos, error: e1 } = await supabase
        .from('pedido')
        .select('nro, telefono, total, estado, detalle, pagado, foto_url')
        .eq('estado', 'ENTREGAR')
        .order('nro', { ascending: true });

      if (e1) throw e1;

      const tels = Array.from(new Set((pedidos ?? []).map((p) => String((p as PedidoRow).telefono || '')).filter(Boolean)));
      const { data: clientes, error: e2 } = await supabase
        .from('clientes')
        .select('telefono, nombre, direccion, lat, lng')
        .in('telefono', tels);
      if (e2) throw e2;

      const ids = (pedidos ?? []).map((p) => (p as PedidoRow).nro);
      const { data: lineas, error: e3 } = await supabase
        .from('pedido_linea')
        .select('pedido_id, articulo, cantidad, valor')
        .in('pedido_id', ids);
      if (e3) throw e3;

      const itemsByPedido = new Map<number, Item[]>();
      (lineas ?? []).forEach((l: any) => {
        const pid = Number(l.pedido_id);
        if (!pid) return;
        const label = String(l.articulo ?? '').trim() || 'SIN NOMBRE';
        const qty = Number(l.cantidad ?? 0);
        const valor = Number(l.valor ?? 0);
        const arr = itemsByPedido.get(pid) ?? [];
        arr.push({ articulo: label, qty, valor });
        itemsByPedido.set(pid, arr);
      });

      const byTel = new Map<string, ClienteRow>();
      (clientes ?? []).forEach((c: any) => byTel.set(String(c.telefono), c));

      // Geocodificar faltantes suavemente (bounded a Coquimbo)
      for (const tel of tels) {
        const c = byTel.get(tel);
        if (c && (!c.lat || !c.lng)) {
          const q = `${c.direccion ?? ''}, ${REGION_HINT}`;
          const geo = await geocodeNominatim(q);
          if (geo) {
            await supabase.from('clientes').update({ lat: geo.lat, lng: geo.lng }).eq('telefono', tel);
            c.lat = geo.lat; c.lng = geo.lng;
          }
          await new Promise((r) => setTimeout(r, 1100));
        }
      }

      const gruposTmp = new Map<string, GrupoCliente>();
      (pedidos ?? []).forEach((pr: any) => {
        const tel = String(pr.telefono || '');
        const cli = byTel.get(tel);
        const items = itemsByPedido.get(pr.nro) ?? [];
        if (!gruposTmp.has(tel)) {
          gruposTmp.set(tel, {
            telefono: tel,
            nombre: (cli?.nombre ?? 'SIN NOMBRE').toUpperCase(),
            direccion: (cli?.direccion ?? 'SIN DIRECCIÓN').toUpperCase(),
            lat: cli?.lat ?? null,
            lng: cli?.lng ?? null,
            distanciaKm: null,
            pedidos: [],
          });
        }
        gruposTmp.get(tel)!.pedidos.push({
          id: pr.nro,
          total: Number(pr.total ?? items.reduce((a, it) => a + it.qty * it.valor, 0)),
          estado: (pr.estado ?? 'ENTREGAR') as EstadoKey,
          pagado: !!pr.pagado,
          detalle: pr.detalle,
          foto_url: firstFotoFromMixed(pr.foto_url),
          items,
        });
      });

      const arr: GrupoCliente[] = Array.from(gruposTmp.values());
      const og = origin || null;
      if (og) {
        arr.forEach((g) => {
          if (typeof g.lat === 'number' && typeof g.lng === 'number') {
            g.distanciaKm = haversineKm(og, { lat: g.lat, lng: g.lng });
          } else { g.distanciaKm = null; }
        });
        arr.sort((a, b) => (a.distanciaKm ?? 9e9) - (b.distanciaKm ?? 9e9));
      }
      if (!cancelled) setGrupos(arr);
    }

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        if (estado === 'ENTREGAR') {
          await loadForEntregar();
        } else if (estado === 'LAVAR' || estado === 'LAVANDO' || estado === 'GUARDADO') {
          await loadForPedidosEstados(estado);
        } else {
          // ENTREGADO lo puedes listar igual si quieres; aquí lo omitimos por simplicidad
          setPedidos([]);
        }
      } catch (e: any) {
        setErr(e?.message ?? 'Error al cargar datos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Realtime
    if (!channelRef.current) {
      channelRef.current = supabase
        .channel('rt-pedido-estado')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedido' }, () => {
          // refresco suave
          router.refresh();
        })
        .subscribe();
    }

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [estado]);

  /* -------- Mutaciones comunes -------- */
  async function changeEstadoPedido(id: number, next: EstadoKey) {
    setSaving(true);
    const prevPedidos = pedidos;
    const prevGrupos = grupos;

    try {
      await supabase.from('pedido').update({ estado: next }).eq('nro', id);

      if (estado === 'ENTREGAR') {
        // si salimos de ENTREGAR, quitamos el pedido del grupo
        setGrupos((curr) =>
          curr
            .map((g) => ({ ...g, pedidos: g.pedidos.filter((p) => p.id !== id) }))
            .filter((g) => g.pedidos.length > 0),
        );
      } else {
        // en otras vistas, actualizamos el estado en memoria y, si ya no coincide con la vista, lo sacamos
        setPedidos((curr) => curr.filter((p) => p.id !== id));
      }

      snack(`Pedido #${id} → ${next}`);
    } catch (e) {
      console.error(e);
      setPedidos(prevPedidos);
      setGrupos(prevGrupos);
    } finally {
      setSaving(false);
    }
  }

  async function togglePago(id: number) {
    setSaving(true);
    try {
      const inEntregar = estado === 'ENTREGAR';
      if (inEntregar) {
        const p = grupos.flatMap((g) => g.pedidos).find((x) => x.id === id);
        const next = !p?.pagado;
        await supabase.from('pedido').update({ pagado: next }).eq('nro', id);
        setGrupos((curr) =>
          curr.map((g) => ({
            ...g,
            pedidos: g.pedidos.map((pd) => (pd.id === id ? { ...pd, pagado: next } : pd)),
          })),
        );
        snack(`Pedido #${id} marcado como ${next ? 'PAGADO' : 'PENDIENTE'}`);
      } else {
        const p = pedidos.find((x) => x.id === id);
        const next = !p?.pagado;
        await supabase.from('pedido').update({ pagado: next }).eq('nro', id);
        setPedidos((curr) => curr.map((pd) => (pd.id === id ? { ...pd, pagado: next } : pd)));
        snack(`Pedido #${id} marcado como ${next ? 'PAGADO' : 'PENDIENTE'}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  /* -------- Render helpers -------- */
  const titulo = useMemo(() => {
    switch (estado) {
      case 'LAVAR': return 'Lavar';
      case 'LAVANDO': return 'Lavando';
      case 'GUARDADO': return 'Guardado';
      case 'ENTREGAR': return 'Entregar';
      default: return estado;
    }
  }, [estado]);

  function gmapsRutaOrdenada() {
    const destinos =
      grupos
        .map((g) =>
          typeof g.lat === 'number' && typeof g.lng === 'number'
            ? `${g.lat},${g.lng}`
            : encodeURIComponent(`${g.direccion}, ${REGION_HINT}`),
        )
        .slice(0, 15);
    if (destinos.length === 0) return '#';
    const originStr = origin ? `${origin.lat},${origin.lng}` : encodeURIComponent(ORIGIN_ADDR);
    const destination = destinos[destinos.length - 1];
    const waypoints = destinos.slice(0, destinos.length - 1).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destination}&travelmode=driving${
      waypoints ? `&waypoints=${waypoints}` : ''
    }`;
  }

  /* =========================
     UI
  ========================= */
  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      <header className="relative z-10 flex items-center justify-between px-4 lg:px-8 py-3 lg:py-5">
        <h1 className="font-bold text-base lg:text-xl">{titulo}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => router.refresh()} className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-sm hover:bg-white/15">
            <RefreshCw size={16} />
            Actualizar
          </button>
          <button onClick={() => router.push('/base')} className="text-xs lg:text-sm text-white/90 hover:text-white">
            ← Volver
          </button>
        </div>
      </header>

      {err && (
        <div className="relative z-10 mx-4 lg:mx-8">
          <div className="flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-300/30 p-3 text-sm">
            <AlertTriangle size={16} />
            <span>{err}</span>
          </div>
        </div>
      )}

      <section className="relative z-10 w-full px-3 sm:px-6 lg:px-8 grid gap-4">
        {loading && (
          <div className="flex items-center gap-2 text-white/90">
            <Loader2 className="animate-spin" size={18} />
            Cargando…
          </div>
        )}

        {!loading && estado !== 'ENTREGAR' && pedidos.length === 0 && (
          <div className="text-white/85">No hay pedidos en {titulo.toUpperCase()}.</div>
        )}

        {!loading && estado === 'ENTREGAR' && grupos.length === 0 && (
          <div className="text-white/85">No hay pedidos en ENTREGAR.</div>
        )}

        {/* ===== Vista ENTREGAR (abanicos por cliente) ===== */}
        {!loading && estado === 'ENTREGAR' && grupos.map((g) => {
          const open = openTel === g.telefono;
          const totalCliente = g.pedidos.reduce((a, p) => a + p.total, 0);
          return (
            <div key={g.telefono} className={['rounded-2xl bg-white/10 border backdrop-blur-md shadow-[0_6px_20px_rgba(0,0,0,0.15)]', open ? 'border-white/40' : 'border-white/15'].join(' ')}>
              <button onClick={() => setOpenTel(open ? null : g.telefono)} className="w-full flex items-center justify-between gap-3 lg:gap-4 px-3 sm:px-4 lg:px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/15 border border-white/20">
                    <User size={18} />
                  </span>
                  <div className="text-left">
                    <div className="font-extrabold tracking-wide text-sm lg:text-base">
                      {g.nombre} — {g.telefono}
                    </div>
                    <div className="text-[10px] lg:text-xs uppercase text-white/85 flex items-center gap-2">
                      <MapPin size={12} /> {g.direccion}
                      {typeof g.distanciaKm === 'number' && <span>• {g.distanciaKm.toFixed(1)} km</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 lg:gap-4">
                  <div className="font-extrabold text-white/95 text-sm lg:text-base">{CLP.format(totalCliente)}</div>
                  {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
              </button>

              {open && (
                <div className="px-3 sm:px-4 lg:px-6 pb-4">
                  {/* Acciones por cliente */}
                  <div className="mb-3 flex flex-wrap gap-2">
                    <a href={gmapsSingle(origin, g.lat, g.lng, g.direccion)} target="_blank" className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-xs hover:bg-white/15 inline-flex items-center gap-2">
                      <Car size={14} /> Google Maps
                    </a>
                    <a href={wazeSingle(g.lat, g.lng, g.direccion)} target="_blank" className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-xs hover:bg-white/15 inline-flex items-center gap-2">
                      <Truck size={14} /> Waze
                    </a>
                    <a href={gmapsRutaOrdenada()} target="_blank" className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-xs hover:bg-white/15 inline-flex items-center gap-2">
                      <Route size={14} /> Ruta completa (orden)
                    </a>
                  </div>

                  {/* Pedidos del cliente */}
                  <div className="grid gap-3">
                    {g.pedidos.map((p) => {
                      const totalCalc = p.items?.length ? p.items.reduce((a, it) => a + it.qty * it.valor, 0) : p.total ?? 0;
                      return (
                        <div key={p.id} className="rounded-xl bg-white/8 border border-white/15 p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold">Pedido N° {p.id} • {p.pagado ? 'PAGADO' : 'PENDIENTE'}</div>
                            <div className="text-sm font-extrabold">{CLP.format(totalCalc)}</div>
                          </div>

                          {p.foto_url ? (
                            <div className="mt-3 rounded-xl overflow-hidden bg-black/20 border border-white/10">
                              <Image
                                src={p.foto_url}
                                alt={`Foto pedido ${p.id}`}
                                width={0}
                                height={0}
                                sizes="100vw"
                                style={{ width: '100%', height: 'auto', objectFit: 'contain', maxHeight: '60vh' }}
                                onError={() => setImageError((prev) => ({ ...prev, [p.id]: true }))}
                              />
                            </div>
                          ) : (
                            <div className="mt-3 rounded-xl overflow-hidden bg-black/10 border border-white/10 p-4 text-xs text-white/80 flex items-center gap-2">
                              <ImagePlus size={14} /> Sin imagen adjunta.
                            </div>
                          )}

                          <div className="mt-3 rounded-xl overflow-hidden bg-white/5 border border-white/10">
                            <table className="w-full text-xs text-white/95">
                              <thead className="bg-white/10 text-white/90">
                                <tr>
                                  <th className="text-left px-3 py-2 w-[40%]">Artículo</th>
                                  <th className="text-right px-3 py-2 w-[15%]">Can.</th>
                                  <th className="text-right px-3 py-2 w-[20%]">Valor</th>
                                  <th className="text-right px-3 py-2 w-[25%]">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/10">
                                {p.items?.length ? p.items.map((it, idx) => (
                                  <tr key={idx}>
                                    <td className="px-3 py-2">{it.articulo}</td>
                                    <td className="px-3 py-2 text-right">{it.qty}</td>
                                    <td className="px-3 py-2 text-right">{CLP.format(it.valor)}</td>
                                    <td className="px-3 py-2 text-right">{CLP.format(it.qty * it.valor)}</td>
                                  </tr>
                                )) : (
                                  <tr>
                                    <td className="px-3 py-4 text-center text-white/70" colSpan={4}>Sin artículos registrados.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                            <div className="px-3 py-2 bg-white/10 text-right font-extrabold">
                              Total: {CLP.format(totalCalc)}
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-4 gap-2">
                            <ActionBtn label="Entregar" onClick={() => changeEstadoPedido(p.id, 'ENTREGADO')} active={p.estado === 'ENTREGADO'} disabled={saving} IconComp={CheckCircle2} />
                            <ActionBtn label="Lavar" onClick={() => changeEstadoPedido(p.id, 'LAVAR')} active={p.estado === 'LAVAR'} disabled={saving} IconComp={Droplet} />
                            <ActionBtn label="Guardado" onClick={() => changeEstadoPedido(p.id, 'GUARDADO')} active={p.estado === 'GUARDADO'} disabled={saving} IconComp={PackageCheck} />
                            <ActionBtn label={p.pagado ? 'Pago' : 'Pendiente'} onClick={() => togglePago(p.id)} active={p.pagado} disabled={saving} IconComp={CreditCard} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* ===== Vista LAVAR / LAVANDO / GUARDADO (lista por pedido) ===== */}
        {!loading && estado !== 'ENTREGAR' && pedidos.map((p) => {
          const open = openPedido === p.id;
          const detOpen = !!openDetail[p.id];
          const totalCalc = p.items?.length ? p.items.reduce((a, it) => a + it.qty * it.valor, 0) : p.total ?? 0;

          return (
            <div key={p.id} className={['rounded-2xl bg-white/10 border backdrop-blur-md shadow-[0_6px_20px_rgba(0,0,0,0.15)]', open ? 'border-white/40' : 'border-white/15'].join(' ')}>
              <button onClick={() => setOpenPedido(open ? null : p.id)} className="w-full flex items-center justify-between gap-3 lg:gap-4 px-3 sm:px-4 lg:px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/15 border border-white/20">
                    <User size={18} />
                  </span>
                  <div className="text-left">
                    <div className="font-extrabold tracking-wide text-sm lg:text-base">N° {p.id}</div>
                    <div className="text-[10px] lg:text-xs uppercase text-white/85">
                      {p.pagado ? 'PAGADO' : 'PENDIENTE'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 lg:gap-4">
                  <div className="font-extrabold text-white/95 text-sm lg:text-base">{CLP.format(totalCalc)}</div>
                  {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
              </button>

              {open && (
                <div className="px-3 sm:px-4 lg:px-6 pb-4">
                  {/* detalle */}
                  <div className="rounded-xl bg-white/8 border border-white/15 p-2 lg:p-3">
                    <button onClick={() => setOpenDetail((prev) => ({ ...prev, [p.id]: !prev[p.id] }))} className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2"><TableIcon /> <span className="font-semibold">Detalle Pedido</span></div>
                      {detOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    {detOpen && (
                      <div className="mt-3 rounded-xl overflow-hidden bg-white/5 border border-white/10">
                        <table className="w-full text-xs text-white/95">
                          <thead className="bg-white/10 text-white/90">
                            <tr>
                              <th className="text-left px-3 py-2 w-[40%]">Artículo</th>
                              <th className="text-right px-3 py-2 w-[15%]">Can.</th>
                              <th className="text-right px-3 py-2 w-[20%]">Valor</th>
                              <th className="text-right px-3 py-2 w-[25%]">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10">
                            {p.items?.length ? p.items.map((it, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2">{it.articulo}</td>
                                <td className="px-3 py-2 text-right">{it.qty}</td>
                                <td className="px-3 py-2 text-right">{CLP.format(it.valor)}</td>
                                <td className="px-3 py-2 text-right">{CLP.format(it.qty * it.valor)}</td>
                              </tr>
                            )) : (
                              <tr>
                                <td className="px-3 py-4 text-center text-white/70" colSpan={4}>Sin artículos registrados.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                        <div className="px-3 py-2 bg-white/10 text-right font-extrabold">
                          Total: {CLP.format(totalCalc)}
                        </div>
                      </div>
                    )}

                    {/* foto principal si existe */}
                    {p.foto_url ? (
                      <div className="mt-3 rounded-xl overflow-hidden bg-black/20 border border-white/10">
                        <Image
                          src={p.foto_url}
                          alt={`Foto pedido ${p.id}`}
                          width={0}
                          height={0}
                          sizes="100vw"
                          style={{ width: '100%', height: 'auto', objectFit: 'contain', maxHeight: '60vh' }}
                          onError={() => setImageError((prev) => ({ ...prev, [p.id]: true }))}
                        />
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl overflow-hidden bg-black/10 border border-white/10 p-4 text-xs text-white/80 flex items-center gap-2">
                        <ImagePlus size={14} /> Sin imagen adjunta.
                      </div>
                    )}
                  </div>

                  {/* acciones */}
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {estado !== 'LAVAR' && (
                      <ActionBtn label="Lavar" onClick={() => changeEstadoPedido(p.id, 'LAVAR')} active={p.estado === 'LAVAR'} disabled={saving} IconComp={Droplet} />
                    )}
                    {estado !== 'LAVANDO' && (
                      <ActionBtn label="Lavando" onClick={() => changeEstadoPedido(p.id, 'LAVANDO')} active={p.estado === 'LAVANDO'} disabled={saving} IconComp={Droplet} />
                    )}
                    {estado !== 'GUARDADO' && (
                      <ActionBtn label="Guardado" onClick={() => changeEstadoPedido(p.id, 'GUARDADO')} active={p.estado === 'GUARDADO'} disabled={saving} IconComp={PackageCheck} />
                    )}
                    <ActionBtn label={p.pagado ? 'Pago' : 'Pendiente'} onClick={() => togglePago(p.id)} active={p.pagado} disabled={saving} IconComp={CreditCard} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Barra inferior (sólo ENTREGAR muestra la ruta completa) */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 px-4 sm:px-6 lg:px-8 pt-2 pb-4 backdrop-blur-md">
        <div className="mx-auto w-full rounded-2xl bg-white/10 border border-white/15 p-3 flex items-center justify-between gap-3">
          <div className="text-xs">
            {saving ? <span className="inline-flex items-center gap-1"><Loader2 size={14} className="animate-spin" /> Guardando…</span> : (estado === 'ENTREGAR' ? 'Ruta en orden desde el origen' : titulo)}
          </div>
          {estado === 'ENTREGAR' ? (
            <a href={gmapsRutaOrdenada()} target="_blank" className="rounded-xl bg-white/20 border border-white/30 px-3 py-2 text-sm hover:bg-white/25 inline-flex items-center gap-2">
              <Route size={16} /> Abrir ruta en Google Maps
            </a>
          ) : (
            <button onClick={() => router.refresh()} className="rounded-xl bg-white/20 border border-white/30 px-3 py-2 text-sm hover:bg-white/25 inline-flex items-center gap-2">
              <RefreshCw size={16} /> Actualizar
            </button>
          )}
        </div>
      </nav>

      {notice && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg bg-black/70 text-white text-sm shadow">
          {notice}
        </div>
      )}
    </main>
  );
}

/* =========================
   Componentes pequeños
========================= */
function ActionBtn({
  label, onClick, disabled, active, IconComp,
}: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; IconComp: any }) {
  return (
    <button
      onClick={onClick}
      disabled={!!disabled}
      className={[
        'rounded-xl py-2 text-xs font-medium border transition inline-flex items-center justify-center gap-2',
        active ? 'bg-white/20 border-white/30 text-white' : 'bg-white/5 border-white/10 text-white/90 hover:bg-white/10',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <IconComp size={14} />
      {label}
    </button>
  );
}

function TableIcon() {
  // mini ícono de tabla para reusar sin importar 'Table' de lucide si no estaba
  return <svg width="16" height="16" viewBox="0 0 24 24" className="fill-white/90"><path d="M3 3h18v18H3V3zm16 2H5v3h14V5zM5 10v9h4v-9H5zm6 0v9h8v-9h-8z"/></svg>;
}
