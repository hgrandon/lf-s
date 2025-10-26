'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Save } from 'lucide-react';
import NewArticleModal from '@/app/components/NewArticleModal';

type NextNumber = { nro: number; fecha: string; entrega: string };
type Articulo   = { id: number; nombre: string; precio: number };
type Linea      = { articulo_id: number; nombre: string; precio: number; qty: number };

/** Normaliza a 9 dígitos (solo números) */
const normalizePhone = (v: string) => (v || '').replace(/\D+/g, '').slice(0, 9);

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

  // Fotos (paths subidos)
  const [fotos, setFotos] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const CLP = new Intl.NumberFormat('es-CL');

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

  // 2) Cargar artículos: primero RPC, fallback a tabla "articulo"
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

  // 3) Debounce para consulta del cliente (RPC)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onPhoneChange = (raw: string) => {
    const digits = normalizePhone(raw);
    setTelefono(digits);
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

  // 4) Buscar cliente por teléfono (MISMO ESQUEMA QUE CLIENTES)
  const checkClient = async (tel: string) => {
    try {
      setMsg('Buscando cliente...');
      const norm = normalizePhone(tel);
      if (norm.length !== 9) return;

      // Usa el mismo RPC de clientes
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

  // 5) Guardar cliente rápido (MISMO RPC clientes_upsert)
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

  // 6) Agregar artículo (incluye “Nuevo artículo…”)
  const [showNewArt, setShowNewArt] = useState(false);

  const addArticulo = () => {
    if (!selectedId) return;
    if (selectedId === '__new__') {
      setShowNewArt(true);
      return;
    }
    const art = articulos.find((a) => a.id === Number(selectedId));
    if (!art) return;

    setLineas((prev) => {
      const idx = prev.findIndex((l) => l.articulo_id === art.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { articulo_id: art.id, nombre: art.nombre, precio: art.precio, qty: 1 }];
    });
    setSelectedId('');
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

  // 7) Subir fotos
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

  // 8) Guardar pedido vía RPC
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
      }));

      const { error } = await supabase.rpc('pedido_upsert', {
        p_pedido,
        p_lineas,
        p_fotos: fotos,
      });

      if (error) throw error;
      setMsg('✅ Pedido guardado');
      // router.push('/menu')
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  // 9) Alta + agregar artículo desde el modal
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
      const created = data as Articulo;

      setArticulos((prev) => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setLineas((prev) => [
        ...prev,
        { articulo_id: created.id, nombre: created.nombre, precio: created.precio, qty },
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

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />

      <div className="relative z-10 mx-auto w-full max-w-4xl p-4 sm:p-6">
        {/* Encabezado */}
        <header className="mb-4 flex items-center justify-between">
          <div className="text-white">
            <div className="text-lg sm:text-xl">
              N° <span className="font-bold">{nro ?? '...'}</span>
            </div>
            <div className="text-sm text-white/80">
              {fecha && new Date(fecha).toLocaleDateString()} &nbsp;→&nbsp;{' '}
              {entrega && new Date(entrega).toLocaleDateString()}
            </div>
          </div>

          <div className="flex gap-2">
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
        </header>

        {/* Tarjeta principal */}
        <div className="rounded-xl bg-white p-4 shadow">
          {/* Teléfono */}
          <div className="mb-3">
            <label className="mb-1 block text-xs text-gray-500">TELÉFONO</label>
            <input
              ref={phoneInputRef}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="EJ: 998877665"
              value={telefono}
              onChange={(e) => onPhoneChange(e.target.value)}
              onKeyDown={forceCheckOnEnter}
              className="w-full rounded border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-purple-500"
            />
            {/* Nombre/Dirección autocompletados (solo lectura) */}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                placeholder="NOMBRE (auto)"
                value={clienteNombre}
                readOnly
                className="rounded border bg-gray-100 px-3 py-2 text-gray-700"
              />
              <input
                placeholder="DIRECCIÓN (auto)"
                value={clienteDireccion}
                readOnly
                className="rounded border bg-gray-100 px-3 py-2 text-gray-700"
              />
            </div>
          </div>

          {/* Select artículos */}
          <div className="mb-3 flex gap-2">
            <select
              value={selectedId || ''}
              onChange={(e) => {
                const v = e.target.value === '__new__' ? '__new__' : (Number(e.target.value) as any);
                setSelectedId(v);
              }}
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

          {/* Detalle */}
          {!!lineas.length && (
            <div className="mb-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="text-gray-500">
                  <tr>
                    <th className="border-b py-1 text-left">Artículo</th>
                    <th className="w-24 border-b py-1">Precio</th>
                    <th className="w-36 border-b py-1">Cantidad</th>
                    <th className="w-24 border-b py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => (
                    <tr key={l.articulo_id}>
                      <td className="border-b py-2">{l.nombre}</td>
                      <td className="border-b py-2 text-right">{CLP.format(l.precio)}</td>
                      <td className="border-b py-2">
                        <div className="flex items-center gap-2">
                          <button onClick={() => changeQty(l.articulo_id, -1)} className="rounded border px-2">
                            -
                          </button>
                          <span className="w-8 text-center">{l.qty}</span>
                          <button onClick={() => changeQty(l.articulo_id, +1)} className="rounded border px-2">
                            +
                          </button>
                        </div>
                      </td>
                      <td className="border-b py-2 text-right">
                        <button onClick={() => removeLinea(l.articulo_id)} className="rounded border px-2 text-red-600">
                          X
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Total */}
          <div className="mb-3 rounded bg-purple-50 px-3 py-2 text-purple-900">
            <span className="font-semibold">Total:&nbsp;</span>
            <span className="text-lg font-bold">{CLP.format(total)}</span>
          </div>

          {/* Fotos */}
          <div className="mb-2">
            <label className="mb-1 block text-xs text-gray-500">FOTOS (opcional)</label>
            <input type="file" multiple onChange={(e) => onFiles(e.target.files)} />
            {!!fotos.length && (
              <div className="mt-1 text-xs text-gray-600">{fotos.length} archivo(s) seleccionado(s)</div>
            )}
          </div>

          {/* Mensajes */}
          {msg && <div className="mt-3 text-sm text-gray-700">{msg}</div>}
        </div>
      </div>

      {/* Modal: nuevo cliente (usa RPC clientes_upsert) */}
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






