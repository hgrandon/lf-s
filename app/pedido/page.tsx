// app/pedido/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  Loader2,
  Save,
  X,
  Home,
  CreditCard,
  Droplet,
  WashingMachine,
  Archive,
  Truck,
  PackageCheck,
  Building2,
  MessageCircle,
} from 'lucide-react';

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

type PedidoEstado = 'LAVAR' | 'LAVANDO' | 'GUARDADO' | 'ENTREGAR' | 'ENTREGADO';

// === Seguridad UUD (basada en lf_auth del login) ===
type AuthMode = 'clave' | 'usuario';

type LfSession = {
  mode: AuthMode;
  display: string;
  rol?: string | null;
  ts: number;
  ttl: number;
};

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

// Normaliza a formato chileno "56..." para usar en wa.me
function normalizarTelefonoChile(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;

  // ya viene con 56
  if (digits.startsWith('56')) return digits;

  // 9 dígitos -> asumimos celular chileno
  if (digits.length === 9) return `56${digits}`;

  // fallback: prepende 56 igual
  return `56${digits}`;
}

// Construye URL wa.me con el mensaje del pedido recepcionado (con nombre)
function buildWhatsappUrl(
  telefonoDestino: string | null,
  nro: number,
  nombreCliente: string | null,
): string {
  const fallback = '56991335828'; // tu número por defecto
  const to = normalizarTelefonoChile(telefonoDestino) ?? fallback;

  const nombre = (nombreCliente ?? '').trim() || 'estimado/a';

  const message = [
    `Hola ${nombre},`,
    ``,
    `Pedido N° ${nro} ya fue recepcionado ✅`,
    ``,
    `Te avisaremos por este mismo medio cuando esté listo.`,
    `¡Gracias por preferirnos!`,
    ``,
    `Cualquier consulta hazla llegar al WhatsApp 991335828.`,
  ].join('\n');

  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}

/* =========================
   Config estado (icono ciclo)
========================= */

const ESTADOS_ORDEN: PedidoEstado[] = [
  'LAVAR',
  'LAVANDO',
  'GUARDADO',
  'ENTREGAR',
  'ENTREGADO',
];

function getEstadoConfig(e: PedidoEstado) {
  switch (e) {
    case 'LAVAR':
      return { label: 'LAVAR', Icon: Droplet, className: 'text-sky-300 drop-shadow' };
    case 'LAVANDO':
      return {
        label: 'LAVANDO',
        Icon: WashingMachine,
        className: 'text-sky-400 drop-shadow',
      };
    case 'GUARDADO':
      return {
        label: 'GUARDADO',
        Icon: Archive,
        className: 'text-amber-400 drop-shadow',
      };
    case 'ENTREGAR':
      return {
        label: 'ENTREGAR',
        Icon: Truck,
        className: 'text-fuchsia-300 drop-shadow',
      };
    case 'ENTREGADO':
    default:
      return {
        label: 'ENTREGADO',
        Icon: PackageCheck,
        className: 'text-emerald-400 drop-shadow',
      };
  }
}

/* =========================
   Modales reutilizables
========================= */

