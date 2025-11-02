// app/pedido/page.tsx
'use client';

import { useState } from 'react';
import HeaderPedido, { Cliente, NextNumber } from './components/HeaderPedido';
import ArticulosSelect, { ArticuloLite } from './components/ArticulosSelect';
import AddItemModal from './components/AddItemModal';
import DetallePedido, { Item } from './components/DetallePedido';

export default function PedidoPage() {
  // Cabecera (cliente + correlativo/fechas)
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [nroInfo, setNroInfo] = useState<NextNumber | null>(null);

  // Detalle
  const [items, setItems] = useState<Item[]>([]);

  // Modal "Agregar Detalle"
  const [addOpen, setAddOpen] = useState(false);
  const [selArticulo, setSelArticulo] = useState<ArticuloLite | null>(null);

  /** Abre el modal cuando el usuario elige un artículo del combo */
  const handleSelectArticulo = (a: ArticuloLite) => {
    setSelArticulo(a);
    setAddOpen(true);
  };

  /** Confirma desde el modal: agrega (o suma cantidad si existe mismo nombre y valor) */
  const handleConfirmAdd = (payload: { articulo: string; qty: number; valor: number }) => {
    setItems((prev) => {
      const idx = prev.findIndex(
        (x) => x.articulo === payload.articulo && x.valor === payload.valor
      );
      if (idx >= 0) {
        const next = [...prev];
        const newQty = next[idx].qty + payload.qty;
        next[idx] = {
          ...next[idx],
          qty: newQty,
          subtotal: newQty * next[idx].valor,
        };
        return next;
      }
      return [
        ...prev,
        {
          articulo: payload.articulo,
          qty: payload.qty,
          valor: payload.valor,
          subtotal: payload.valor * payload.qty,
          estado: 'LAVAR',
        },
      ];
    });

    // cerrar modal
    setAddOpen(false);
    setSelArticulo(null);
  };

  /** Quita una fila del detalle */
  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* 1) Cabecera: N°, fechas arriba der., teléfono y cliente */}
      <HeaderPedido onCliente={setCliente} onNroInfo={setNroInfo} />

      {/* 2) Selector + Detalle */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 mt-6">
        <div className="rounded-2xl bg-white text-slate-900 p-4 sm:p-5 shadow-[0_10px_30px_rgba(0,0,0,.20)]">
          <div className="mb-4">
            <ArticulosSelect onSelect={handleSelectArticulo} />
          </div>

          {/* 3) Detalle / Total / Guardar */}
          <DetallePedido
            cliente={cliente}
            nroInfo={nroInfo}
            items={items}
            onRemoveItem={handleRemoveItem}
          />
        </div>
      </section>

      {/* Modal de cantidad + valor (aparece tras elegir del combo) */}
      <AddItemModal
        open={addOpen}
        articuloId={selArticulo?.id ?? null}
        articuloNombre={selArticulo?.nombre ?? null}
        onCancel={() => {
          setAddOpen(false);
          setSelArticulo(null);
        }}
        onConfirm={handleConfirmAdd}
      />
    </main>
  );
}
