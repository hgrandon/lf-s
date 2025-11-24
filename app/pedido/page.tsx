// app/pedido/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Phone,
  Loader2,
  ImagePlus,
  Camera,
  X,
  Save,
  Plus,
  Trash2,
} from 'lucide-react';

/* =========================
   Tipos básicos
========================= */
type Cliente = { telefono: string; nombre: string; direccion: string };
type Articulo = { id: number; nombre: string; precio: number; activo: boolean };
type Item = { articulo: string; qty: number; valor: number; subtotal: number };
type NextInfo = { nro: number; fechaIngresoISO: string; fechaEntregaISO: string };

/* =========================
   Utilidades
========================= */

// suma N días hábiles (sin sábados ni domingos)
function addBusinessDays(start: Date, businessDays: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < businessDays) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay(); // 0=dom, 6=sab
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

/* =========================
   Modales reutilizables
========================= */

/** Modal para nuevo cliente */
function NuevoClienteModal({
  open,
  telefono,
  onClose,
  onSaved,
}: {
  open: boolean;
  telefono: string;
  onClose: () => void;
  onSaved: (c: Cliente) => void;
}) {
  const [form, setForm] = useState<Cliente>({ telefono: '', nombre: '', direccion: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refFirst = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ telefono, nombre: '', direccion: '' });
      setError(null);
      const t = setTimeout(() => refFirst.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open, telefono]);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      const tel = (form.telefono || '').replace(/\D/g, '');
      if (tel.length < 8) throw new Error('El teléfono debe tener al menos 8 dígitos.');
      if (!form.nombre.trim()) throw new Error('El nombre es obligatorio.');

      const payload = {
        telefono: tel,
        nombre: form.nombre.trim().toUpperCase(),
        direccion: (form.direccion || '').trim().toUpperCase(),
      };

      const { data, error } = await supabase
        .from('clientes')
        .upsert(payload, { onConflict: 'telefono' })
        .select('telefono,nombre,direccion')
        .maybeSingle();
      if (error) throw error;

      const saved: Cliente = {
        telefono: data?.telefono ?? payload.telefono,
        nombre: data?.nombre ?? payload.nombre,
        direccion: data?.direccion ?? payload.direccion,
      };
      onSaved(saved);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo guardar el cliente');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <div className="w-[520px] max-w-full rounded-2xl bg-white text-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="font-bold">Nuevo cliente</div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 grid gap-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Teléfono</label>
            <input
              ref={refFirst}
              value={form.telefono}
              onChange={(e) =>
                setForm((p) => ({ ...p, telefono: e.target.value.replace(/\D/g, '') }))
              }
              inputMode="tel"
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300"
              placeholder="9 dígitos…"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Nombre</label>
            <input
              value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300"
              placeholder="NOMBRE Y APELLIDO"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Dirección</label>
            <input
              value={form.direccion}
              onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))}
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300"
              placeholder="CALLE Y NÚMERO"
            />
          </div>
          {error && (
            <div className="rounded-lg bg-rose-100 text-rose-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal para editar cantidad y valor del artículo seleccionado */
/** Modal para editar cantidad y valor del artículo seleccionado */
function DetalleArticuloModal({
  open,
  articulo,
  onClose,
  onConfirm,
}: {
  open: boolean;
  articulo: Articulo | null;
  onClose: () => void;
  onConfirm: (d: { articulo: string; qty: number; valor: number }) => void;
}) {
  const [qty, setQty] = useState(1);
  const [valor, setValor] = useState<number>(0);

  useEffect(() => {
    if (open && articulo) {
      setQty(1);
      setValor(articulo.precio ?? 0);
    }
  }, [open, articulo]);

  if (!open || !articulo) return null;

  function handleAgregar() {
    // 👇 esto elimina el error de TypeScript
    if (!articulo) return;

    const q = Math.max(1, Number(qty || 0));
    const v = Math.max(0, Number(valor || 0));
    onConfirm({ articulo: articulo.nombre, qty: q, valor: v });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <div className="w-[420px] max-w-full rounded-2xl bg-white text-slate-900 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 text-center font-extrabold text-violet-700 border-b">
          {articulo.nombre}
        </div>

        <div className="px-5 py-4 grid gap-3">
          <input
            value={String(valor)}
            onChange={(e) => setValor(Number(e.target.value || 0))}
            inputMode="numeric"
            className="w-full rounded-xl border px-3 py-2 text-right outline-none focus:ring-2 focus:ring-violet-300"
            placeholder="Valor"
          />
          <input
            value={String(qty)}
            onChange={(e) => setQty(Number(e.target.value || 0))}
            inputMode="numeric"
            className="w-full rounded-xl border px-3 py-2 text-right outline-none focus:ring-2 focus:ring-violet-300"
            placeholder="Cantidad"
          />

          <button
            onClick={handleAgregar}
            className="mt-2 w-full rounded-xl bg-violet-700 py-2 text-white font-semibold hover:bg-violet-800"
          >
            Agregar Detalle
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-violet-100 py-2 text-violet-800 font-semibold hover:bg-violet-200"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}


/** Modal para nuevo artículo */
function NuevoArticuloModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (a: Articulo) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNombre('');
      setPrecio(0);
      setError(null);
    }
  }, [open]);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      const payload = {
        nombre: nombre.trim().toUpperCase(),
        precio: Number(precio || 0),
        activo: true,
      };
      if (!payload.nombre) throw new Error('Nombre obligatorio.');
      const { data, error } = await supabase
        .from('articulo')
        .insert(payload)
        .select('id,nombre,precio,activo')
        .maybeSingle();
      if (error) throw error;
      onSaved(data as Articulo);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo guardar el artículo');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <div className="w-[520px] max-w-full rounded-2xl bg-white text-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="font-bold">Nuevo artículo</div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 grid gap-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300"
              placeholder="Ej: COBERTOR KING"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Precio (CLP)</label>
            <input
              value={String(precio)}
              onChange={(e) => setPrecio(Number(e.target.value || 0))}
              inputMode="numeric"
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 text-right"
              placeholder="0"
            />
          </div>
          {error && (
            <div className="rounded-lg bg-rose-100 text-rose-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal para elegir/sacar foto y subir a Supabase */
function FotoModal({
  open,
  onClose,
  onPicked,
}: {
  open: boolean;
  onClose: () => void;
  onPicked: (file: File | null) => void;
}) {
  const refCam = useRef<HTMLInputElement | null>(null);
  const refFile = useRef<HTMLInputElement | null>(null);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
      <div className="w-[420px] max-w-full overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl">
        <div className="relative bg-gradient-to-r from-violet-700 to-violet-600 px-6 py-4 text-center text-white font-extrabold">
          FOTO
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-white/20 p-1 hover:bg-white/30"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 grid gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-3 justify-center"
            onClick={() => refCam.current?.click()}
          >
            <Camera size={18} /> Usar cámara
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 px-4 py-3 justify-center"
            onClick={() => refFile.current?.click()}
          >
            <ImagePlus size={18} /> Elegir desde galería
          </button>

          <input
            ref={refCam}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPicked(e.target.files?.[0] ?? null)}
          />
          <input
            ref={refFile}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPicked(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
    </div>
  );
}

/* =========================
   Página principal
========================= */
export default function PedidoPage() {
  // encabezado
  const [nextInfo, setNextInfo] = useState<NextInfo | null>(null);

  // cliente
  const [telefono, setTelefono] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [checkingCli, setCheckingCli] = useState(false);
  const [openCliModal, setOpenCliModal] = useState(false);

  // artículos
  const [catalogo, setCatalogo] = useState<Articulo[]>([]);
  const [selArt, setSelArt] = useState('');
  const [busquedaArt, setBusquedaArt] = useState('');
  const [openArtModal, setOpenArtModal] = useState(false);

  // modal de detalle
  const [openDetalle, setOpenDetalle] = useState(false);
  const [articuloDetalle, setArticuloDetalle] = useState<Articulo | null>(null);

  // líneas
  const [items, setItems] = useState<Item[]>([]);

  // foto
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [openFoto, setOpenFoto] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const total = useMemo(
    () => items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.valor) || 0), 0),
    [items]
  );

  /* === Cargar correlativo y fechas === */
  useEffect(() => {
    (async () => {
      const { data: row, error } = await supabase
        .from('pedido')
        .select('nro')
        .order('nro', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) console.error(error);
      const last = Number(row?.nro || 0);
      const nro = last + 1;

      const hoy = new Date();
      const ingreso = ymd(hoy);
      const entregaDate = addBusinessDays(hoy, 3);
      const entrega = ymd(entregaDate);

      setNextInfo({ nro, fechaIngresoISO: ingreso, fechaEntregaISO: entrega });
    })();
  }, []);

  /* === Cargar artículos activos === */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('articulo')
        .select('id,nombre,precio,activo')
        .eq('activo', true)
        .order('nombre', { ascending: true });
      if (error) console.error(error);
      setCatalogo((data as Articulo[]) || []);
    })();
  }, []);

  /* === Buscar cliente por teléfono con debounce === */
  const debRef = useRef<number | null>(null);
  useEffect(() => {
    const digits = (telefono || '').replace(/\D/g, '');
    if (digits.length < 8) {
      setCliente(null);
      return;
    }
    if (debRef.current) window.clearTimeout(debRef.current);
    debRef.current = window.setTimeout(async () => {
      try {
        setCheckingCli(true);
        const { data, error } = await supabase
          .from('clientes')
          .select('telefono,nombre,direccion')
          .eq('telefono', digits)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setCliente({
            telefono: String(data.telefono),
            nombre: String(data.nombre || ''),
            direccion: String(data.direccion || ''),
          });
          setOpenCliModal(false);
        } else {
          setCliente(null);
          setOpenCliModal(true);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setCheckingCli(false);
      }
    }, 400) as unknown as number;
    return () => {
      if (debRef.current) window.clearTimeout(debRef.current);
    };
  }, [telefono]);

  /* === Abrir modal de detalle al elegir artículo === */
  function addFromSelect() {
    const nombreSel = (selArt || busquedaArt || '').trim();
    if (!nombreSel) return;

    if (
      nombreSel === '__OTRO__' ||
      nombreSel.toUpperCase() === 'OTRO (+)' ||
      nombreSel.toUpperCase() === 'OTRO'
    ) {
      setOpenArtModal(true);
      return;
    }

    const found = catalogo.find((a) => a.nombre === nombreSel);
    if (!found) {
      alert('Este artículo no existe en el listado. Usa "OTRO (+)" para crearlo.');
      return;
    }

    setArticuloDetalle(found);
    setOpenDetalle(true);
  }

  function confirmarDetalleLinea(d: { articulo: string; qty: number; valor: number }) {
    setItems((prev) => {
      const index = prev.findIndex(
        (x) => x.articulo === d.articulo && x.valor === d.valor
      );

      if (index >= 0) {
        const updated = [...prev];
        const newQty = Number(updated[index].qty) + Number(d.qty);
        updated[index] = {
          ...updated[index],
          qty: newQty,
          subtotal: newQty * Number(updated[index].valor),
        };
        return updated;
      }

      return [
        ...prev,
        {
          articulo: d.articulo,
          qty: Number(d.qty),
          valor: Number(d.valor),
          subtotal: Number(d.qty) * Number(d.valor),
        },
      ];
    });

    setSelArt('');
    setBusquedaArt('');
  }

  function setQty(idx: number, v: number) {
    setItems((prev) => {
      const next = [...prev];
      const qty = Math.max(0, Number(v || 0));
      next[idx] = { ...next[idx], qty, subtotal: qty * next[idx].valor };
      return next;
    });
  }

  function setValor(idx: number, v: number) {
    setItems((prev) => {
      const next = [...prev];
      const val = Math.max(0, Number(v || 0));
      next[idx] = { ...next[idx], valor: val, subtotal: val * next[idx].qty };
      return next;
    });
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  /* === Foto === */
  async function uploadFoto(file: File) {
    try {
      setSubiendoFoto(true);
      const stamp = Date.now();
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `tmp_${stamp}.${ext}`;
      const { data, error } = await supabase.storage.from('fotos').upload(fileName, file, {
        upsert: false,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('fotos').getPublicUrl(data.path);
      setFotoUrl(pub.publicUrl);
    } catch (e) {
      console.error(e);
    } finally {
      setSubiendoFoto(false);
      setOpenFoto(false);
    }
  }

  /* === Guardar pedido === */
  const [saving, setSaving] = useState(false);
  async function guardarPedido() {
    if (!nextInfo) return;
    try {
      setSaving(true);

      const payload = {
        nro: nextInfo.nro,
        telefono: cliente?.telefono ?? null,
        total,
        estado: 'LAVAR',
        pagado: false,
        fecha_ingreso: nextInfo.fechaIngresoISO,
        fecha_entrega: nextInfo.fechaEntregaISO,
        foto_url: fotoUrl ?? null,
      };
      const { error: eP } = await supabase.from('pedido').insert(payload);
      if (eP) throw eP;

      const lineas = items
        .filter((it) => it.qty > 0 && it.articulo.trim() !== '')
        .map((it) => ({
          pedido_id: nextInfo.nro,
          articulo: it.articulo,
          cantidad: it.qty,
          valor: it.valor,
        }));
      if (lineas.length) {
        const { error: eL } = await supabase.from('pedido_linea').insert(lineas);
        if (eL) throw eL;
      }

      alert(`Pedido #${nextInfo.nro} guardado correctamente`);
      setItems([]);
      setFotoUrl(null);
      setTelefono('');
      setCliente(null);

      const hoy = new Date();
      setNextInfo({
        nro: nextInfo.nro + 1,
        fechaIngresoISO: ymd(hoy),
        fechaEntregaISO: ymd(addBusinessDays(hoy, 3)),
      });
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'No se pudo guardar el pedido');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* Header */}
      <header className="relative z-10 mx-auto max-w-6xl px-6 pt-6">
        <div className="flex items-start justify-between">
          <h1 className="text-4xl sm:text-5xl font-extrabold">
            N° {nextInfo?.nro ?? '—'}
          </h1>
          <div className="text-right">
            <div className="text-xl sm:text-2xl">{nextInfo?.fechaIngresoISO ?? ''}</div>
            <div className="text-xl sm:text-2xl">{nextInfo?.fechaEntregaISO ?? ''}</div>
          </div>
        </div>

        {/* Teléfono / cliente */}
        <div className="mt-4">
          <label className="sr-only" htmlFor="tel">
            Teléfono del cliente
          </label>
          <div className="relative max-w-md">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/80">
              {checkingCli ? <Loader2 className="animate-spin" size={16} /> : <Phone size={16} />}
            </div>
            <input
              id="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))}
              inputMode="tel"
              autoComplete="tel"
              placeholder="9 dígitos..."
              className="w-full rounded-xl bg-white/10 border border-white/20 pl-9 pr-3 py-3 text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
          {cliente && (
            <div className="mt-2 text-white/90 text-sm">
              <div className="font-semibold uppercase">{cliente.nombre || 'SIN NOMBRE'}</div>
              <div className="uppercase">{cliente.direccion || 'SIN DIRECCIÓN'}</div>
            </div>
          )}
        </div>
      </header>

      {/* Contenido */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 mt-6">
        <div className="rounded-2xl bg-white text-slate-900 p-4 sm:p-5 shadow-[0_10px_30px_rgba(0,0,0,.20)]">
          {/* Selector de artículo */}
          <div className="grid gap-2 mb-3">
            <label className="text-sm font-semibold">Seleccionar artículo</label>
            <div className="flex gap-2 items-center">
              <select
                value={selArt}
                onChange={(e) => {
                  setSelArt(e.target.value);
                  setBusquedaArt(e.target.value);
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none"
              >
                <option value="">Seleccionar artículo...</option>
                {catalogo.map((a) => (
                  <option key={a.id} value={a.nombre}>
                    {a.nombre}
                  </option>
                ))}
                <option value="__OTRO__">OTRO (+)</option>
              </select>
              <button
                onClick={addFromSelect}
                disabled={!selArt}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 disabled:opacity-60"
              >
                <Plus size={16} /> Agregar
              </button>
            </div>
          </div>

          {/* Tabla detalle */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 w-[45%]">Artículo</th>
                  <th className="text-right px-3 py-2 w-[12%]">Cantidad</th>
                  <th className="text-right px-3 py-2 w-[18%]">Valor</th>
                  <th className="text-right px-3 py-2 w-[18%]">Subtotal</th>
                  <th className="px-3 py-2 w-[7%]"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                      Sin artículos todavía.
                    </td>
                  </tr>
                )}
                {items.map((it, idx) => (
                  <tr key={`${idx}-${it.articulo}`}>
                    <td className="px-3 py-2">{it.articulo}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        value={String(it.qty)}
                        onChange={(e) => setQty(idx, Number(e.target.value || 0))}
                        inputMode="numeric"
                        className="w-20 text-right rounded-lg border px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        value={String(it.valor)}
                        onChange={(e) => setValor(idx, Number(e.target.value || 0))}
                        inputMode="numeric"
                        className="w-28 text-right rounded-lg border px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">{CLP.format(it.subtotal)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => removeItem(idx)}
                        className="inline-flex items-center rounded-lg px-2 py-1 hover:bg-slate-100"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-right font-bold">
                    Total
                  </td>
                  <td className="px-3 py-3 text-right font-extrabold">
                    {CLP.format(total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Foto */}
          <div
            className="mt-4 flex items-center gap-3 rounded-xl bg-violet-50 text-violet-700 px-3 py-3 cursor-pointer"
            onClick={() => setOpenFoto(true)}
            role="button"
            title="Agregar foto"
          >
            <ImagePlus size={18} />
            <span className="text-sm">
              {fotoUrl
                ? 'Foto cargada. Toca para cambiar.'
                : 'Sin imagen adjunta. Toca para agregar.'}
            </span>
          </div>

          {/* Guardar */}
          <div className="mt-4">
            <button
              onClick={guardarPedido}
              disabled={saving || !nextInfo}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-3 disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Guardar Pedido
            </button>
          </div>
        </div>
      </section>

      {/* Modales */}
      <NuevoClienteModal
        open={openCliModal}
        telefono={(telefono || '').replace(/\D/g, '')}
        onClose={() => setOpenCliModal(false)}
        onSaved={(c) => setCliente(c)}
      />

      <NuevoArticuloModal
        open={openArtModal}
        onClose={() => setOpenArtModal(false)}
        onSaved={(a) => {
          setCatalogo((prev) => [...prev, a].sort((x, y) => x.nombre.localeCompare(y.nombre)));
          setSelArt(a.nombre);
        }}
      />

      <FotoModal
        open={openFoto}
        onClose={() => setOpenFoto(false)}
        onPicked={(file) => {
          if (file) uploadFoto(file);
          else setOpenFoto(false);
        }}
      />

      <DetalleArticuloModal
        open={openDetalle}
        articulo={articuloDetalle}
        onClose={() => setOpenDetalle(false)}
        onConfirm={(d) => {
          confirmarDetalleLinea(d);
          setOpenDetalle(false);
        }}
      />

      {/* estado de subida */}
      {subiendoFoto && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-white/90 text-slate-900 px-3 py-2 shadow">
          Subiendo foto…
        </div>
      )}
    </main>
  );
}
