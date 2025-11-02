'use client';

import { useState } from 'react';
import HeaderPedido, { Cliente, NextNumber } from './components/HeaderPedido';
import ArticulosSelect, { Articulo } from './components/ArticulosSelect';
import DetallePedido, { Item } from './components/DetallePedido';

export default function PedidoPage() {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [nroInfo, setNroInfo] = useState<NextNumber | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  // Añadir un artículo desde el combo (si ya existe, suma cantidad)
  const handleAddArticulo = (a: Articulo) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.articulo === a.nombre && x.valor === a.valor);
      if (i >= 0) {
        const next = [...prev];
        const qty = next[i].qty + 1;
        next[i] = { ...next[i], qty, subtotal: qty * next[i].valor };
        return next;
      }
      return [...prev, { articulo: a.nombre, qty: 1, valor: a.valor, subtotal: a.valor, estado: 'LAVAR' }];
    });
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* 1) Cabecera: N°, fechas, teléfono y cliente */}
      <HeaderPedido onCliente={(c) => setCliente(c)} onNroInfo={(n) => setNroInfo(n)} />

      {/* 2) Combo de artículos */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 mt-6">
        <div className="rounded-2xl bg-white text-slate-900 p-4 sm:p-5 shadow-[0_10px_30px_rgba(0,0,0,.20)]">
          <ArticulosSelect onAddArticulo={handleAddArticulo} />
          {/* 3) Detalle / Total / Guardar */}
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
