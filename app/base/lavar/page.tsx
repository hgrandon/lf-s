'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, User, Table, Loader2 } from 'lucide-react';
import Image from 'next/image';

type Item = { articulo: string; qty: number; valor: number };
type Pedido = {
  id: number;
  cliente: string;
  total: number;
  estado: 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGADO';
  detalle: string;
  foto_url?: string;
  items?: Item[];
  pagado?: boolean;
};

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const DATA_MOCK: Pedido[] = [
  {
    id: 6245,
    cliente: 'HÉCTOR GRANDON',
    total: 30000,
    estado: 'LAVAR',
    detalle: 'COBERTOR KING + FRAZADAS (3) + POLERONES',
    foto_url: 'https://images.unsplash.com/photo-1616004655121-818b8a6b159d?q=80&w=1600&auto=format&fit=crop',
    items: [
      { articulo: 'COBERTOR 2 PLAZAS 220 X 200', qty: 2, valor: 8000 },
      { articulo: 'COBERTOR KING 220 X 250', qty: 1, valor: 10000 },
      { articulo: 'RETIRO Y ENTREGA', qty: 1, valor: 1000 },
    ],
    pagado: false,
  },
  {
    id: 6244,
    cliente: 'CAROLA',
    total: 20000,
    estado: 'LAVAR',
    detalle: 'MANTAS + ROPA VARIADA',
    foto_url: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?q=80&w=1600&auto=format&fit=crop',
    items: [
      { articulo: 'MANTA 2 PLAZAS', qty: 1, valor: 7000 },
      { articulo: 'PANTALONES', qty: 4, valor: 2000 },
      { articulo: 'POLERAS', qty: 3, valor: 1500 },
    ],
    pagado: true,
  },
  {
    id: 6246,
    cliente: 'FRANCISCO',
    total: 10000,
    estado: 'LAVAR',
    detalle: 'POLERAS + PANTALONES (6)',
    pagado: false,
  },
];

const STATE_LABEL: Record<Pedido['estado'], string> = {
  LAVAR: 'Lavar',
  LAVANDO: 'Lavando',
  GUARDAR: 'Entregar',
  GUARDADO: 'Guardado',
  ENTREGADO: 'Entregado',
};

