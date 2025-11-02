// app/pedido/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  ArrowLeftCircle,
  Save,
  UserRound,
  Phone,
  Plus,
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

async function selectFirstTable<T = any>(
  tables: string[],
  select: string,
  opts?: { eq?: [string, any]; orderBy?: string }
): Promise<{ data: T[] | null; table?: string; error?: any }> {
  for (const t of tables) {
    try {
      let q = supabase.from(t).select(select);
      if (opts?.eq) q = (q as any).eq(opts.eq[0], opts.eq[1]);
      if (opts?.orderBy) q = (q as any).order(opts.orderBy as any);
      const { data, error } = await q;
      if (!error) return { data: (data as T[]) ?? null, table: t };
    } catch {
      /* try next */
    }
  }
  return { data: null, error: `No se encontró ninguna de las tablas: ${tables.join(', ')}` };
}

async function insertFirstTable(tables: string[], row: any): Promise<{ table?: string; error?: any }> {
  for (const t of tables) {
    try {
      const { error } = await supabase.from(t).insert(row);
      if (!error) return { table: t };
    } catch {
      /* try next */
    }
  }
  return { error: `No se pudo insertar en: ${tables.join(', ')}` };
}

export default function PedidoPage() {
  const router = useRouter();

  const [tel, setTel] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [needCreate, setNeedCreate] = useState(false);
  const [modal, setModal] = useState<{ open: boolean }>({ open: false });

  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [selArt, setSelArt] = useState<number | ''>('');
  const [qty, setQty] = useState(1);
  const [items, setItems] = useState<Item[]>([]);
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  const [nroInfo, setNroInfo] = useState<NextNumber | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingCliente, setLoadingCliente] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const a = await selectFirstTable<Articulo>(['articulo', 'articulos'], 'id,nombre,valor', { orderBy: 'nombre' });
      if (!a.error && a.data) setArticulos(a.data);
      const next = await getNextNumber();
      setNroInfo(next);
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
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tel]);

  async function lookupCliente(tlf: string) {
    try {
      setLoadingCliente(true);
      setErr(null);
      const sel = await selectFirstTable<Cliente>(['cliente', 'clientes'], '*', { eq: ['telefono', tlf] });
      if (sel.error) throw new Error(String(sel.error));
      const row = (sel.data ?? [])[0];

      if (row) {
        setCliente({
          telefono: (row as any).telefono,
          nombre: ((row as any).nombre || '').toString().toUpperCase(),
          direccion: ((row as any).direccion || '').toString().toUpperCase(),
        });
        setNeedCreate(false);
        setModal({ open: false });
      } else {
        setCliente(null);
        setNeedCreate(true);
        setModal({ open: true });
      }
    } catch (e: any) {
      const msg =
        String(e).includes('schema cache')
          ? 'Supabase no reconoce la tabla (caché). En Settings → API → “Recompute public schema cache / Restart PostgREST”.'
          : e?.message || 'Error buscando cliente';
      setErr(msg);
    } finally {
      setLoadingCliente(false);
    }
  }

  async function crearClienteRapido(c: Cliente) {
    try {
      setErr(null);
      const ins = await insertFirstTable(['cliente', 'clientes'], {
        telefono: c.telefono,
        nombre: c.nombre,
        direccion: c.direccion,
      });
      if (ins.error) throw new Error(String(ins.error));
      setCliente(c);
      setNeedCreate(false);
      setModal({ open: false });
    } catch (e: any) {
      setErr(e?.message ?? 'No se pudo crear el cliente');
    }
  }

  const addItem = () => {
    const a = articulos.find((x) => x.id === selArt);
    if (!a) return;
    const q = Math.max(1, Number(qty) || 1);

    setItems((prev) => {
      const idx = prev.findIndex((it) => it.articulo === a.nombre && it.valor === (a.valor || 0));
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = { ...clone[idx], qty: clone[idx].qty + q, subtotal: (clone[idx].qty + q) * clone[idx].valor };
        return clone;
      }
      return [...prev, { articulo: a.nombre, qty: q, valor: a.valor || 0, subtotal: (a.valor || 0) * q, estado: 'LAVAR' }];
    });

    setSelArt('');
    setQty(1);
  };

  const removeItem = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx));
  const total = useMemo(() => items.reduce((acc, it) => acc + it.subtotal, 0), [items]);

  async function getNextNumber(): Promise<NextNumber> {
    try {
      const { data, error } = await supabase.rpc('next_pedido_number');
      if (!error && data && typeof (data as any).nro === 'number') return data as NextNumber;
    } catch {/* ignore */}
    const sel = await selectFirstTable<any>(['pedido', 'pedidos'], 'id');
    const maxId = Array.isArray(sel.data) ? sel.data.reduce((m, r) => (typeof r.id === 'number' && r.id > m ? r.id : m), 0) : 0;
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
    if (!cliente) {
      setErr('Ingrese un teléfono válido y/o cree el cliente.');
      return;
    }
    if (items.length === 0) {
      setErr('Agregue al menos un artículo.');
      return;
    }

    setSaving(true);
    setErr(null);

    try {
      const next = await getNextNumber();
      setNroInfo(next);

      const foto_url = await uploadFotoIfAny(next.nro);

      const ins = await insertFirstTable(['pedido', 'pedidos'], {
        id: next.nro,
        cliente: cliente.nombre,
        telefono: cliente.telefono,
        direccion: cliente.direccion,
        total,
        estado: 'LAVAR',
        items,
        fecha: next.fecha,
        entrega: next.entrega,
        foto_url,
        pagado: false,
      });
      if (ins.error) throw new Error(String(ins.error));

      router.push('/base');
    } catch (e: any) {
      const msg =
        String(e).includes('schema cache')
          ? 'Supabase no reconoce la tabla (caché). En Settings → API → “Recompute public schema cache / Restart PostgREST”.'
          : e?.message ?? 'No se pudo guardar el pedido';
      setErr(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* ENCABEZADO ESTILO CLÁSICO */}
      <header className="relative z-10 mx-auto max-w-5xl px-4 pt-6">
        <div className="flex items-start justify-between">
          <div className="leading-tight">
            <div className="text-[34px] sm:text-[42px] font-black tracking-tight">
              {nroInfo ? `N° ${nroInfo.nro}` : 'N° —'}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-white/80">FECHA INGRESO</div>
            <div className="text-base font-semibold -mt-0.5">{nroInfo?.fecha ?? '—'}</div>
            <div className="mt-2 text-xs text-white/80">FECHA ENTREGA</div>
            <div className="text-base font-semibold -mt-0.5">{nroInfo?.entrega ?? '—'}</div>
            {cliente && (
              <div className="mt-2 text-sm font-bold">
                {cliente.nombre}
              </div>
            )}
          </div>
        </div>

        {/* Línea de controles arriba a la derecha */}
        <div className="absolute right-4 top-6">
          <button
            onClick={() => router.push('/menu')}
            className="inline-flex items-center justify-center rounded-full bg-white/10 border border-white/20 w-10 h-10 hover:bg-white/15"
            aria-label="Volver"
          >
            <ArrowLeftCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* CAMPO TELÉFONO TIPO “PÍLDORA” BAJO EL NÚMERO */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 mt-3">
        <div className="flex items-center gap-2 w-full sm:w-[280px]">
          <div className="relative w-full">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-white/80 w-4 h-4" />
            <input
              value={tel}
              onChange={(e) => setTel(telClean(e.target.value))}
              inputMode="numeric"
              placeholder="9 dígitos…"
              className="w-full rounded-xl border border-white/25 bg-white/10 text-white placeholder-white/70 pl-9 pr-3 py-2 outline-none focus:border-white/60"
            />
          </div>
          {loadingCliente && <Loader2 className="animate-spin text-white/90" />}
        </div>
      </section>

      {/* BLOQUE BLANCO: ARTÍCULOS / TABLA / FOTO / GUARDAR */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 mt-4">
        {cliente && (
          <div className="mb-3 rounded-xl border border-white/20 bg-white/10 text-white/95 px-3 py-2 flex items-center justify-between">
            <div>
              <div className="text-xs text-white/70">Cliente</div>
              <div className="font-extrabold">{cliente.nombre}</div>
              <div className="text-white/80">{cliente.telefono}</div>
              <div className="text-white/70">{cliente.direccion}</div>
            </div>
            <div className="shrink-0 w-10 h-10 rounded-full bg-white/15 border border-white/25 flex items-center justify-center">
              <UserRound />
            </div>
          </div>
        )}

        {modal.open && needCreate && (
          <ClienteModal
            telefono={telClean(tel)}
            onCancel={() => {
              setModal({ open: false });
              setNeedCreate(false);
            }}
            onSave={(c) => crearClienteRapido(c)}
          />
        )}

        <div className="rounded-2xl bg-white text-slate-900 p-4 sm:p-5 shadow-[0_10px_30px_rgba(0,0,0,.20)]">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Seleccionar artículo</label>
              <select
                className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500"
                value={selArt === '' ? '' : selArt}
                onChange={(e) => setSelArt(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Seleccionar artículo…</option>
                {articulos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} — {CLP.format(a.valor || 0)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Cantidad</label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-28 rounded-xl border-2 border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addItem();
                }}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={addItem}
                disabled={selArt === '' || qty < 1}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 text-white px-4 py-2.5 hover:bg-violet-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Agregar
              </button>
            </div>
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

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center">
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

            <div className="flex justify-end">
              <button
                onClick={guardarPedido}
                disabled={saving || !cliente || items.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 text-white px-5 py-3 text-base font-semibold hover:bg-violet-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
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
}: {
  telefono: string;
  onCancel: () => void;
  onSave: (c: Cliente) => void;
}) {
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
            onClick={() =>
              onSave({
                telefono,
                nombre: nombre.trim().toUpperCase(),
                direccion: direccion.trim().toUpperCase(),
              })
            }
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
