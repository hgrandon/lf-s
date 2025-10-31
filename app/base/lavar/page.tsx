'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, User, Image as ImageIcon, Table } from 'lucide-react';

type Item = {
  articulo: string;
  qty: number;
  valor: number;
  estado: 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGADO';
};

type Pedido = {
  id: number;
  cliente: string;
  total: number;
  estado: 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGADO';
  detalle: string;
  foto_url?: string;
  telefono?: string;
  direccion?: string;
  items?: Item[];
};

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

// Mock para demo (reemplazar por Supabase luego)
const DATA_MOCK: Pedido[] = [
  {
    id: 6245,
    cliente: 'HÉCTOR GRANDON',
    total: 30000,
    estado: 'LAVAR',
    detalle: 'COBERTOR KING + FRAZADAS (3) + POLERONES',
    foto_url:
      'https://images.unsplash.com/photo-1616004655121-818b8a6b159d?q=80&w=1400&auto=format&fit=crop',
    telefono: '+56 9 9999 9999',
    direccion: 'Av. Siempre Viva 123',
    items: [
      { articulo: 'COBERTOR 2 PLAZAS 220 X 200', qty: 2, valor: 8000, estado: 'LAVAR' },
      { articulo: 'COBERTOR KING 220 X 250', qty: 1, valor: 10000, estado: 'LAVAR' },
      { articulo: 'RETIRO Y ENTREGA', qty: 1, valor: 1000, estado: 'LAVAR' },
    ],
  },
  {
    id: 6244,
    cliente: 'CAROLA',
    total: 20000,
    estado: 'LAVAR',
    detalle: 'MANTAS + ROPA VARIADA',
    foto_url:
      'https://images.unsplash.com/photo-1567013127542-490d757e51fc?q=80&w=1400&auto=format&fit=crop',
    items: [
      { articulo: 'MANTA 2 PLAZAS', qty: 1, valor: 7000, estado: 'LAVAR' },
      { articulo: 'PANTALONES', qty: 4, valor: 2000, estado: 'LAVAR' },
      { articulo: 'POLERAS', qty: 3, valor: 1500, estado: 'LAVAR' },
    ],
  },
  {
    id: 6246,
    cliente: 'FRANCISCO',
    total: 10000,
    estado: 'LAVAR',
    detalle: 'POLERAS + PANTALONES (6)',
  },
];

export default function LavarPage() {
  const router = useRouter();
  const [openId, setOpenId] = useState<number | null>(null);
  // subacordeones independientes por pedido
  const [openImage, setOpenImage] = useState<Record<number, boolean>>({});
  const [openDetail, setOpenDetail] = useState<Record<number, boolean>>({});

  const pedidos = useMemo(() => DATA_MOCK.filter((p) => p.estado === 'LAVAR'), []);

  const toggleRow = (id: number) => setOpenId((prev) => (prev === id ? null : id));
  const toggleImage = (id: number) =>
    setOpenImage((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleDetail = (id: number) =>
    setOpenDetail((prev) => ({ ...prev, [id]: !prev[id] }));

  const subtotal = (item: Item) => item.qty * item.valor;

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <h1 className="font-bold text-lg">Lavar</h1>
        <button
          onClick={() => router.push('/base')}
          className="text-sm text-white/90 hover:text-white"
        >
          ← Volver
        </button>
      </header>

      <section className="relative z-10 px-4 md:px-6 grid gap-3 max-w-3xl">
        {pedidos.map((p) => {
          const isOpen = openId === p.id;
          const imgOpen = !!openImage[p.id];
          const detOpen = !!openDetail[p.id];

          const totalCalculado =
            p.items?.reduce((acc, it) => acc + subtotal(it), 0) ?? p.total ?? 0;

          return (
            <div
              key={p.id}
              className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md shadow-[0_6px_20px_rgba(0,0,0,0.15)]"
            >
              {/* Cabecera del pedido */}
              <button
                onClick={() => toggleRow(p.id)}
                className="w-full flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/15 border border-white/20">
                    <User size={18} />
                  </span>
                  <div className="text-left">
                    <div className="font-extrabold tracking-wide">N° {p.id}</div>
                    <div className="text-xs uppercase text-white/85">{p.cliente}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="font-extrabold text-white/95">
                    {CLP.format(totalCalculado)}
                  </div>
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
              </button>

              {/* Contenido desplegable del pedido */}
              {isOpen && (
                <div className="px-4 pb-4">
                  <div className="rounded-xl bg-white/8 border border-white/15 p-2">
                    {/* Sub-acordeón: Imagen */}
                    <button
                      onClick={() => toggleImage(p.id)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <ImageIcon size={16} />
                        <span className="font-semibold">Imagen del Pedido</span>
                      </div>
                      {imgOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    {imgOpen && (
                      <div className="mt-3 rounded-xl overflow-hidden bg-black/20 border border-white/10">
                        {p.foto_url ? (
                          <img
                            src={p.foto_url}
                            alt={`Foto pedido ${p.id}`}
                            className="w-full h-56 object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="p-6 text-sm text-white/70">Sin imagen adjunta.</div>
                        )}
                      </div>
                    )}

                    {/* Sub-acordeón: Detalle */}
                    <div className="mt-3" />
                    <button
                      onClick={() => toggleDetail(p.id)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <Table size={16} />
                        <span className="font-semibold">Detalle Pedido</span>
                      </div>
                      {detOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    {detOpen && (
                      <div className="mt-3 rounded-xl overflow-hidden bg-white/5 border border-white/10">
                        <div className="overflow-auto">
                          <table className="min-w-full text-sm">
                            <thead className="bg-white/10 text-white">
                              <tr>
                                <th className="text-left px-3 py-2">Artículo</th>
                                <th className="text-right px-3 py-2">Cantidad</th>
                                <th className="text-right px-3 py-2">Valor</th>
                                <th className="text-right px-3 py-2">Subtotal</th>
                                <th className="text-left px-3 py-2">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                              {p.items?.length ? (
                                p.items.map((it, idx) => (
                                  <tr key={idx} className="text-white/95">
                                    <td className="px-3 py-2">{it.articulo}</td>
                                    <td className="px-3 py-2 text-right">{it.qty}</td>
                                    <td className="px-3 py-2 text-right">
                                      {CLP.format(it.valor)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      {CLP.format(subtotal(it))}
                                    </td>
                                    <td className="px-3 py-2">{it.estado}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td className="px-3 py-4 text-white/70" colSpan={5}>
                                    Sin items registrados para este pedido.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="px-3 py-3 bg-white/10 text-right font-extrabold">
                          Total: {CLP.format(totalCalculado)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Footer fijo (atajos) */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 px-4 pt-2 pb-4 backdrop-blur-md">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white/10 border border-white/15 p-3">
          <div className="grid grid-cols-4 gap-3">
            {[
              { name: 'Base', href: '/base' },
              { name: 'Clientes', href: '/clientes' },
              { name: 'Finanzas', href: '/finanzas' },
              { name: 'Config', href: '/config' },
            ].map((item) => (
              <button
                key={item.name}
                onClick={() => router.push(item.href)}
                className="flex flex-col items-center justify-center rounded-xl bg-white/5 border border-white/10 py-3 text-white/90 hover:bg-white/10 transition"
              >
                <span className="text-sm font-medium">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>
    </main>
  );
}
