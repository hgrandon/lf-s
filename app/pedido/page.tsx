// app/pedido/page.tsx
'use client';

import { useState } from 'react';
import HeaderPedido, {
  type Cliente as ClienteHeader,
  type NextNumber,
} from './components/HeaderPedido';
import DetallePedido, {
  Item,
  type Cliente as ClienteDetalle,
} from './components/DetallePedido';
import ArticulosSelect from './components/ArticulosSelect';

export default function PedidoPage() {
  // Cliente que viene del Header (puede traer nombre/dirección null)
  const [clienteHdr, setClienteHdr] = useState<ClienteHeader | null>(null);
  const [nroInfo, setNroInfo] = useState<NextNumber | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  // Adaptar al tipo de DetallePedido (strings no nulos) y nunca undefined
  const clienteDet: ClienteDetalle | null = clienteHdr
    ? {
        telefono: clienteHdr.telefono,
        nombre: clienteHdr.nombre ?? '',
        direccion: clienteHdr.direccion ?? '',
      }
    : null;

  // Recibe { articulo, precio, cantidad } del combo
  const handleAddItem = (payload: { articulo: string; precio: number; cantidad: number }) => {
    const incoming: Item = {
      articulo: payload.articulo,
      qty: Math.max(0, Number(payload.cantidad || 0)),
      valor: Number(payload.precio || 0),
      subtotal: Math.max(0, Number(payload.cantidad || 0)) * Number(payload.precio || 0),
      estado: 'LAVAR',
    };

    setItems((prev) => {
      const i = prev.findIndex((x) => x.articulo === incoming.articulo && x.valor === incoming.valor);
      if (i >= 0) {
        const next = [...prev];
        const newQty = next[i].qty + incoming.qty;
        next[i] = { ...next[i], qty: newQty, subtotal: newQty * next[i].valor };
        return next;
      }
      return [...prev, incoming];
    });
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* Cabecera: N°, fechas, teléfono y cliente */}
      <HeaderPedido
        onCliente={setClienteHdr}
        onNroInfo={setNroInfo}
      />

      {/* Contenido */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 mt-6">
        <div className="rounded-2xl bg-white text-slate-900 p-4 sm:p-5 shadow-[0_10px_30px_rgba(0,0,0,.20)]">
          {/* Combo + Modal (interno) */}
          <ArticulosSelect onAddItem={handleAddItem} />

          {/* Detalle / Total / Guardar */}
          <DetallePedido
            cliente={clienteDet}
            nroInfo={nroInfo}
            items={items}
            onRemoveItem={handleRemoveItem}
          />
        </div>
      </section>
    </main>
  );
}
