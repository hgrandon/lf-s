'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  ArrowLeft,
  PlusCircle,
  CheckCircle2,
  Pencil,
  X,
  RefreshCcw,
  MapPin,
  Navigation,
} from 'lucide-react';

type ClienteDB = {
  telefono: string;
  nombre?: string | null;
  direccion?: string | null;
};

type RutaDB = {
  id: number;
  telefono: string;
  nombre?: string | null;
  direccion?: string | null;
  estado: 'PENDIENTE' | 'RETIRADO' | string;
  pedido_nro?: number | null;
  creado_en?: string | null;
  retirado_en?: string | null;
  creado_por?: string | null;
  retirado_por?: string | null;
};

type AuthSession = {
  rol?: string | null;
  ts?: number;
  ttl?: number;
  display?: string | null;
  mode?: string | null;
};

function readDisplay(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('lf_auth');
    if (!raw) return null;
    const s = JSON.parse(raw) as AuthSession;
    if (s.ttl && s.ts && Date.now() - s.ts > s.ttl) {
      localStorage.removeItem('lf_auth');
      return null;
    }
    return (s.display || '').toString() || null;
  } catch {
    return null;
  }
}

function onlyDigitsPhone(v: string) {
  return (v || '').replace(/\D/g, '');
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addBusinessDays(start: Date, businessDays: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < businessDays) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

/* =========================
   Modal simple (sin libs)
========================= */

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold text-slate-800">{title}</div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100"
            aria-label="Cerrar"
            title="Cerrar"
          >
            <X className="w-5 h-5 text-slate-700" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/* =========================
   Página Ruta
========================= */

export default function RutaPage() {
  const router = useRouter();

  // ✅ Solo un input visible: teléfono
  const [telefono, setTelefono] = useState('');

  // Datos del cliente (NO inputs visibles si existe)
  const [clienteExiste, setClienteExiste] = useState(false);
  const [checkingCliente, setCheckingCliente] = useState(false);
  const [cliente, setCliente] = useState<ClienteDB | null>(null);

  // Modal para cliente nuevo
  const [openNuevo, setOpenNuevo] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaDireccion, setNuevaDireccion] = useState('');

  // Lista
  const [lista, setLista] = useState<RutaDB[]>([]);
  const [selId, setSelId] = useState<number | null>(null);

  const [editMode, setEditMode] = useState(false); // editar seleccionado (abre modal)
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const seleccionado = useMemo(
    () => lista.find((x) => x.id === selId) ?? null,
    [lista, selId]
  );

  /* ====== Maps / GPS ====== */
  function abrirMapsConDireccion(dir: string) {
    const q = encodeURIComponent(dir);
    const url = `https://www.google.com/maps/search/?api=1&query=${q}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function abrirMapsConGPS(lat: number, lng: number) {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function pedirGPSyAbrirMaps() {
    if (!('geolocation' in navigator)) {
      alert('Tu dispositivo no soporta GPS en el navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        abrirMapsConGPS(latitude, longitude);
      },
      () => {
        alert('No se pudo obtener GPS. Revisa permisos de ubicación.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  /* ====== Cargar lista ====== */
  async function cargarLista() {
    setCargando(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('ruta_retiro')
        .select(
          'id, telefono, nombre, direccion, estado, pedido_nro, creado_en, retirado_en, creado_por, retirado_por'
        )
        .eq('estado', 'PENDIENTE')
        .order('creado_en', { ascending: false });

      if (e) throw e;
      setLista((data ?? []) as RutaDB[]);
      setSelId((prev) =>
        prev && (data ?? []).some((x: any) => x.id === prev) ? prev : null
      );
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Error cargando ruta');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarLista();
  }, []);

  /* ====== Buscar cliente por teléfono ====== */
  useEffect(() => {
    const t = onlyDigitsPhone(telefono);
    setTelefono(t);

    // reset visual
    setClienteExiste(false);
    setCliente(null);

    if (!t || t.length < 6) return;

    const timer = window.setTimeout(async () => {
      setCheckingCliente(true);
      setError(null);
      try {
        const { data, error: e } = await supabase
          .from('clientes')
          .select('telefono, nombre, direccion')
          .eq('telefono', t)
          .maybeSingle();

        if (e) throw e;

        if (data?.telefono) {
          setClienteExiste(true);
          setCliente({
            telefono: data.telefono,
            nombre: data.nombre ?? '',
            direccion: data.direccion ?? '',
          });
          setOpenNuevo(false); // por si estaba abierto
        } else {
          setClienteExiste(false);
          setCliente(null);

          // ✅ si NO existe → abrir modal para agregar
          setNuevoNombre('');
          setNuevaDireccion('');
          setOpenNuevo(true);
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Error buscando cliente');
      } finally {
        setCheckingCliente(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [telefono]);

  function limpiarFormulario() {
    setTelefono('');
    setClienteExiste(false);
    setCliente(null);
    setOpenNuevo(false);
    setNuevoNombre('');
    setNuevaDireccion('');
    setEditMode(false);
    setSelId(null);
    setError(null);
  }

  async function asegurarCliente(telefonoDigits: string, nom: string, dir: string) {
    const payload = {
      telefono: telefonoDigits,
      nombre: (nom || '').toUpperCase(),
      direccion: (dir || '').toUpperCase(),
    };
    const { error: e } = await supabase
      .from('clientes')
      .upsert(payload, { onConflict: 'telefono' });
    if (e) throw e;
  }

  async function agregarARuta() {
    const tel = onlyDigitsPhone(telefono);
    if (!tel) return alert('Ingresa un teléfono válido.');

    // Si cliente no existe, se agrega desde modal
    if (!clienteExiste || !cliente?.nombre || !cliente?.direccion) {
      alert('Falta registrar el cliente.');
      return;
    }

    setCargando(true);
    setError(null);
    try {
      const creado_por = readDisplay();

      const { error: eIns } = await supabase.from('ruta_retiro').insert({
        telefono: tel,
        nombre: (cliente.nombre || '').toUpperCase(),
        direccion: (cliente.direccion || '').toUpperCase(),
        estado: 'PENDIENTE',
        creado_por,
      });
      if (eIns) throw eIns;

      limpiarFormulario();
      await cargarLista();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'No se pudo agregar a la ruta');
    } finally {
      setCargando(false);
    }
  }

  /* ====== Guardar cliente nuevo desde modal ====== */
  async function guardarClienteNuevo() {
    const tel = onlyDigitsPhone(telefono);
    if (!tel) return alert('Teléfono inválido.');
    if (!nuevoNombre.trim()) return alert('Ingresa el nombre.');
    if (!nuevaDireccion.trim()) return alert('Ingresa la dirección.');

    setCargando(true);
    setError(null);
    try {
      await asegurarCliente(tel, nuevoNombre, nuevaDireccion);
      setClienteExiste(true);
      setCliente({
        telefono: tel,
        nombre: nuevoNombre.toUpperCase(),
        direccion: nuevaDireccion.toUpperCase(),
      });
      setOpenNuevo(false);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'No se pudo guardar el cliente');
    } finally {
      setCargando(false);
    }
  }

  /* ====== Editar cliente seleccionado (modal) ====== */
  const [openEditar, setOpenEditar] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editDireccion, setEditDireccion] = useState('');

  function abrirModalEditarSeleccionado() {
    if (!seleccionado) return;
    setEditNombre((seleccionado.nombre || '').toString());
    setEditDireccion((seleccionado.direccion || '').toString());
    setOpenEditar(true);
    setEditMode(true);
  }

  async function guardarEdicionSeleccionado() {
    if (!seleccionado) return;

    const tel = onlyDigitsPhone(seleccionado.telefono);
    if (!tel) return alert('Teléfono inválido.');
    if (!editNombre.trim() || !editDireccion.trim())
      return alert('Nombre y dirección son obligatorios.');

    setCargando(true);
    setError(null);
    try {
      // actualizar clientes
      await asegurarCliente(tel, editNombre, editDireccion);

      // actualizar ruta_retiro
      const { error: eUp } = await supabase
        .from('ruta_retiro')
        .update({
          nombre: editNombre.toUpperCase(),
          direccion: editDireccion.toUpperCase(),
        })
        .eq('id', seleccionado.id);

      if (eUp) throw eUp;

      setOpenEditar(false);
      setEditMode(false);
      await cargarLista();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'No se pudo guardar la edición');
    } finally {
      setCargando(false);
    }
  }

  async function marcarRetiradoCrearPedido() {
    if (!seleccionado) return;

    setCargando(true);
    setError(null);

    try {
      // 1) obtener último nro
      const { data: row, error: eLast } = await supabase
        .from('pedido')
        .select('nro')
        .order('nro', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (eLast) throw eLast;
      const last = Number(row?.nro || 0);
      const nro = last + 1;

      // 2) insertar pedido mínimo
      const hoy = new Date();
      const payloadPedido: any = {
        nro,
        telefono: seleccionado.telefono,
        total: 0,
        estado: 'LAVAR',
        pagado: false,
        tipo_entrega: 'DOMICILIO',
        fecha_ingreso: ymd(hoy),
        fecha_entrega: ymd(addBusinessDays(hoy, 3)),
        bolsas: 0,
        foto_url: null,
        es_empresa: false,
        empresa_nombre: null,
        creado_por: readDisplay(),
      };

      const { error: eInsP } = await supabase.from('pedido').insert(payloadPedido);
      if (eInsP) throw eInsP;

      // 3) marcar retiro como RETIRADO
      const { error: eUp } = await supabase
        .from('ruta_retiro')
        .update({
          estado: 'RETIRADO',
          pedido_nro: nro,
          retirado_en: new Date().toISOString(),
          retirado_por: readDisplay(),
        })
        .eq('id', seleccionado.id);

      if (eUp) throw eUp;

      await cargarLista();
      limpiarFormulario();

      // 4) abrir editor
      router.push(`/editar?nro=${nro}`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'No se pudo crear el pedido desde la ruta');
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-700 via-fuchsia-700 to-indigo-800 p-4">
      <div className="bg-white rounded-xl shadow-xl p-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-full hover:bg-slate-100"
              title="Volver"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-800">RUTA (RETIROS)</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={pedirGPSyAbrirMaps}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-100 text-violet-800 hover:bg-violet-200"
              title="Abrir Maps con mi GPS"
              disabled={cargando}
            >
              <Navigation className="w-4 h-4" />
              <span>GPS</span>
            </button>

            <button
              onClick={cargarLista}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800"
              title="Actualizar"
              disabled={cargando}
            >
              <RefreshCcw className="w-4 h-4" />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* ✅ SOLO TELÉFONO */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-600">TELÉFONO</label>
          <input
            value={telefono}
            onChange={(e) => setTelefono(onlyDigitsPhone(e.target.value))}
            placeholder="Ej: 991234567"
            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            inputMode="numeric"
          />
          <div className="mt-1 text-[11px] text-slate-500">
            {checkingCliente
              ? 'Buscando cliente…'
              : clienteExiste
              ? 'Cliente encontrado ✅'
              : telefono.length >= 6
              ? 'Cliente no existe → registrar'
              : 'Ingresa el teléfono'}
          </div>
        </div>

        {/* ✅ SI EXISTE: SOLO VISUAL (sin inputs) */}
        {clienteExiste && cliente && (
          <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-3">
            <div className="text-xs font-semibold text-violet-900 mb-2">CLIENTE</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="bg-white rounded-lg p-2 border">
                <div className="text-[11px] text-slate-500">NOMBRE</div>
                <div className="font-semibold text-slate-800">{cliente.nombre || '-'}</div>
              </div>
              <div className="bg-white rounded-lg p-2 border md:col-span-2">
                <div className="text-[11px] text-slate-500">DIRECCIÓN</div>
                <div className="font-semibold text-slate-800">{cliente.direccion || '-'}</div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => abrirMapsConDireccion(cliente.direccion || '')}
                disabled={!cliente.direccion}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border hover:bg-slate-50 disabled:opacity-50"
                title="Abrir dirección en Google Maps"
              >
                <MapPin className="w-4 h-4 text-violet-700" />
                <span className="text-slate-800">Maps</span>
              </button>
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={agregarARuta}
            disabled={cargando || !clienteExiste}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            title={!clienteExiste ? 'Registra el cliente para poder agregar a ruta' : 'Agregar a Ruta'}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Agregar a Ruta</span>
          </button>

          <button
            onClick={limpiarFormulario}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800"
            disabled={cargando}
          >
            <X className="w-4 h-4" />
            <span>Limpiar</span>
          </button>

          <button
            onClick={marcarRetiradoCrearPedido}
            disabled={!seleccionado || cargando}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            title={!seleccionado ? 'Selecciona un cliente en la lista' : 'Crear pedido y marcar retirado'}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Retirado → Crear Pedido</span>
          </button>

          <button
            onClick={abrirModalEditarSeleccionado}
            disabled={!seleccionado || cargando}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-100 text-violet-800 hover:bg-violet-200 disabled:opacity-50"
          >
            <Pencil className="w-4 h-4" />
            <span>Editar Seleccionado</span>
          </button>

          <button
            onClick={() => seleccionado?.direccion && abrirMapsConDireccion(seleccionado.direccion)}
            disabled={!seleccionado?.direccion || cargando}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border hover:bg-slate-50 disabled:opacity-50"
            title="Abrir dirección del seleccionado en Maps"
          >
            <MapPin className="w-4 h-4 text-violet-700" />
            <span className="text-slate-800">Maps Seleccionado</span>
          </button>
        </div>

        {error && <div className="mb-3 text-sm text-red-600">Error: {error}</div>}
        {cargando && <div className="mb-3 text-sm text-slate-500">Procesando…</div>}

        {/* Lista */}
        <div className="overflow-auto rounded-lg border border-violet-200">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-violet-100 text-violet-800">
              <tr>
                <th className="px-2 py-2 text-left">TELÉFONO</th>
                <th className="px-2 py-2 text-left">NOMBRE</th>
                <th className="px-2 py-2 text-left">DIRECCIÓN</th>
                <th className="px-2 py-2 text-left">CREADO</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                    No hay retiros pendientes.
                  </td>
                </tr>
              ) : (
                lista.map((r) => {
                  const active = selId === r.id;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelId(r.id)}
                      className={`border-t cursor-pointer hover:bg-violet-50 ${
                        active ? 'bg-violet-50 ring-2 ring-violet-300' : ''
                      }`}
                    >
                      <td className="px-2 py-2 font-semibold text-violet-700">{r.telefono}</td>
                      <td className="px-2 py-2">{r.nombre || ''}</td>
                      <td className="px-2 py-2">{r.direccion || ''}</td>
                      <td className="px-2 py-2 text-slate-600">{(r.creado_en || '').slice(0, 10)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal cliente nuevo */}
      <Modal
        open={openNuevo}
        title="Cliente no existe - Registrar"
        onClose={() => setOpenNuevo(false)}
      >
        <div className="space-y-3">
          <div className="text-sm text-slate-700">
            Teléfono: <span className="font-semibold">{onlyDigitsPhone(telefono) || '-'}</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">NOMBRE</label>
            <input
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value.toUpperCase())}
              placeholder="Nombre"
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">DIRECCIÓN</label>
            <input
              value={nuevaDireccion}
              onChange={(e) => setNuevaDireccion(e.target.value.toUpperCase())}
              placeholder="Dirección"
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <button
            onClick={guardarClienteNuevo}
            disabled={cargando}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Guardar Cliente</span>
          </button>

          <div className="text-xs text-slate-500">
            Luego podrás presionar <b>“Agregar a Ruta”</b>.
          </div>
        </div>
      </Modal>

      {/* Modal editar seleccionado */}
      <Modal
        open={openEditar}
        title="Editar Cliente en Ruta"
        onClose={() => {
          setOpenEditar(false);
          setEditMode(false);
        }}
      >
        <div className="space-y-3">
          <div className="text-sm text-slate-700">
            Teléfono: <span className="font-semibold">{seleccionado?.telefono || '-'}</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">NOMBRE</label>
            <input
              value={editNombre}
              onChange={(e) => setEditNombre(e.target.value.toUpperCase())}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">DIRECCIÓN</label>
            <input
              value={editDireccion}
              onChange={(e) => setEditDireccion(e.target.value.toUpperCase())}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <button
            onClick={guardarEdicionSeleccionado}
            disabled={cargando || !seleccionado}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Pencil className="w-4 h-4" />
            <span>Guardar Cambios</span>
          </button>
        </div>
      </Modal>
    </main>
  );
}
