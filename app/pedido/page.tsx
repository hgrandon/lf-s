'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Save, Phone, UserRound } from 'lucide-react';
import NewArticleModal from '@/app/components/NewArticleModal';

type NextNumber = { nro: number; fecha: string; entrega: string };
type Articulo   = { id: number; nombre: string; precio: number };
type Linea      = { articulo_id: number; nombre: string; precio: number; qty: number; estado: 'LAVAR' };

const normalizePhone = (v: string) => (v || '').replace(/\D+/g, '').slice(0, 9);
const CLP = new Intl.NumberFormat('es-CL');

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        {children}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PedidoPage() {
  const router = useRouter();

  // Cabecera
  const [nro, setNro] = useState<number | null>(null);
  const [fecha, setFecha] = useState('');
  const [entrega, setEntrega] = useState('');

  // Cliente
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const [telefono, setTelefono] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');

  // Artículos
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [selectedId, setSelectedId] = useState<number | '__new__' | ''>('');

  // Líneas
  const [lineas, setLineas] = useState<Linea[]>([]);

  // Fotos
  const [fotos, setFotos] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const total = useMemo(
    () => lineas.reduce((acc, l) => acc + l.precio * l.qty, 0),
    [lineas]
  );

  // 1) Cargar correlativo y fechas
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('pedido_next_number');
      if (error) {
        setMsg('Error al cargar correlativo: ' + error.message);
        return;
      }
      const row = (data as NextNumber[])[0];
      setNro(row.nro);
      setFecha(row.fecha);
      setEntrega(row.entrega);
      setTimeout(() => phoneInputRef.current?.focus(), 0);
    })();
  }, []);

  // 2) Cargar artículos
  useEffect(() => {
    (async () => {
      setMsg('');
      const rpc = await supabase.rpc('active_articles_list');
      if (!rpc.error && rpc.data) {
        setArticulos(rpc.data as Articulo[]);
        return;
      }
      const { data, error } = await supabase
        .from('articulo')
        .select('id,nombre,precio')
        .eq('activo', true)
        .order('nombre', { ascending: true });
      if (error) {
        setMsg(
          'Error al cargar artículos: ' +
            (rpc.error ? rpc.error.message + ' / ' : '') +
            error.message
        );
        return;
      }
      setArticulos((data || []) as Articulo[]);
    })();
  }, []);

  // 3) Buscar cliente por teléfono (debounce)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onPhoneChange = (raw: string) => {
    const digits = normalizePhone(raw);
    setTelefono(digits);
    // limpiar UI de cliente al tipear:
    setClienteNombre('');
    setClienteDireccion('');
    setShowNewClient(false);
    setMsg('');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (digits.length === 9) {
      debounceRef.current = setTimeout(() => {
        checkClient(digits);
      }, 300);
    }
  };

  const forceCheckOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const digits = normalizePhone(telefono);
      if (digits.length === 9) checkClient(digits);
    }
  };

  const checkClient = async (tel: string) => {
    try {
      setMsg('Buscando cliente...');
      const norm = normalizePhone(tel);
      if (norm.length !== 9) return;

      const { data, error } = await supabase.rpc('clientes_get_by_tel', {
        p_telefono: norm,
      });

      if (error) {
        setMsg('Error buscando cliente: ' + error.message);
        setClienteNombre('');
        setClienteDireccion('');
        setShowNewClient(false);
        return;
      }

      const cli = (data as { telefono: string; nombre: string; direccion: string }[] | null)?.[0];

      if (cli) {
        setClienteNombre(cli.nombre || '');
        setClienteDireccion(cli.direccion || '');
        setShowNewClient(false);
        setNewName('');
        setNewAddress('');
        setMsg('✅ Cliente reconocido');
      } else {
        // No existe: abrir modal inmediatamente
        setClienteNombre('');
        setClienteDireccion('');
        setNewName('');
        setNewAddress('');
        setShowNewClient(true);
        setMsg('⚠️ Teléfono no existe. Completa los datos para registrarlo.');
      }
    } catch (e: any) {
      setMsg('Error buscando cliente: ' + (e?.message ?? e));
    }
  };

  const saveNewClient = async () => {
    const norm = normalizePhone(telefono);
    if (norm.length !== 9) {
      setMsg('Teléfono inválido para crear cliente.');
      return;
    }
    if (!newName.trim()) {
      setMsg('Ingresa el nombre del cliente.');
      return;
    }
    setLoading(true);
    setMsg('Guardando cliente...');
    try {
      const { error } = await supabase.rpc('clientes_upsert', {
        p_telefono: norm,
        p_nombre: newName.trim().toUpperCase(),
        p_direccion: (newAddress || '').trim().toUpperCase(),
      });
      if (error) throw error;

      setClienteNombre(newName.trim().toUpperCase());
      setClienteDireccion((newAddress || '').trim().toUpperCase());
      setShowNewClient(false);
      setMsg('✅ Cliente guardado.');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  // 4) Agregar artículo + grilla
  const [showNewArt, setShowNewArt] = useState(false);

  const addArticulo = () => {
    if (!selectedId) return;
    if (selectedId === '__new__') {
      setShowNewArt(true);
      return;
    }
    const artId = Number(selectedId);
    const art = articulos.find((a) => a.id === artId);
    if (!art) return;

    setLineas((prev) => {
      const idx = prev.findIndex((l) => l.articulo_id === artId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [
        ...prev,
        { articulo_id: art.id, nombre: art.nombre, precio: art.precio, qty: 1, estado: 'LAVAR' },
      ];
    });
    setSelectedId('');
  };

  const onSelectArticulo = (v: string) => {
    const val = v === '__new__' ? '__new__' : (Number(v) as any);
    setSelectedId(val);
    if (v && v !== '__new__') setTimeout(addArticulo, 0); // autoagregar
  };

  const changeQty = (id: number, delta: number) => {
    setLineas((prev) =>
      prev.map((l) =>
        l.articulo_id === id ? { ...l, qty: Math.max(1, l.qty + delta) } : l
      )
    );
  };

  const removeLinea = (id: number) => {
    setLineas((prev) => prev.filter((l) => l.articulo_id !== id));
  };

  // 5) Subir fotos
  const onFiles = async (files: FileList | null) => {
    if (!files || !nro) return;
    setLoading(true);
    try {
      const up = Array.from(files);
      const uploaded: string[] = [];
      for (const file of up) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${nro}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from('pedido_fotos')
          .upload(path, file, {
            upsert: false,
            contentType: file.type || 'image/jpeg',
          });
        if (error) throw error;
        uploaded.push(path);
      }
      setFotos((prev) => [...prev, ...uploaded]);
      setMsg(`📷 ${uploaded.length} foto(s) subida(s).`);
    } catch (e: any) {
      setMsg('Error al subir fotos: ' + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  // 6) Guardar pedido
  const save = async () => {
    if (!nro) return;
    const norm = normalizePhone(telefono);
    if (norm.length !== 9) {
      setMsg('Ingresa un teléfono válido (9 dígitos).');
      phoneInputRef.current?.focus();
      return;
    }
    if (!clienteNombre.trim()) {
      setMsg('Primero registra o reconoce al cliente.');
      return;
    }
    if (lineas.length === 0) {
      setMsg('Agrega al menos un artículo.');
      return;
    }
    setLoading(true);
    setMsg('Guardando pedido...');
    try {
      const p_pedido = { nro, fecha, entrega, telefono: norm, total };
      const p_lineas = lineas.map((l) => ({
        articulo_id: l.articulo_id,
        nombre: l.nombre,
        precio: l.precio,
        qty: l.qty,
        estado: l.estado,
      }));

      const { error } = await supabase.rpc('pedido_upsert', {
        p_pedido,
        p_lineas,
        p_fotos: fotos,
      });

      if (error) throw error;
      setMsg('✅ Pedido guardado');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  // 7) Alta + agregar artículo desde el modal
  const handleCreateArticle = async ({
    nombre,
    precio,
    qty,
  }: {
    nombre: string;
    precio: number;
    qty: number;
  }) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('articulo')
        .insert({ nombre, precio, activo: true })
        .select('id,nombre,precio')
        .single();
      if (error) throw error;
      const created = (data as Articulo);

      setArticulos((prev) => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setLineas((prev) => [
        ...prev,
        { articulo_id: created.id, nombre: created.nombre, precio: created.precio, qty, estado: 'LAVAR' },
      ]);

      setSelectedId('');
      setShowNewArt(false);
      setMsg('✅ Artículo creado y agregado.');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const clienteReconocido = !!clienteNombre;

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />

      <div className="relative z-10 mx-auto w-full max-w-md sm:max-w-3xl p-4 sm:p-6">
        {/* Encabezado */}
        <div className="mb-3 flex items-center justify-between text-white">
          <div className="text-2xl sm:text-3xl font-extrabold">N° {nro ?? '...'}</div>
          <div className="flex items-start gap-3">
            <div className="text-right text-white/90 text-xs sm:text-sm leading-5">
              <div>{fecha && new Date(fecha).toLocaleDateString()}</div>
              <div>{entrega && new Date(entrega).toLocaleDateString()}</div>
              {clienteNombre && <div className="text-white font-semibold">{clienteNombre}</div>}
              {clienteDireccion && <div>{clienteDireccion}</div>}
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => router.push('/menu')}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow hover:bg-white"
                title="Volver"
              >
                <ArrowLeft className="text-violet-700" size={18} />
              </button>
              <button
                disabled={loading}
                onClick={save}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow hover:bg-white disabled:opacity-60"
                title="Guardar"
              >
                <Save className="text-violet-700" size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Tarjeta principal */}
        <div className="rounded-xl bg-white p-4 shadow">
          {/* Teléfono */}
          <div className="mb-3">
            <label className="mb-1 block text-sm text-gray-700 font-semibold">Teléfono del Cliente</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60">
                <Phone size={16} />
              </span>
              <input
                ref={phoneInputRef}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="555-123-4567"
                value={telefono}
                onChange={(e) => onPhoneChange(e.target.value)}
                onKeyDown={forceCheckOnEnter}
                disabled={clienteReconocido}
                className={`w-full rounded-lg border px-9 py-2 text-base outline-none focus:ring-2 focus:ring-purple-500 ${
                  clienteReconocido ? 'bg-gray-100 text-gray-700' : ''
                }`}
              />
            </div>
          </div>

          {/* Tarjeta Cliente (solo si existe) */}
          {clienteReconocido && (
            <div className="mb-4 rounded-xl border bg-white shadow-sm">
              <div className="flex items-center justify-between p-3">
                <div>
                  <div className="text-xs text-gray-500">Cliente</div>
                  <div className="text-base font-semibold text-gray-900">{clienteNombre}</div>
                  <div className="text-sm text-gray-600">{clienteDireccion}</div>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-full bg-purple-50 text-purple-700">
                  <UserRound size={18} />
                </div>
              </div>
            </div>
          )}

          {/* Contenido de pedido solo si hay cliente */}
          {clienteReconocido && (
            <>
              {/* Select artículos */}
              <div className="mb-3 flex gap-2">
                <select
                  value={selectedId || ''}
                  onChange={(e) => onSelectArticulo(e.target.value)}
                  className="w-full rounded border px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">SELECCIONE UN ARTÍCULO</option>
                  {articulos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} — {CLP.format(a.precio)}
                    </option>
                  ))}
                  <option value="__new__">➕ Nuevo artículo…</option>
                </select>
                <button
                  onClick={addArticulo}
                  className="rounded bg-purple-600 px-3 py-2 font-semibold text-white hover:bg-purple-700"
                >
                  Añadir
                </button>
              </div>

              {/* Grilla */}
              {!!lineas.length && (
                <div className="mb-3 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-purple-100 text-purple-900">
                        <th className="border px-2 py-1 text-left">Artículo</th>
                        <th className="border px-2 py-1 w-24 text-center">Cantidad</th>
                        <th className="border px-2 py-1 w-24 text-right">Valor</th>
                        <th className="border px-2 py-1 w-28 text-right">Subtotal</th>
                        <th className="border px-2 py-1 w-24 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineas.map((l) => (
                        <tr key={l.articulo_id} className="align-middle">
                          <td className="border px-2 py-1">{l.nombre}</td>
                          <td className="border px-2 py-1">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => changeQty(l.articulo_id, -1)} className="rounded border px-2">-</button>
                              <span className="w-6 text-center">{l.qty}</span>
                              <button onClick={() => changeQty(l.articulo_id, +1)} className="rounded border px-2">+</button>
                            </div>
                          </td>
                          <td className="border px-2 py-1 text-right">{CLP.format(l.precio)}</td>
                          <td className="border px-2 py-1 text-right font-semibold">
                            {CLP.format(l.precio * l.qty)}
                          </td>
                          <td className="border px-2 py-1 text-center">
                            <span className="rounded bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                              {l.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Total */}
              <div className="mb-3 rounded bg-purple-100 px-3 py-2 text-purple-900">
                <span className="font-semibold">Total:&nbsp;</span>
                <span className="text-xl font-extrabold">{CLP.format(total)}</span>
              </div>

              {/* Fotos */}
              <div className="mb-2">
                <label className="mb-1 block text-xs text-gray-500">FOTOS (opcional)</label>
                <input type="file" multiple onChange={(e) => onFiles(e.target.files)} />
                {!!fotos.length && (
                  <div className="mt-1 text-xs text-gray-600">{fotos.length} archivo(s) seleccionado(s)</div>
                )}
              </div>
            </>
          )}

          {/* Mensajes */}
          {msg && <div className="mt-3 text-sm text-gray-700">{msg}</div>}
        </div>
      </div>

      {/* Modal: nuevo cliente */}
      <Modal open={showNewClient} onClose={() => setShowNewClient(false)}>
        <h3 className="mb-3 text-lg font-semibold text-gray-800">Nuevo Cliente</h3>
        <div className="grid gap-3">
          <input disabled value={telefono} className="w-full rounded border bg-gray-100 px-3 py-2 text-gray-600" />
          <input
            placeholder="NOMBRE DEL CLIENTE"
            value={newName}
            onChange={(e) => setNewName(e.target.value.toUpperCase())}
            className="w-full rounded border px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            placeholder="DIRECCIÓN DEL CLIENTE"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value.toUpperCase())}
            className="w-full rounded border px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setShowNewClient(false)}
            className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={saveNewClient}
            disabled={loading}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </Modal>

      {/* Modal: nuevo artículo */}
      <NewArticleModal
        open={showNewArt}
        onClose={() => setShowNewArt(false)}
        onCreate={handleCreateArticle}
      />
    </main>
  );
}








