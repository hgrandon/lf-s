'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, User } from 'lucide-react';

type Pedido = {
  id: number;              // correlativo: 6245
  cliente: string;         // nombre cliente
  total: number;           // total en CLP
  estado: 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGADO';
  detalle: string;         // breve descripción
  foto_url?: string;       // URL de imagen del pedido
  telefono?: string;
  direccion?: string;
};

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

// TODO: reemplazar con datos reales desde Supabase
const DATA_MOCK: Pedido[] = [
  {
    id: 6245,
    cliente: 'HÉCTOR GRANDON',
    total: 30000,
    estado: 'LAVAR',
    detalle: 'COBERTOR KING + FRAZADAS (3) + POLERONES',
    foto_url: 'https://images.unsplash.com/photo-1616004655121-818b8a6b159d?q=80&w=1400&auto=format&fit=crop',
    telefono: '+56 9 9999 9999',
    direccion: 'Av. Siempre Viva 123',
  },
  {
    id: 6244,
    cliente: 'CAROLA',
    total: 20000,
    estado: 'LAVAR',
    detalle: 'MANTAS + ROPA VARIADA',
    foto_url: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?q=80&w=1400&auto=format&fit=crop',
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

  // si más adelante filtramos por estado real:
  const pedidos = useMemo(() => DATA_MOCK.filter(p => p.estado === 'LAVAR'), []);

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <h1 className="font-bold text-lg">Lavar</h1>
        <button
          onClick={() => router.push('/base')}
          className="text-sm text-white/90 hover:text-white"
        >
          ← Volver
        </button>
      </header>

      {/* Listado en acordeón */}
      <section className="relative z-10 px-4 md:px-6 grid gap-3 max-w-3xl">
        {pedidos.map((p) => {
          const isOpen = openId === p.id;
          return (
            <div
              key={p.id}
              className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md shadow-[0_6px_20px_rgba(0,0,0,0.15)]"
            >
              {/* Cabecera */}
              <button
                onClick={() => setOpenId(isOpen ? null : p.id)}
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
                  <div className="font-extrabold text-white/95">{CLP.format(p.total)}</div>
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
              </button>

              {/* Detalle desplegable */}
              {isOpen && (
                <div className="px-4 pb-4">
                  <div className="rounded-xl bg-white/8 border border-white/15">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                      <div className="font-semibold">Detalle Pedido</div>
                      <button
                        className="text-sm text-white/80 hover:text-white"
                        onClick={() => router.push(`/pedido/${p.id}`)}
                      >
                        Ver más →
                      </button>
                    </div>

                    <div className="grid gap-3 p-4">
                      {p.detalle && (
                        <div className="text-sm text-white/90">
                          {p.detalle}
                        </div>
                      )}

                      {p.telefono || p.direccion ? (
                        <div className="text-xs text-white/80">
                          {p.telefono ? <div>Tel: {p.telefono}</div> : null}
                          {p.direccion ? <div>Dir: {p.direccion}</div> : null}
                        </div>
                      ) : null}

                      {p.foto_url ? (
                        <div className="rounded-xl overflow-hidden bg-black/20 border border-white/10">
                          <img
                            src={p.foto_url}
                            alt={`Foto pedido ${p.id}`}
                            className="w-full h-56 object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/10 bg-white/5 text-white/70 text-sm p-6">
                          Sin imagen adjunta.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Barra fija de atajos como en Base */}
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
