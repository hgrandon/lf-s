// app/pedido/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Save, X } from 'lucide-react';

import Correlativo from './correlativo/Correlativo';
import Telefono, { Cliente } from './telefono/Telefono';
import Articulos, { Articulo, Item } from './articulos/Articulos';
import Fotos from './fotos/Fotos';

/* =========================
   Tipos extra
========================= */

type NextInfo = {
  nro: number;
  fechaIngresoISO: string;
  fechaEntregaISO: string;
};

type LineaHistorico = {
  articulo: string;
  cantidad: number | null;
};

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

// Formato solo para mostrar en pantalla: dd-mm-yyyy
function formatFechaDisplay(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const [year, month, day] = iso.split('-');
  return `${day}-${month}-${year}`;
}

/* =========================
   Modales reutilizables
========================= */

/** Modal para nuevo cliente (ajustado para móvil) */
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
  const [form, setForm] = useState<Cliente>({
    telefono: '',
    nombre: '',
    direccion: '',
  });
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-2 sm:px-4">
      <div className="w-full max-w-md rounded-t-3xl bg-white text-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="font-bold text-sm sm:text-base">Nuevo cliente</div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-3 grid gap-3 max-h-[55vh] overflow-y-auto">
          <div className="grid gap-1">
            <label className="text-xs sm:text-sm font-medium">Teléfono</label>
            <input
              ref={refFirst}
              value={form.telefono}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  telefono: e.target.value.replace(/\D/g, ''),
                }))
              }
              inputMode="tel"
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 text-sm"
              placeholder="9 dígitos…"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs sm:text-sm font-medium">Nombre</label>
            <input
              value={form.nombre}
              onChange={(e) =>
                setForm((p) => ({ ...p, nombre: e.target.value }))
              }
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 text-sm"
              placeholder="NOMBRE Y APELLIDO"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs sm:text-sm font-medium">Dirección</label>
            <input
              value={form.direccion}
              onChange={(e) =>
                setForm((p) => ({ ...p, direccion: e.target.value }))
              }
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 text-sm"
              placeholder="CALLE Y NÚMERO"
            />
          </div>
          {error && (
            <div className="rounded-lg bg-rose-100 text-rose-700 px-3 py-2 text-xs sm:text-sm">
              {error}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal de detalle artículo (ajustado para móvil) */
/** Modal de detalle artículo (ajustado para móvil y edición cómoda) */
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
  // los manejamos como STRING para que sea fácil editar 7000 -> 8000
  const [qtyStr, setQtyStr] = useState('1');
  const [valorStr, setValorStr] = useState('');

  useEffect(() => {
    if (open && articulo) {
      setQtyStr('1');
      setValorStr(
        articulo.precio != null && !Number.isNaN(articulo.precio)
          ? String(articulo.precio)
          : ''
      );
    }
  }, [open, articulo]);

  if (!open || !articulo) return null;

  function handleAgregar() {
    // convertimos a número SOLO al confirmar
    const qNum = Number(qtyStr.replace(/\D/g, '') || '0');
    const vNum = Number(valorStr.replace(/\D/g, '') || '0');

    const qty = Math.max(1, qNum);
    const valor = Math.max(0, vNum);

    onConfirm({
      articulo: articulo?.nombre ?? '',
      qty,
      valor,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3">
      <div className="w-full max-w-sm rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 text-center font-extrabold text-violet-700 border-b text-base sm:text-lg break-words">
          {articulo?.nombre ?? ''}
        </div>

        <div className="px-4 sm:px-5 py-4 grid gap-3">
          <div className="grid gap-1">
            <label className="text-sm font-semibold text-left">Valor</label>
            <input
              value={valorStr}
              onChange={(e) =>
                setValorStr(e.target.value.replace(/[^0-9]/g, ''))
              }
              inputMode="numeric"
              className="w-full rounded-xl border px-3 py-2 sm:py-3 outline-none focus:ring-2 focus:ring-violet-300 text-base"
              placeholder="0"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-semibold text-left">Cantidad</label>
            <input
              value={qtyStr}
              onChange={(e) =>
                setQtyStr(e.target.value.replace(/[^0-9]/g, ''))
              }
              inputMode="numeric"
              className="w-full rounded-xl border px-3 py-2 sm:py-3 outline-none focus:ring-2 focus:ring-violet-300 text-base"
              placeholder="1"
            />
          </div>

          <button
            onClick={handleAgregar}
            className="mt-2 w-full rounded-xl bg-violet-700 py-2.5 sm:py-3 text-white font-semibold hover:bg-violet-800"
          >
            Agregar Detalle
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-violet-100 py-2.5 sm:py-3 text-violet-800 font-semibold hover:bg-violet-200"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}


/** Modal de confirmación para eliminar artículo */
function DeleteItemModal({
  open,
  articulo,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  articulo: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <div className="w-[460px] max-w-full rounded-2xl bg-white text-slate-900 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 text-center font-extrabold text-violet-700 border-b">
          ¿Eliminar este artículo?
        </div>
        <div className="px-6 py-5 text-center text-sm text-slate-700">
          <p>
            <span className="font-semibold">&quot;{articulo}&quot;</span> será eliminado
            del pedido.
          </p>
        </div>
        <div className="px-6 py-4 border-t flex gap-3 justify-center">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-violet-700 text-white font-semibold py-2 hover:bg-violet-800"
          >
            Eliminar
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-violet-100 text-violet-800 font-semibold py-2 hover:bg-violet-200"
          >
            Cancelar
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
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-slate-100 text-slate-500"
          >
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
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 hover:bg-slate-50"
          >
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

/* =========================
   Página principal
========================= */

export default function PedidoPage() {
  const router = useRouter();

  const [nextInfo, setNextInfo] = useState<NextInfo | null>(null);

  // cliente
  const [telefono, setTelefono] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [checkingCli, setCheckingCli] = useState(false);
  const [openCliModal, setOpenCliModal] = useState(false);

  // artículos
  const [catalogo, setCatalogo] = useState<Articulo[]>([]);
  const [openArtModal, setOpenArtModal] = useState(false);

  // modal de detalle
  const [openDetalle, setOpenDetalle] = useState(false);
  const [articuloDetalle, setArticuloDetalle] = useState<Articulo | null>(null);

  // modal de eliminar
  const [openDelete, setOpenDelete] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  // líneas
  const [items, setItems] = useState<Item[]>([]);

  // fotos
  const [fotoUrl, setFotoUrl] = useState<string | null>(null); // última foto para mostrar
  const [fotos, setFotos] = useState<string[]>([]);            // TODAS las fotos del pedido
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  // ref para la cámara / archivo (se usa en Correlativo y Fotos)
  const fotoInputRef = useRef<HTMLInputElement>(null!);

  const total = useMemo(
    () =>
      items.reduce(
        (a, it) => a + (Number(it.qty) || 0) * (Number(it.valor) || 0),
        0,
      ),
    [items],
  );

  /* === Cargar correlativo y fechas === */
  useEffect(() => {
    (async () => {
      try {
        const { data: row, error } = await supabase
          .from('pedido')
          .select('nro')
          .order('nro', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;

        const last = Number(row?.nro || 0);
        const nro = last + 1;

        const hoy = new Date();
        const ingreso = ymd(hoy);
        const entregaDate = addBusinessDays(hoy, 3);
        const entrega = ymd(entregaDate);

        setNextInfo({ nro, fechaIngresoISO: ingreso, fechaEntregaISO: entrega });
      } catch (e) {
        console.error('Error cargando correlativo', e);
      }
    })();
  }, []);

  /* === Cargar artículos activos y ordenarlos por lo más vendido === */
  useEffect(() => {
    (async () => {
      try {
        const { data: dataArt, error: errArt } = await supabase
          .from('articulo')
          .select('id,nombre,precio,activo')
          .eq('activo', true);

        if (errArt) throw errArt;
        const articulos = (dataArt as Articulo[]) || [];

        const { data: dataHist, error: errHist } = await supabase
          .from('pedido_linea')
          .select('articulo,cantidad');

        if (errHist) throw errHist;
        const historico = (dataHist as LineaHistorico[]) || [];

        const usoPorArticulo: Record<string, number> = {};
        for (const l of historico) {
          const nombre = (l.articulo || '').toUpperCase().trim();
          if (!nombre) continue;
          const cant = Number(l.cantidad || 0);
          usoPorArticulo[nombre] = (usoPorArticulo[nombre] || 0) + cant;
        }

        const ordenados = [...articulos].sort((a, b) => {
          const ua = usoPorArticulo[a.nombre.toUpperCase().trim()] || 0;
          const ub = usoPorArticulo[b.nombre.toUpperCase().trim()] || 0;
          if (ub !== ua) return ub - ua;
          return a.nombre.localeCompare(b.nombre);
        });

        setCatalogo(ordenados);
      } catch (e) {
        console.error('Error cargando artículos ordenados por uso', e);
      }
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

  /* === Lógica para selección de artículos (abre modal al elegir) === */
  function handleSelectArticulo(nombreSel: string) {
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
        (x) => x.articulo === d.articulo && x.valor === d.valor,
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
  }

  function requestDelete(idx: number) {
    setDeleteIndex(idx);
    setOpenDelete(true);
  }

  function confirmDelete() {
    if (deleteIndex === null) return;
    setItems((prev) => prev.filter((_, i) => i !== deleteIndex));
    setDeleteIndex(null);
    setOpenDelete(false);
  }

  function cancelDelete() {
    setDeleteIndex(null);
    setOpenDelete(false);
  }

  /* === Foto === */
  async function uploadFoto(file: File) {
    if (!nextInfo) {
      console.warn('No hay correlativo aún, no se puede subir la foto.');
      return;
    }

    try {
      setSubiendoFoto(true);

      const stamp = Date.now();
      const ext = file.name.split('.').pop() || 'jpg';

      // Misma estructura que en Lavar: carpeta por pedido
      const nro = nextInfo.nro;
      const path = `pedido-${nro}/${stamp}.${ext}`;

      const { data, error } = await supabase.storage
        .from('fotos')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        });
      if (error) throw error;

      const { data: pub } = supabase.storage.from('fotos').getPublicUrl(data!.path);
      const publicUrl = pub.publicUrl;

      // última foto para mostrar en el componente Fotos
      setFotoUrl(publicUrl);

      // acumulamos todas las fotos del pedido
      setFotos((prev) => [...prev, publicUrl]);
    } catch (e) {
      console.error(e);
    } finally {
      setSubiendoFoto(false);
    }
  }

  /* === Guardar pedido === */
  const [saving, setSaving] = useState(false);

  async function guardarPedido() {
    if (!nextInfo) return;
    if (!items.length) {
      alert('Debes agregar al menos un artículo.');
      return;
    }

    try {
      setSaving(true);

      // Todas las fotos tomadas en Pedido (si no hay, usamos la última suelta)
      const fotosArray = fotos.length ? fotos : fotoUrl ? [fotoUrl] : [];

      const payload = {
        nro: nextInfo.nro,
        telefono: cliente?.telefono ?? null,
        total,
        estado: 'LAVAR',
        pagado: false,
        fecha_ingreso: nextInfo.fechaIngresoISO,
        fecha_entrega: nextInfo.fechaEntregaISO,
        // Guardamos como JSON para que Lavar pueda usar el slider
        foto_url: fotosArray.length ? JSON.stringify(fotosArray) : null,
      };

      // 1) Insertar pedido
      const { error: eP } = await supabase.from('pedido').insert(payload);
      if (eP) throw eP;

      // 2) Insertar líneas
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

      // 3) Insertar todas las fotos en pedido_foto
      if (fotosArray.length) {
        const filasFotos = fotosArray.map((url) => ({
          pedido_id: nextInfo.nro,
          url,
        }));

        const { error: eF } = await supabase.from('pedido_foto').insert(filasFotos);
        if (eF) throw eF;
      }

      // Volver al menú principal después de guardar
      router.push('/menu');
      return;
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'No se pudo guardar el pedido');
    } finally {
      setSaving(false);
    }
  }

  const articuloAEliminar =
    deleteIndex !== null && items[deleteIndex]
      ? items[deleteIndex].articulo
      : '';

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* Header (correlativo + teléfono) */}
      <header className="relative z-10 mx-auto max-w-6xl px-6 pt-6">
        <Correlativo
          nro={nextInfo?.nro}
          fechaIngreso={formatFechaDisplay(nextInfo?.fechaIngresoISO)}
          fechaEntrega={formatFechaDisplay(nextInfo?.fechaEntregaISO)}
          onClickCamara={() => fotoInputRef.current?.click()}
        />
        <Telefono
          telefono={telefono}
          onTelefonoChange={(v) => setTelefono(v.replace(/\D/g, ''))}
          checkingCli={checkingCli}
          cliente={cliente}
        />
      </header>

      {/* Contenido: selector + tabla (Articulos) y foto */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 mt-6 space-y-4">
        <Articulos
          catalogo={catalogo}
          items={items}
          total={total}
          onSelectArticulo={handleSelectArticulo}
          onRowClick={requestDelete}
        />

          <Fotos
            fotoUrl={fotoUrl}
            inputRef={fotoInputRef}
            initialGaleria={fotos}   // 🔹 AQUÍ LE PASAMOS TODAS LAS FOTOS DEL PEDIDO
            onFileSelected={(file) => {
              if (file) uploadFoto(file);
            }}
          />
      </section>

      {/* Botón guardar fijo abajo, como en tu mock */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 px-4 sm:px-6 pb-5 pt-2 bg-gradient-to-t from-violet-900/90 via-violet-900/40 to-transparent">
        <button
          onClick={guardarPedido}
          disabled={saving || !nextInfo}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-semibold px-5 py-3 disabled:opacity-60 shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Guardar Pedido
        </button>
      </footer>

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
          setCatalogo((prev) =>
            [...prev, a].sort((x, y) => x.nombre.localeCompare(y.nombre)),
          );
          handleSelectArticulo(a.nombre);
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

      <DeleteItemModal
        open={openDelete}
        articulo={articuloAEliminar}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      {subiendoFoto && (
        <div className="fixed bottom-20 right-4 z-50 rounded-xl bg-white/90 text-slate-900 px-3 py-2 shadow">
          Subiendo foto…
        </div>
      )}
    </main>
  );
}