export default function LavarPage() {
  const router = useRouter();

  // Estado local (en producción vendrá desde Supabase)
  const [pedidos, setPedidos] = useState<Pedido[]>(DATA_MOCK.filter((p) => p.estado === 'LAVAR'));
  const [openId, setOpenId] = useState<number | null>(null);
  const [openDetail, setOpenDetail] = useState<Record<number, boolean>>({});
  const [imageError, setImageError] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const pedidoAbierto = pedidos.find((p) => p.id === openId) ?? null;

  const subtotal = (it: Item) => it.qty * it.valor;
  const totalCalc = (p: Pedido) =>
    p.items?.reduce((acc, it) => acc + subtotal(it), 0) ?? p.total ?? 0;

  function showNotice(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 1800);
  }

  // Simulación de cambio de estado (optimistic). En producción aquí llamas a Supabase y si falla revierte.
  async function changeEstado(id: number, next: Pedido['estado']) {
    if (!id) return;
    setSaving(true);
    const prev = pedidos;
    const patched = prev.map((p) => (p.id === id ? { ...p, estado: next } : p));
    setPedidos(patched);

    // Simulación de éxito (await supabase.from('pedidos').update({estado: next}).eq('id', id))
    await new Promise((r) => setTimeout(r, 300));

    if (next !== 'LAVAR') {
      setPedidos((curr) => curr.filter((p) => p.id !== id));
      setOpenId(null); // des-selecciona, con eso se desactivan los botones
      showNotice(`Pedido #${id} movido a ${STATE_LABEL[next]}`);
    }
    setSaving(false);
  }

  async function togglePago(id: number) {
    if (!id) return;
    setSaving(true);
    const prev = pedidos;
    const patched = prev.map((p) =>
      p.id === id ? { ...p, pagado: !p.pagado } : p
    );
    setPedidos(patched);

    // Simulación de éxito (await supabase.from('pedidos').update({pagado: !actual}).eq('id', id))
    await new Promise((r) => setTimeout(r, 250));

    showNotice(
      `Pedido #${id} marcado como ${patched.find((p) => p.id === id)?.pagado ? 'Pagado' : 'Pendiente'}`
    );
    setSaving(false);
  }

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      <header className="relative z-10 flex items-center justify-between px-4 lg:px-10 py-3 lg:py-5">
        <h1 className="font-bold text-base lg:text-xl">Lavar</h1>
        <button
          onClick={() => router.push('/base')}
          className="text-xs lg:text-sm text-white/90 hover:text-white"
        >
          ← Volver
        </button>
      </header>

      <section className="relative z-10 w-full px-3 sm:px-6 lg:px-10 grid gap-4">
        {pedidos.map((p) => {
          const isOpen = openId === p.id;
          const detOpen = !!openDetail[p.id];

          return (
            <div
              key={p.id}
              className={[
                'rounded-2xl bg-white/10 border backdrop-blur-md shadow-[0_6px_20px_rgba(0,0,0,0.15)]',
                isOpen ? 'border-white/40' : 'border-white/15',
              ].join(' ')}
            >
              <button
                onClick={() => setOpenId(isOpen ? null : p.id)}
                className="w-full flex items-center justify-between gap-3 lg:gap-4 px-3 sm:px-4 lg:px-6 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/15 border border-white/20">
                    <User size={18} />
                  </span>
                  <div className="text-left">
                    <div className="font-extrabold tracking-wide text-sm lg:text-base">
                      N° {p.id}
                    </div>
                    <div className="text-[10px] lg:text-xs uppercase text-white/85">
                      {p.cliente} {p.pagado ? '• PAGADO' : '• PENDIENTE'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 lg:gap-4">
                  <div className="font-extrabold text-white/95 text-sm lg:text-base">
                    {CLP.format(totalCalc(p))}
                  </div>
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
              </button>

              {isOpen && (
                <div className="px-3 sm:px-4 lg:px-6 pb-3 lg:pb-5">
                  <div className="rounded-xl bg-white/8 border border-white/15 p-2 lg:p-3">
                    <button
                      onClick={() =>
                        setOpenDetail((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                      }
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <Table size={16} />
                        <span className="font-semibold">Detalle Pedido</span>
                      </div>
                      {detOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    {detOpen && (
                      <div className="mt-3 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex justify-center">
                        <div className="overflow-x-auto w-full max-w-4xl">
                          <table className="w-full text-xs lg:text-sm text-white/95">
                            <thead className="bg-white/10 text-white/90">
                              <tr>
                                <th className="text-left px-3 py-2 w-[40%]">Artículo</th>
                                <th className="text-right px-3 py-2 w-[15%]">Can.</th>
                                <th className="text-right px-3 py-2 w-[20%]">Valor</th>
                                <th className="text-right px-3 py-2 w-[25%]">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                              {p.items?.length ? (
                                p.items.map((it, idx) => (
                                  <tr key={idx}>
                                    <td className="px-3 py-2 truncate">
                                      {it.articulo.length > 18
                                        ? it.articulo.slice(0, 18) + '.'
                                        : it.articulo}
                                    </td>
                                    <td className="px-3 py-2 text-right">{it.qty}</td>
                                    <td className="px-3 py-2 text-right">
                                      {CLP.format(it.valor)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      {CLP.format(it.qty * it.valor)}
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td
                                    className="px-3 py-4 text-center text-white/70"
                                    colSpan={4}
                                  >
                                    Sin artículos registrados.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                          <div className="px-3 py-3 bg-white/10 text-right font-extrabold text-white">
                            Total: {CLP.format(totalCalc(p))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 rounded-xl overflow-hidden bg-black/20 border border-white/10">
                      {p.foto_url && !imageError[p.id] ? (
                        <div className="relative w-full aspect-[16/9] lg:h-72">
                          <Image
                            src={p.foto_url}
                            alt={`Foto pedido ${p.id}`}
                            fill
                            sizes="(max-width: 1024px) 100vw, 1200px"
                            onError={() =>
                              setImageError((prev) => ({ ...prev, [p.id]: true }))
                            }
                            className="object-cover"
                            priority={false}
                          />
                        </div>
                      ) : (
                        <div className="p-6 text-sm text-white/70">Sin imagen adjunta.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <nav className="fixed bottom-0 left-0 right-0 z-20 px-4 sm:px-6 lg:px-10 pt-2 pb-4 backdrop-blur-md">
        <div className="mx-auto w-full rounded-2xl bg-white/10 border border-white/15 p-3">
          <div className="grid grid-cols-5 gap-3">
            <ActionBtn
              label="Lavando"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'LAVANDO')}
              active={pedidoAbierto?.estado === 'LAVANDO'}
            />
            <ActionBtn
              label="Guardado"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'GUARDADO')}
              active={pedidoAbierto?.estado === 'GUARDADO'}
            />
            <ActionBtn
              label="Entregar"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'GUARDAR')}
              active={pedidoAbierto?.estado === 'GUARDAR'}
            />
            <ActionBtn
              label="Entregado"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'ENTREGADO')}
              active={pedidoAbierto?.estado === 'ENTREGADO'}
            />
            <ActionBtn
              label={pedidoAbierto?.pagado ? 'Pago' : 'Pendiente'}
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && togglePago(pedidoAbierto.id)}
              active={!!pedidoAbierto?.pagado}
            />
          </div>

          {pedidoAbierto ? (
            <div className="mt-2 text-center text-xs text-white/90">
              Pedido seleccionado: <b>#{pedidoAbierto.id}</b>{' '}
              {saving && (
                <span className="inline-flex items-center gap-1">
                  <Loader2 size={14} className="animate-spin" /> Guardando…
                </span>
              )}
            </div>
          ) : (
            <div className="mt-2 text-center text-xs text-white/70">
              Abre un pedido para habilitar las acciones.
            </div>
          )}
        </div>
      </nav>

      {notice && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg bg-black/70 text-white text-sm shadow">
          {notice}
        </div>
      )}
    </main>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  active,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'rounded-xl py-3 text-sm font-medium border transition',
        active
          ? 'bg-white/20 border-white/30 text-white'
          : 'bg-white/5 border-white/10 text-white/90 hover:bg-white/10',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
