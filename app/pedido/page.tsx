// app/pedido/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  ArrowLeftCircle,
  Save,
  Phone,
  Trash2,
  Camera,
  ImagePlus,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

type Cliente = { telefono: string; nombre: string; direccion: string };
type Articulo = { id: number; nombre: string; valor: number };
type Item = { articulo: string; qty: number; valor: number; subtotal: number; estado: 'LAVAR' };
type NextNumber = { nro: number; fecha: string; entrega: string };

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const telClean = (v: string) => v.replace(/\D+/g, '').slice(0, 9);

function addBusinessDays(fromISO: string, days = 3) {
  const d = new Date(fromISO + 'T00:00:00');
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

export default function PedidoPage() {
  const router = useRouter();

  const [tel, setTel] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);

  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [articulosMsg, setArticulosMsg] = useState<string | null>(null);
  const [selArt, setSelArt] = useState<number | ''>('');
  const [items, setItems] = useState<Item[]>([]);
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  const [nroInfo, setNroInfo] = useState<NextNumber | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingCliente, setLoadingCliente] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [needCreate, setNeedCreate] = useState(false);
  const [modal, setModal] = useState<{ open: boolean }>({ open: false });

  useEffect(() => {
    (async () => {
      // cargar artículos
      try {
        setArticulosMsg(null);
        const { data, error } = await supabase
          .from('articulo')
          .select('id,nombre,valor')
          .order('nombre', { ascending: true });

        if (error) throw error;
        const list = (data || []) as Articulo[];
        setArticulos(list);
        if (!list.length) setArticulosMsg('No hay artículos. Revisa tabla public.articulo.');
      } catch (e: any) {
        setArticulosMsg(
          e?.message?.includes('RLS')
            ? 'No se pudieron leer artículos (RLS). Habilita lectura pública o usa sesión con permisos.'
            : 'No se pudieron cargar artículos.'
        );
      }

      // nro + fechas
      const iso = new Date().toISOString().slice(0, 10);
      const entrega = addBusinessDays(iso, 3);
      const next = await getNextNumber();
      setNroInfo({ nro: next.nro, fecha: iso, entrega });
    })();
  }, []);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    const t = telClean(tel);
    setCliente(null);
    setNeedCreate(false);
    setModal({ open: false });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (t.length === 9) {
      debounceRef.current = setTimeout(() => {
        void lookupCliente(t);
      }, 250);
    }
  }, [tel]);

  async function lookupCliente(tlf: string) {
    try {
      setLoadingCliente(true);
      setErr(null);
      const { data, error } = await supabase.from('cliente').select('*').eq('telefono', tlf);
      if (error) throw error;
      const row = data?.[0];
      if (row) {
        setCliente({
          telefono: row.telefono,
          nombre: (row.nombre || '').toString().toUpperCase(),
          direccion: (row.direccion || '').toString().toUpperCase(),
        });
      } else {
        setCliente(null);
        setNeedCreate(true);
        setModal({ open: true });
      }
    } catch (e: any) {
      const msg = String(e).includes('schema cache')
        ? 'Supabase no reconoce la tabla. En Settings → API pulsa “Recompute public schema cache / Restart PostgREST”.'
        : e?.message || 'Error buscando cliente';
      setErr(msg);
    } finally {
      setLoadingCliente(false);
    }
  }

  async function crearClienteRapido(c: Cliente) {
    try {
      setErr(null);
      const { error } = await supabase.from('cliente').insert({
        telefono: c.telefono,
        nombre: c.nombre,
        direccion: c.direccion,
      });
      if (error) throw error;
      setCliente(c);
      setNeedCreate(false);
      setModal({ open: false });
    } catch (e: any) {
      setErr(e?.message ?? 'No se pudo crear el cliente');
    }
  }

  const addItemAuto = (articuloId: number) => {
    const a = articulos.find((x) => x.id === articuloId);
    if (!a) return;
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.articulo === a.nombre && it.valor === (a.valor || 0));
      if (idx >= 0) {
        const clone = [...prev];
        const nextQty = clone[idx].qty + 1;
        clone[idx] = { ...clone[idx], qty: nextQty, subtotal: nextQty * clone[idx].valor };
        return clone;
      }
      return [...prev, { articulo: a.nombre, qty: 1, valor: a.valor || 0, subtotal: (a.valor || 0) * 1, estado: 'LAVAR' }];
    });
    setSelArt('');
  };

  const removeItem = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx));
  const total = useMemo(() => items.reduce((acc, it) => acc + it.subtotal, 0), [items]);

  async function getNextNumber(): Promise<NextNumber> {
    try {
      const { data, error } = await supabase.rpc('next_pedido_number');
      if (!error && data && typeof (data as any).nro === 'number') return data as NextNumber;
    } catch {}
    const { data } = await supabase.from('pedido').select('id');
    const maxId = Array.isArray(data) ? data.reduce((m, r) => (typeof r.id === 'number' && r.id > m ? r.id : m), 0) : 0;
    const iso = new Date().toISOString().slice(0, 10);
    return { nro: maxId + 1, fecha: iso, entrega: iso };
  }

  async function uploadFotoIfAny(nro: number): Promise<string | null> {
    if (!fotoFile) return null;
    const filename = `pedido_${nro}_${Date.now()}_${fotoFile.name}`.replace(/\s+/g, '_');
    const { data, error } = await supabase.storage.from('fotos').upload(filename, fotoFile, { upsert: true });
    if (error || !data) return null;
    const { data: pub } = supabase.storage.from('fotos').getPublicUrl(data.path);
    return pub?.publicUrl || null;
  }

  async function guardarPedido() {
    if (!cliente) { setErr('Ingrese un teléfono válido y/o cree el cliente.'); return; }
    if (items.length === 0) { setErr('Agregue al menos un artículo.'); return; }

    setSaving(true);
    setErr(null);
    try {
      const nowISO = new Date().toISOString().slice(0, 10);
      const entrega = addBusinessDays(nowISO, 3);
      const next = await getNextNumber();
      const foto_url = await uploadFotoIfAny(next.nro);

      const { error } = await supabase.from('pedido').insert({
        id: next.nro,
        cliente: cliente.nombre,
        telefono: cliente.telefono,
        direccion: cliente.direccion,
        total,
        estado: 'LAVAR',
        items,
        fecha: nowISO,
        entrega,
        foto_url,
        pagado: false,
      });
      if (error) throw error;
      router.push('/base');
    } catch (e: any) {
      const msg = String(e).includes('schema cache')
        ? 'Supabase no reconoce la tabla. En Settings → API pulsa “Recompute public schema cache / Restart PostgREST”.'
        : e?.message ?? 'No se pudo guardar el pedido';
      setErr(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* Fechas SIEMPRE arriba-derecha, tamaño moderado */}
      <div className="absolute right-4 top-4 z-20 text-right leading-tight">
        <div className="text-xl sm:text-2xl font-black">{nroInfo?.fecha ?? '—'}</div>
        <div className="text-xl sm:text-2xl font-black">{nroInfo?.entrega ?? '—'}</div>
      </div>

      {/* Header principal */}
      <header className="relative z-10 mx-auto max-w-6xl px-6 pt-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-4xl sm:text-5xl font-black tracking-tight">{nroInfo ? `N°${nroInfo.nro}` : 'N°—'}</div>
          </div>
          <button
            onClick={() => router.push('/menu')}
            className="inline-flex items-center justify-center rounded-full bg-white/10 border border-white/20 w-10 h-10 hover:bg-white/15"
            aria-label="Volver"
          >
            <ArrowLeftCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Teléfono + Nombre/Dirección más pequeños */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-white/90 w-4 h-4" />
            <input
              value={tel}
              onChange={(e) => setTel(telClean(e.target.value))}
              inputMode="numeric"
              placeholder="9 dígitos…"
              className="w-[280px] rounded-xl border border-white/25 bg-white/10 text-white placeholder-white/70 pl-9 pr-3 py-2 outline-none focus:border-white/60"
            />
            {loadingCliente && <Loader2 className="absolute -right-6 top-1/2 -translate-y-1/2 animate-spin text-white/90" />}
          </div>

          {cliente && (
            <div className="text-xl sm:text-2xl font-extrabold tracking-tight">
              {cliente.nombre}
              <span className="ml-3 text-lg sm:text-xl font-semibold text-white/90">
                {cliente.direccion}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Modal crear cliente */}
      {modal.open && needCreate && (
        <ClienteModal
          telefono={telClean(tel)}
          onCancel={() => { setModal({ open: false }); setNeedCreate(false); }}
          onSave={(c) => crearClienteRapido(c)}
        />
      )}

      {/* Tarjeta blanca */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 mt-6">
        <div className="rounded-2xl bg-white text-slate-900 p-4 sm:p-5 shadow-[0_10px_30px_rgba(0,0,0,.20)]">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Seleccionar artículo</label>
            <select
              className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500"
              value={selArt === '' ? '' : selArt}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : '';
                setSelArt(id);
                if (id !== '') addItemAuto(id as number);
              }}
            >
              <option value="">Seleccionar artículo…</option>
              {articulos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} — {CLP.format(a.valor || 0)}
                </option>
              ))}
            </select>
            {articulosMsg && (
              <div className="mt-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {articulosMsg}
              </div>
            )}
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-violet-50 text-violet-900">
                  <th className="text-left px-3 py-2 rounded-l-lg">Artículo</th>
                  <th className="text-right px-3 py-2">Cantidad</th>
                  <th className="text-right px-3 py-2">Valor</th>
                  <th className="text-right px-3 py-2">Subtotal</th>
                  <th className="text-center px-3 py-2 rounded-r-lg">Acción</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-500 py-6">Sin artículos todavía.</td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr key={idx} className="border-b last:border-b-0">
                      <td className="px-3 py-2">{it.articulo}</td>
                      <td className="px-3 py-2 text-right">{it.qty}</td>
                      <td className="px-3 py-2 text-right">{CLP.format(it.valor)}</td>
                      <td className="px-3 py-2 text-right">{CLP.format(it.subtotal)}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => removeItem(idx)}
                          className="inline-flex items-center gap-1 rounded-lg bg-white text-rose-600 border border-rose-200 px-2.5 py-1.5 hover:bg-rose-50"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div>
              <div className="text-2xl font-extrabold tracking-tight">Total {CLP.format(total)}</div>
              <div className="flex gap-2 mt-3">
                <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 bg-white cursor-pointer hover:bg-slate-50">
                  <Camera className="w-4 h-4 text-violet-700" />
                  Tomar foto / Elegir
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setFotoFile(e.target.files?.[0] || null)} />
                </label>
                {fotoFile && (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2.5 text-violet-800">
                    <ImagePlus className="w-4 h-4" />
                    {fotoFile.name}
                  </div>
                )}
              </div>
            </div>

            <div className="flex md:justify-end">
              <button
                onClick={guardarPedido}
                disabled={saving || !cliente || items.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 text-white px-5 py-3 text-base font-semibold hover:bg-violet-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Guardar Pedido
              </button>
            </div>
          </div>

          {err && (
            <div className="mt-4 flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-sm">
              <AlertTriangle className="w-4 h-4" />
              {err}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ClienteModal({
  telefono,
  onCancel,
  onSave,
}: { telefono: string; onCancel: () => void; onSave: (c: Cliente) => void; }) {
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');

  const canSave = telefono.length === 9 && nombre.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 sm:p-5 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-900">Registrar Cliente</h3>
        <p className="text-sm text-slate-600 mt-1">No encontramos el teléfono. Ingresa los datos para guardarlo.</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Teléfono</label>
            <input value={telefono} disabled className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 bg-slate-50 text-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value.toUpperCase())}
              placeholder="NOMBRE COMPLETO"
              className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500 uppercase"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Dirección</label>
            <input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value.toUpperCase())}
              placeholder="DIRECCIÓN"
              className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500 uppercase"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl border border-slate-300 px-4 py-2.5 text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={() => onSave({
              telefono,
              nombre: nombre.trim().toUpperCase(),
              direccion: direccion.trim().toUpperCase(),
            })}
            disabled={!canSave}
            className="rounded-xl bg-violet-600 text-white px-4 py-2.5 font-semibold hover:bg-violet-700 disabled:opacity-50"
          >
            Guardar Cliente
          </button>
        </div>
      </div>
    </div>
  );
}