/** Modal para nuevo/editar cliente (ajustado para móvil) */
function NuevoClienteModal({
  open,
  telefono,
  clienteActual,
  onClose,
  onSaved,
}: {
  open: boolean;
  telefono: string;
  clienteActual?: Cliente | null;
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
      const telBase = (clienteActual?.telefono || telefono || '').replace(/\D/g, '');
      setForm({
        telefono: telBase,
        nombre: (clienteActual?.nombre || '').toString(),
        direccion: (clienteActual?.direccion || '').toString(),
      });
      setError(null);
      const t = setTimeout(() => refFirst.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open, telefono, clienteActual]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-2 sm:px-4">
      <div className="w-full max-w-sm sm:max-w-md rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden max-h-[80vh]">
        {/* header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b">
          <div className="font-bold text-sm sm:text-base">
            {clienteActual ? 'Editar cliente' : 'Nuevo cliente'}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* cuerpo */}
        <div className="px-4 sm:px-5 py-3 grid gap-3 max-h-[55vh] overflow-y-auto">
          <div className="grid gap-1">
            <label className="text-xs sm:text-sm font-medium">Teléfono</label>
            <input
              ref={refFirst}
              value={form.telefono}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  telefono: e.target.value.replace(/\D/g, ''),
                }))
              }
              inputMode="tel"
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 text-sm"
              placeholder="Ej: 991234567"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs sm:text-sm font-medium">Nombre</label>
            <input
              value={form.nombre}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  nombre: e.target.value.toUpperCase(),
                }))
              }
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 text-sm uppercase"
              placeholder="Ej: JUAN PÉREZ"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs sm:text-sm font-medium">Dirección</label>
            <input
              value={form.direccion}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  direccion: e.target.value.toUpperCase(),
                }))
              }
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 text-sm uppercase"
              placeholder="Ej: LOS CARRERA 1234"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-rose-100 text-rose-700 px-3 py-2 text-xs sm:text-sm">
              {error}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-4 sm:px-5 py-3 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-xs sm:text-sm hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-xs sm:text-sm disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [qtyStr, setQtyStr] = useState('1');
  const [valorStr, setValorStr] = useState('');

  useEffect(() => {
    if (open && articulo) {
      setQtyStr('1');
      setValorStr(
        articulo.precio != null && !Number.isNaN(articulo.precio)
          ? String(articulo.precio)
          : '',
      );
    }
  }, [open, articulo]);

  if (!open || !articulo) return null;

  function handleAgregar() {
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
              onChange={(e) => setValorStr(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              className="w-full rounded-xl border px-3 py-2 sm:py-3 outline-none focus:ring-2 focus:ring-violet-300 text-base"
              placeholder="0"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-semibold text-left">Cantidad</label>
            <input
              value={qtyStr}
              onChange={(e) => setQtyStr(e.target.value.replace(/[^0-9]/g, ''))}
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
            <span className="font-semibold">&quot;{articulo}&quot;</span> será eliminado del
            pedido.
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

/** Modal para nuevo artículo (versión más pequeña y tipo “bottom sheet” en celular) */
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

      const nombreLimpio = nombre.trim().toUpperCase();
      const precioNumero = Number(precio || 0);

      if (!nombreLimpio) {
        throw new Error('Nombre obligatorio.');
      }
      if (precioNumero < 0) {
        throw new Error('El precio no puede ser negativo.');
      }

      const payload = {
        nombre: nombreLimpio,
        precio: precioNumero,
        activo: true,
      };

      const { data, error } = await supabase
        .from('articulo')
        .upsert(payload, { onConflict: 'nombre' })
        .select('id,nombre,precio,activo')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('No se recibió respuesta al guardar el artículo.');

      onSaved(data as Articulo);
      onClose();
    } catch (e: any) {
      setError(
        e?.message ?? 'No se pudo guardar el artículo. Inténtalo nuevamente.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-2 sm:px-4">
      {/* modal centrado en todas las pantallas */}
      <div className="w-full max-w-sm sm:max-w-md rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden">
        {/* header más compacto */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b">
          <div className="font-bold text-sm sm:text-base">Nuevo artículo</div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* cuerpo con altura limitada y scroll interno */}
        <div className="px-4 sm:px-5 py-3 grid gap-3 max-h-[55vh] overflow-y-auto">
          <div className="grid gap-1">
            <label className="text-xs sm:text-sm font-medium">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value.toUpperCase())}
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 text-sm uppercase"
              placeholder="Ej: COBERTOR KING"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs sm:text-sm font-medium">Precio (CLP)</label>
            <input
              value={String(precio)}
              onChange={(e) => setPrecio(Number(e.target.value || 0))}
              inputMode="numeric"
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 text-sm text-right"
              placeholder="0"
            />
          </div>
          {error && (
            <div className="rounded-lg bg-rose-100 text-rose-700 px-3 py-2 text-xs sm:text-sm">
              {error}
            </div>
          )}
        </div>

        {/* footer compacto */}
        <div className="px-4 sm:px-5 py-3 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-xs sm:text-sm hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-xs sm:text-sm disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal para preguntar cantidad de bolsas */
function BolsasModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (nBolsas: number) => void;
}) {
  const [valorStr, setValorStr] = useState('1');

  useEffect(() => {
    if (open) {
      setValorStr('1');
    }
  }, [open]);

  if (!open) return null;

  function handleConfirm() {
    const n = Number(valorStr.replace(/\D/g, '') || '0');
    const bolsas = Math.max(1, n);
    onConfirm(bolsas);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white text-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="font-bold text-sm sm:text-base">
            Número de bolsas para este pedido
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 grid gap-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Cantidad de bolsas</label>
            <input
              value={valorStr}
              onChange={(e) => setValorStr(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 text-base text-center"
              placeholder="1"
            />
            <p className="text-xs text-slate-600 mt-1">
              Este número se usará para generar los rótulos (1/N, 2/N, 3/N…).
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm"
          >
            <Save size={16} />
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal para confirmar envío de WhatsApp después de guardar */
type WhatsData = { nro: number; telefono: string | null; nombre: string | null };

function WhatsAppConfirmModal({
  open,
  data,
  onClose,
  onSend,
}: {
  open: boolean;
  data: WhatsData | null;
  onClose: () => void;
  onSend: () => void;
}) {
  if (!open || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <MessageCircle className="text-violet-600" size={18} />
            <span className="font-semibold text-sm sm:text-base">
              Pedido guardado correctamente
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 text-sm text-slate-700 space-y-2">
          <p>
            El pedido <span className="font-semibold">N° {data.nro}</span> fue guardado con
            éxito.
          </p>
          <p>
            ¿Quieres abrir <span className="font-semibold">WhatsApp</span> con un mensaje
            listo para enviar al cliente?
          </p>
          <p className="text-xs text-slate-500">
            (Solo se abrirá el chat, tú decides si lo envías o lo editas antes.)
          </p>
        </div>

        <div className="px-5 py-3 border-t flex flex-col sm:flex-row gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-semibold py-2 hover:bg-slate-100"
          >
            No, ir al menú
          </button>
          <button
            onClick={onSend}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2"
          >
            <MessageCircle size={18} />
            Sí, abrir WhatsApp
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

  // MODO EMPRESA (por query string ?mode=empresa&empresa=...)
  const [empresaMode, setEmpresaMode] = useState(false);
  const [empresaNombre, setEmpresaNombre] = useState<string | null>(null);
  const ES_EMPRESA = empresaMode;

  // -----------------------------
  // Leer parámetros de empresa
  // -----------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const emp = params.get('empresa');

      if (mode === 'empresa') {
        setEmpresaMode(true);
        setEmpresaNombre(emp);
      } else {
        setEmpresaMode(false);
        setEmpresaNombre(null);
      }
    } catch (e) {
      console.error('No se pudieron leer los parámetros de empresa', e);
    }
  }, []);

  // Seguridad UUD
  const [authOk, setAuthOk] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const sess = readSessionSafely();
    if (!sess) {
      router.replace('/login?next=/pedido');
      setAuthOk(false);
    } else {
      setAuthOk(true);
    }
    setAuthChecked(true);
  }, [router]);

  // Estados de la página (todos los hooks juntos)
  const [nextInfo, setNextInfo] = useState<NextInfo | null>(null);
  const [nombre, setNombre] = useState(''); // reservado por si luego se usa
  const [telefono, setTelefono] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [checkingCli, setCheckingCli] = useState(false);
  const [openCliModal, setOpenCliModal] = useState(false);

  const [catalogo, setCatalogo] = useState<Articulo[]>([]);
  const [openArtModal, setOpenArtModal] = useState(false);

  const [openDetalle, setOpenDetalle] = useState(false);
  const [articuloDetalle, setArticuloDetalle] = useState<Articulo | null>(null);

  const [openDelete, setOpenDelete] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const [items, setItems] = useState<Item[]>([]);

  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotos, setFotos] = useState<string[]>([]);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const [pagado, setPagado] = useState<boolean>(false);
  const [tipoEntrega, setTipoEntrega] = useState<'LOCAL' | 'DOMICILIO'>('LOCAL');

  const [estado, setEstado] = useState<PedidoEstado>('LAVAR');

  const [bolsasModalOpen, setBolsasModalOpen] = useState(false);

  // Modal WhatsApp post-guardar
  const [whatsOpen, setWhatsOpen] = useState(false);
  const [whatsData, setWhatsData] = useState<WhatsData | null>(null);

  const fotoInputRef = useRef<HTMLInputElement>(null!);

  const debRef = useRef<number | null>(null);

  const [saving, setSaving] = useState(false);

  const total = useMemo(
    () =>
      items.reduce(
        (a, it) => a + (Number(it.qty) || 0) * (Number(it.valor) || 0),
        0,
      ),
    [items],
  );

  // -------------------------------------------------
  // AUTOCOMPLETAR DATOS DE EMPRESA AL CREAR PEDIDO
  // -------------------------------------------------
  useEffect(() => {
    async function loadEmpresaData() {
      if (!empresaMode || !empresaNombre) return;

      try {
        const nombreDecod = decodeURIComponent(empresaNombre);

        const { data, error } = await supabase
          .from('empresas')
          .select('nombre,direccion,telefono_contacto')
          .eq('nombre', nombreDecod)
          .maybeSingle();

        if (error) {
          console.error('Error cargando empresa para pedido', error);
          return;
        }
        if (!data) return;

        const tel = (data.telefono_contacto || '').toString().replace(/\D/g, '');

        setTelefono(tel);
        setCliente({
          telefono: tel,
          nombre: (data.nombre || '').toString(),
          direccion: (data.direccion || '').toString(),
        });
      } catch (e) {
        console.error('No se pudo autocompletar datos de empresa', e);
      }
    }

    loadEmpresaData();
  }, [empresaMode, empresaNombre]);

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
          .from('articulo_con_popularidad')
          .select('id,nombre,precio,activo,uso')
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
          const nombreArt = (l.articulo || '').toUpperCase().trim();
          if (!nombreArt) continue;
          const cant = Number(l.cantidad || 0);
          usoPorArticulo[nombreArt] = (usoPorArticulo[nombreArt] || 0) + cant;
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

  /* === Buscar cliente por teléfono con debounce (SIN loop ni parpadeo) === */
  useEffect(() => {
    // En modo EMPRESA nunca buscamos por teléfono aquí
    if (ES_EMPRESA) {
      setCheckingCli(false);
      if (debRef.current) window.clearTimeout(debRef.current);
      return;
    }

    const digits = (telefono || '').replace(/\D/g, '');

    // Teléfono corto → limpiamos cliente, apagamos spinner y salimos
    if (digits.length < 8) {
      setCliente(null);
      setCheckingCli(false);
      if (debRef.current) window.clearTimeout(debRef.current);
      return;
    }

    // limpiamos timeout anterior
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
  }, [telefono, ES_EMPRESA]);

  /* === Lógica selección de artículos === */
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

    const nombreNormalizado = nombreSel.trim().toUpperCase();

    const found = catalogo.find(
      (a) => a.nombre.trim().toUpperCase() === nombreNormalizado,
    );

    if (!found) {
      alert('Este artículo no existe en el listado. Usa "OTRO (+)" para crearlo.');
      return;
    }

    setArticuloDetalle(found);
    setOpenDetalle(true);
  }

  function confirmarDetalleLinea(d: { articulo: string; qty: number; valor: number }) {
    const nombreNormalizado = d.articulo.trim().toUpperCase();

    const artCatalogo = catalogo.find(
      (a) => a.nombre.trim().toUpperCase() === nombreNormalizado,
    );

    if (artCatalogo && Number(artCatalogo.precio || 0) !== Number(d.valor || 0)) {
      setCatalogo((prev) =>
        prev.map((a) =>
          a.nombre.trim().toUpperCase() === nombreNormalizado
            ? { ...a, precio: d.valor }
            : a,
        ),
      );

      (async () => {
        try {
          await supabase.from('articulo').update({ precio: d.valor }).eq('id', artCatalogo.id);
        } catch (e) {
          console.error('No se pudo actualizar el precio del artículo', e);
        }
      })();
    }

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

      setFotoUrl(publicUrl);
      setFotos((prev) => [...prev, publicUrl]);
    } catch (e) {
      console.error(e);
    } finally {
      setSubiendoFoto(false);
    }
  }

  /* === Guardar pedido (con creado_por) === */
  async function guardarPedido(numBolsas: number) {
    if (!nextInfo) return;
    if (!items.length) {
      alert('Debes agregar al menos un artículo.');
      return;
    }

    try {
      setSaving(true);

      const fotosArray = fotos.length ? fotos : fotoUrl ? [fotoUrl] : [];

      // Determinar teléfono a guardar y asegurar cliente en modo empresa
      let telefonoPedido: string | null = cliente?.telefono ?? null;

      if (ES_EMPRESA && telefono) {
        const digits = telefono.replace(/\D/g, '');

        if (digits) {
          const payloadCliente = {
            telefono: digits,
            nombre: empresaNombre?.toUpperCase() ?? 'EMPRESA',
            direccion: '',
          };

          const { error: eCli } = await supabase
            .from('clientes')
            .upsert(payloadCliente, { onConflict: 'telefono' });

          if (eCli) throw eCli;

          setCliente({
            telefono: digits,
            nombre: payloadCliente.nombre,
            direccion: payloadCliente.direccion,
          });

          telefonoPedido = digits;
        }
      }

      // 🧑‍💻 NUEVO: quién está creando el pedido (usuario logeado)
      const sess = readSessionSafely();
      const creadoPor = sess?.display ?? null;

      const payload = {
        nro: nextInfo.nro,
        telefono: telefonoPedido,
        total,
        estado,
        pagado,
        tipo_entrega: tipoEntrega,
        fecha_ingreso: nextInfo.fechaIngresoISO,
        fecha_entrega: nextInfo.fechaEntregaISO,
        bolsas: numBolsas,
        foto_url: fotosArray.length ? JSON.stringify(fotosArray) : null,
        es_empresa: ES_EMPRESA,
        empresa_nombre: empresaNombre ?? null,
        // campo nuevo en la tabla pedido
        creado_por: creadoPor,
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


        const { error: evErr } = await supabase
          .from('pedido_evento')
          .insert({
            pedido_nro: nextInfo.nro,
            telefono: telefonoPedido,
            estado_anterior: null,
            estado_nuevo: 'LAVAR',
            tipo_entrega: tipoEntrega,
            accion: 'CREAR_PEDIDO',
            realizado_por: sess?.display ?? 'CLAVE',
            rol: sess?.rol ?? null,
            origen: 'pedido_page',
            nota: ES_EMPRESA ? 'Pedido creado en modo empresa' : null,
          });

        if (evErr) throw evErr;




      if (lineas.length) {
        const { error: eL } = await supabase.from('pedido_linea').insert(lineas);
        if (eL) throw eL;
      }

      if (fotosArray.length) {
        const filasFotos = fotosArray.map((url) => ({
          pedido_id: nextInfo.nro,
          url,
        }));

        const { error: eF } = await supabase.from('pedido_foto').insert(filasFotos);
        if (eF) throw eF;
      }

      // ✅ Pedido guardado: abrimos modal para preguntar si quiere enviar WhatsApp
      setWhatsData({
        nro: nextInfo.nro,
        telefono: telefonoPedido,
        nombre: cliente?.nombre ?? empresaNombre ?? null,
      });
      setWhatsOpen(true);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'No se pudo guardar el pedido');
    } finally {
      setSaving(false);
    }
  }

  const articuloAEliminar =
    deleteIndex !== null && items[deleteIndex] ? items[deleteIndex].articulo : '';

  const estadoConfig = getEstadoConfig(estado);

  function handleClickGuardar() {
    if (!nextInfo) return;
    if (!items.length) {
      alert('Debes agregar al menos un artículo.');
      return;
    }
    setBolsasModalOpen(true);
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

  if (!authOk) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white">
        <span className="text-sm opacity-80">Redirigiendo a login…</span>
      </main>
    );
  }

  /* =========================
     Página principal OK
  ========================== */

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* Header (correlativo + teléfono) */}
      <header className="relative z-10 mx-auto max-w-6xl px-6 pt-6">
        {ES_EMPRESA && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-300/95 text-violet-900 px-4 py-1 shadow">
            <Building2 size={16} />
            <span className="text-xs sm:text-sm font-black tracking-wide">
              {empresaNombre ? `EMPRESA: ${empresaNombre}` : 'MODO EMPRESA'}
            </span>
          </div>
        )}

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
          onEditarCliente={
            ES_EMPRESA
              ? undefined
              : () => {
                  const digits = (telefono || '').replace(/\D/g, '');
                  if (digits.length < 8) {
                    alert('Primero ingresa un teléfono válido.');
                    return;
                  }
                  setOpenCliModal(true);
                }
          }
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
          initialGaleria={fotos}
          onFileSelected={(file) => {
            if (file) uploadFoto(file);
          }}
        />
      </section>

      {/* Botón guardar fijo abajo + iconos de estado/tipo entrega */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 px-4 sm:px-6 pb-5 pt-2 bg-gradient-to-t from-violet-900/90 via-violet-900/40 to-transparent">
        <div className="mx-auto max-w-6xl flex items-center gap-4">
          {/* Menú + Guardar */}
          <div className="flex flex-1 items-center gap-3">
            {/* Botón MENÚ */}
            <button
              type="button"
              onClick={() => router.push('/menu')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-500 hover:bg-violet-600 text-white font-semibold px-4 py-3 shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
            >
              <Home size={18} />
              <span className="hidden sm:inline">Menú</span>
            </button>

            {/* Botón GUARDAR */}
            <button
              onClick={handleClickGuardar}
              disabled={saving || !nextInfo}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-semibold px-5 py-3 disabled:opacity-60 shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Guardar
            </button>
          </div>

          {/* Estado / Tipo entrega / Pago */}
          <div className="flex items-center gap-4 ml-2">
            {/* Estado */}
            <button
              type="button"
              onClick={() =>
                setEstado((prev) => {
                  const idx = ESTADOS_ORDEN.indexOf(prev);
                  const next = ESTADOS_ORDEN[(idx + 1) % ESTADOS_ORDEN.length];
                  return next;
                })
              }
              className="flex flex-col items-center text-xs focus:outline-none"
            >
              <estadoConfig.Icon size={32} className={estadoConfig.className} />
              <span className="mt-1 text-[0.65rem] uppercase tracking-wide">
                {estadoConfig.label}
              </span>
            </button>

            {/* Tipo entrega */}
            <button
              type="button"
              onClick={() =>
                setTipoEntrega((prev) =>
                  prev === 'DOMICILIO' ? 'LOCAL' : 'DOMICILIO',
                )
              }
              className="flex flex-col items-center text-xs focus:outline-none"
            >
              <Home
                size={32}
                className={
                  tipoEntrega === 'DOMICILIO'
                    ? 'text-yellow-300 drop-shadow'
                    : 'text-red-500 drop-shadow'
                }
              />
              <span className="mt-1 text-[0.65rem] uppercase tracking-wide">
                {tipoEntrega}
              </span>
            </button>

            {/* Pago */}
            <button
              type="button"
              onClick={() => setPagado((prev) => !prev)}
              className="flex flex-col items-center text-xs focus:outline-none"
            >
              <CreditCard
                size={32}
                className={
                  pagado ? 'text-green-400 drop-shadow' : 'text-red-400 drop-shadow'
                }
              />
              <span className="mt-1 text-[0.65rem] uppercase tracking-wide">
                {pagado ? 'PAGADO' : 'PENDIENTE'}
              </span>
            </button>
          </div>
        </div>
      </footer>

      {/* Modales */}
      <NuevoClienteModal
        open={openCliModal}
        telefono={(telefono || '').replace(/\D/g, '')}
        clienteActual={cliente}
        onClose={() => setOpenCliModal(false)}
        onSaved={(c) => {
          setCliente(c);
          setTelefono(c.telefono);
        }}
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

      <BolsasModal
        open={bolsasModalOpen}
        onClose={() => setBolsasModalOpen(false)}
        onConfirm={(nBolsas) => {
          setBolsasModalOpen(false);
          guardarPedido(nBolsas);
        }}
      />

      <WhatsAppConfirmModal
        open={whatsOpen}
        data={whatsData}
        onClose={() => {
          setWhatsOpen(false);
          router.push('/menu');
        }}
        onSend={() => {
          if (!whatsData) return;
          const url = buildWhatsappUrl(
            whatsData.telefono,
            whatsData.nro,
            whatsData.nombre,
          );
          window.open(url, '_blank');
          setWhatsOpen(false);
          router.push('/menu');
        }}
      />

      {subiendoFoto && (
        <div className="fixed bottom-20 right-4 z-50 rounded-xl bg-white/90 text-slate-900 px-3 py-2 shadow">
          Subiendo foto…
        </div>
      )}
    </main>
  );
}
