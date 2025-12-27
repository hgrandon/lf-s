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

export default function RutaPage() {
  const router = useRouter();

  const [telefono, setTelefono] = useState('');
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');

  const [clienteExiste, setClienteExiste] = useState(false);
  const [checkingCliente, setCheckingCliente] = useState(false);

  const [lista, setLista] = useState<RutaDB[]>([]);
  const [selId, setSelId] = useState<number | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const seleccionado = useMemo(
    () => lista.find((x) => x.id === selId) ?? null,
    [lista, selId]
  );

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

  // Buscar cliente por teléfono
  useEffect(() => {
    const t = onlyDigitsPhone(telefono);
    if (!t || t.length < 6) {
      setClienteExiste(false);
      return;
    }

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
          setNombre(String(data.nombre || ''));
          setDireccion(String(data.direccion || ''));
        } else {
          setClienteExiste(false);
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
    setNombre('');
    setDireccion('');
    setClienteExiste(false);
    setEditMode(false);
    setSelId(null);
    setError(null);
  }

  async function asegurarCliente(telefonoDigits: string) {
    const payload = {
      telefono: telefonoDigits,
      nombre: (nombre || '').toUpperCase(),
      direccion: (direccion || '').toUpperCase(),
    };
    const { error: e } = await supabase
      .from('clientes')
      .upsert(payload, { onConflict: 'telefono' });
    if (e) throw e;
  }

  async function agregarARuta() {
    const tel = onlyDigitsPhone(telefono);
    if (!tel) return alert('Ingresa un teléfono válido.');
    if (!nombre.trim()) return alert('Ingresa el nombre.');
    if (!direccion.trim()) return alert('Ingresa la dirección.');

    setCargando(true);
    setError(null);
    try {
      await asegurarCliente(tel);

      const creado_por = readDisplay();

      const { error: eIns } = await supabase.from('ruta_retiro').insert({
        telefono: tel,
        nombre: (nombre || '').toUpperCase(),
        direccion: (direccion || '').toUpperCase(),
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

  function cargarSeleccionadoParaEditar() {
    if (!seleccionado) return;
    setTelefono(seleccionado.telefono);
    setNombre(seleccionado.nombre || '');
    setDireccion(seleccionado.direccion || '');
    setEditMode(true);
  }

  async function guardarEdicion() {
    if (!seleccionado) return;

    const tel = onlyDigitsPhone(telefono);
    if (!tel) return alert('Teléfono inválido.');
    if (!nombre.trim() || !direccion.trim())
      return alert('Nombre y dirección son obligatorios.');

    setCargando(true);
    setError(null);
    try {
      await asegurarCliente(tel);

      const { error: eUp } = await supabase
        .from('ruta_retiro')
        .update({
          telefono: tel,
          nombre: (nombre || '').toUpperCase(),
          direccion: (direccion || '').toUpperCase(),
        })
        .eq('id', seleccionado.id);

      if (eUp) throw eUp;

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

      // 4) abrir editor (ajusta si tu editor es otra ruta)
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
              <div className="text-xs text-slate-500">
                Agrega clientes a retirar y conviértelos en pedido al marcar RETIRADO.
              </div>
            </div>
          </div>

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

        {/* Formulario */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
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
                : 'Cliente nuevo'}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">NOMBRE</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value.toUpperCase())}
              placeholder="Nombre cliente"
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">DIRECCIÓN</label>
            <input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value.toUpperCase())}
              placeholder="Dirección"
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {!editMode ? (
            <button
              onClick={agregarARuta}
              disabled={cargando}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Agregar a Ruta</span>
            </button>
          ) : (
            <button
              onClick={guardarEdicion}
              disabled={cargando || !seleccionado}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Pencil className="w-4 h-4" />
              <span>Guardar Edición</span>
            </button>
          )}

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
            onClick={cargarSeleccionadoParaEditar}
            disabled={!seleccionado || cargando}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-100 text-violet-800 hover:bg-violet-200 disabled:opacity-50"
          >
            <Pencil className="w-4 h-4" />
            <span>Editar Seleccionado</span>
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

        <div className="mt-3 text-xs text-slate-500">
          Tip: Selecciona un cliente en la lista → “Editar Seleccionado” o “Retirado → Crear Pedido”.
        </div>
      </div>
    </main>
  );
}
