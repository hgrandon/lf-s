// app/pedido/page.tsx
'use client';

import { useState } from 'react';
import HeaderPedido, { Cliente, NextNumber } from './components/HeaderPedido';
import ArticulosSelect, { AddItemPayload } from './components/ArticulosSelect';
import DetallePedido, { Item } from './components/DetallePedido';

export default function PedidoPage() {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [nroInfo, setNroInfo] = useState<NextNumber | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  // Recibe un item desde el combo (precio/cantidad pueden ser 0)
  const handleAddItem = ({ articulo, precio, cantidad }: AddItemPayload) => {
    const valor = Number(precio || 0);
    const qty = Number(cantidad || 0);

    // Si llega cantidad 0, no agregamos nada
    if (qty === 0) return;

    setItems((prev) => {
      const idx = prev.findIndex((x) => x.articulo === articulo && x.valor === valor);
      if (idx >= 0) {
        const next = [...prev];
        const newQty = next[idx].qty + qty;
        next[idx] = {
          ...next[idx],
          qty: newQty,
          subtotal: newQty * next[idx].valor,
        };
        return next;
      }
      const nuevo: Item = {
        articulo,
        qty,
        valor,
        subtotal: valor * qty,
        estado: 'LAVAR',
      };
      return [...prev, nuevo];
    });
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* Cabecera: N°, fechas, teléfono y cliente */}
      <HeaderPedido onCliente={setCliente} onNroInfo={setNroInfo} />

      {/* Contenido */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 mt-6">
        <div className="rounded-2xl bg-white text-slate-900 p-4 sm:p-5 shadow-[0_10px_30px_rgba(0,0,0,.20)]">
          {/* Combo + Modal (interno) */}
          <ArticulosSelect onAddItem={handleAddItem} />

          {/* Detalle / Total / Guardar */}
          <DetallePedido
            cliente={cliente}
            nroInfo={nroInfo}
            items={items}
            onRemoveItem={handleRemoveItem}
          />
        </div>
      </section>
    </main>
  );
}
