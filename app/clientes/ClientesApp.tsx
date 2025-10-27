// app/clientes/ClientesApp.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ChevronRight, ChevronDown, Plus, Search, UserRound } from 'lucide-react';

type Cliente = { telefono: string; nombre: string; direccion: string };
type Pedido  = { nro: number; fecha: string; total: number; estado_pago?: string; tipo_entrega?: string };

const CLP = new Intl.NumberFormat('es-CL');

export default function ClientesApp() {
  // UI state
  const [buscar, setBuscar] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // teléfonos expandidos
  const [pedidosPorTel, setPedidosPorTel] = useState<Record<string, Pedido[]>>({});
  const [loading, setLoading] = useState(false);

  // Acordeón: nuevo cliente
  const [showCrear, setShowCrear] = useState(false);
  const [nuevoTel, setNuevoTel] = useState('');
  const [nuevoNom, setNuevoNom] = useState('');
  const [nuevoDir, setNuevoDir] = useState('');
  const [creating, setCreating] = useState(false);

  // ---- Cargar clientes (con búsqueda simple por nombre o teléfono) ----
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const term = buscar.trim();
        let q = supabase
          .from('cliente')
          .select('telefono,nombre,direccion')
          .order('nombre', { ascending: true })
          .limit(100);

        if (term) {
          q = q.or(`nombre.ilike.%${term}%,telefono.ilike.%${term.replace(/\D+/g, '')}%`);
        }
        const { data, error } = await q;
        if (error) throw error;
        if (!cancel) setClientes((data || []) as Cliente[]);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [buscar]);

  // ---- Cargar pedidos de un cliente si no los tengo aún ----
  async function loadPedidos(telefono: string) {
    if (pedidosPorTel[telefono]) return; // cache simple
    const { data, error } = await supabase
      .from('pedido')
      .select('nro,fecha,total,estado_pago,tipo_entrega')
      .eq('telefono', telefono)
      .order('nro', { ascending: false })
      .limit(30);
    if (!error) {
      setPedidosPorTel(prev => ({ ...prev, [telefono]: (data || []) as Pedido[] }));
    }
  }

  function toggleExpand(telefono: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(telefono)) next.delete(telefono);
      else next.add(telefono);
      return next;
    });
    // carga diferida
    loadPedidos(telefono).catch(console.error);
  }

  // ---- Crear cliente (acordeón superior) ----
  async function crearCliente() {
    const tel = nuevoTel.replace(/\D+/g, '').slice(0, 9);
    const nom = nuevoNom.trim().toUpperCase();
    const dir = nuevoDir.trim();
    if (!tel || tel.length < 7 || !nom) return;

    setCreating(true);
    try {
      const { error } = await supabase.from('cliente').insert({ telefono: tel, nombre: nom, direccion: dir });
      if (error) throw error;

      // limpia y recarga
      setNuevoTel(''); setNuevoNom(''); setNuevoDir('');
      setShowCrear(false);

      const { data } = await supabase
        .from('cliente')
        .select('telefono,nombre,direccion')
        .order('nombre', { ascending: true })
        .limit(100);
      setClientes((data || []) as Cliente[]);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  }

  const lista = useMemo(() => clientes, [clientes]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 p-3">
      <div className="mx-auto w-full max-w-md">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between text-white">
          <h1 className="text-xl font-bold">Clientes</h1>
        </div>

        {/* Acordeón: crear cliente */}
        <div className="mb-3 rounded-2xl bg-white/10 p-3 text-white shadow">
          <button
            onClick={() => setShowCrear(v => !v)}
            className="flex w-full items-center justify-between"
          >
            <span className="flex items-center gap-2 font-semibold">
              <Plus size={18} /> Agregar cliente
            </span>
            {showCrear ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>

          {showCrear && (
            <div className="mt-3 grid gap-2">
              <input
                placeholder="Teléfono"
                value={nuevoTel}
                onChange={(e) => setNuevoTel(e.target.value)}
                className="rounded-lg border border-white/30 bg-white/90 px-3 py-2 text-violet-800 outline-none"
              />
              <input
                placeholder="Nombre"
                value={nuevoNom}
                onChange={(e) => setNuevoNom(e.target.value)}
                className="rounded-lg border border-white/30 bg-white/90 px-3 py-2 text-violet-800 outline-none"
              />
              <input
                placeholder="Dirección"
                value={nuevoDir}
                onChange={(e) => setNuevoDir(e.target.value)}
                className="rounded-lg border border-white/30 bg-white/90 px-3 py-2 text-violet-800 outline-none"
              />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={crearCliente}
                  disabled={creating}
                  className="flex-1 rounded-lg bg-white px-4 py-2 font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-60"
                >
                  {creating ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  onClick={() => { setShowCrear(false); }}
                  className="rounded-lg bg-white/20 px-4 py-2 font-semibold text-white hover:bg-white/30"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Buscador */}
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-white p-2 text-violet-700 shadow">
          <Search size={18} />
          <input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar clientes…"
            className="w-full bg-transparent px-1 py-1 outline-none"
          />
        </div>

        {/* Lista de clientes + histórico (expandible) */}
        <div className="overflow-hidden rounded-2xl bg-white shadow">
          {loading && (
            <div className="p-4 text-center text-sm text-gray-500">Cargando…</div>
          )}

          {!loading && !lista.length && (
            <div className="p-6 text-center text-sm text-gray-500">
              Sin resultados.
            </div>
          )}

          {lista.map((c) => {
            const isOpen = expanded.has(c.telefono);
            const pedidos = pedidosPorTel[c.telefono] || [];

            return (
              <div key={c.telefono} className="border-b last:border-0">
                <button
                  onClick={() => toggleExpand(c.telefono)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-gray-50"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-violet-100 text-violet-700">
                    <UserRound size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-gray-900">{c.nombre}</div>
                    <div className="truncate text-xs text-gray-600">+56 {c.telefono}</div>
                    <div className="truncate text-xs text-gray-600">{c.direccion}</div>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="text-gray-400" size={18} />
                  ) : (
                    <ChevronRight className="text-gray-400" size={18} />
                  )}
                </button>

                {/* Histórico de pedidos */}
                {isOpen && (
                  <div className="bg-gray-50 px-3 pb-3">
                    {pedidos.length ? (
                      <ul className="divide-y rounded-lg border bg-white">
                        {pedidos.map((p) => (
                          <li key={p.nro} className="flex items-center justify-between px-3 py-2">
                            <div>
                              <div className="font-medium text-gray-900">Pedido #{p.nro}</div>
                              <div className="text-xs text-gray-600">
                                {new Date(p.fecha).toLocaleDateString('es-CL')} · {p.tipo_entrega || 'LOCAL'} · {p.estado_pago || 'PENDIENTE'}
                              </div>
                            </div>
                            <div className="font-semibold">{CLP.format(p.total)}</div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="rounded-lg border bg-white px-3 py-3 text-center text-sm text-gray-500">
                        Sin pedidos aún.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

