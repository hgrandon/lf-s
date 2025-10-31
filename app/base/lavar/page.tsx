'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, User, Table, Loader2, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

type Item = { articulo: string; qty: number; valor: number };
type Pedido = {
  nro: number;
  telefono: string;
  nombre: string;
  direccion: string;
  estado_pago: string;
  tipo_entrega: string;
  total: number;
  fotos_urls?: string[] | null;
  items?: Item[];
};

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export default function LavarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [openNro, setOpenNro] = useState<number | null>(null);
  const [openDetail, setOpenDetail] = useState<Record<number, boolean>>({});
  const [imageError, setImageError] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const pedidoAbierto = useMemo(
    () => pedidos.find(p => p.nro === openNro) ?? null,
    [pedidos, openNro]
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErrMsg(null);

        const { data, error } = await supabase
          .from('pedido')
          .select('nro, telefono, nombre, direccion, estado_pago, tipo_entrega, total, fotos_urls')
          .order('nro', { ascending: false });

        if (error) throw error;
        setPedidos(data || []);
      } catch (err: any) {
        console.error(err);
        setErrMsg(err.message || 'Error al cargar pedidos');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function snack(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2000);
  }

  async function togglePago(nro: number, actual: string) {
    setSaving(true);
    const nuevo = actual === 'PAGADO' ? 'PENDIENTE' : 'PAGADO';

    const { error } = await supabase
      .from('pedido')
      .update({ estado_pago: nuevo })
      .eq('nro', nro);

    if (error) {
      console.error(error);
      snack('Error al cambiar estado de pago');
    } else {
      setPedidos(prev =>
        prev.map(p => (p.nro === nro ? { ...p, estado_pago: nuevo } : p))
      );
      snack(`Pedido #${nro} → ${nuevo}`);
    }
    setSaving(false);
  }

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      <header className="relative z-10 flex items-center justify-between px-4 lg:px-10 py-3 lg:py-5">
        <h1 className="font-bold text-base lg:text-xl">Lavar</h1>
        <button onClick={() => router.push('/base')} className="text-xs lg:text-sm text-white/90 hover:text-white">
          ← Volver
        </button>
      </header>

      <section className="relative z-10 w-full px-3 sm:px-6 lg:px-10 grid gap-4">
        {loading && (
          <div className="flex items-center gap-2 text-white/90">
            <Loader2 className="animate-spin" size={18} />
            Cargando pedidos…
          </div>
        )}

        {!loading && errMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-300/30 p-3 text-sm">
            <AlertTriangle size={16} />
            <span>{errMsg}</span>
          </div>
        )}

        {!loading && !errMsg && pedidos.length === 0 && (
          <div className="text-white/80">No hay pedidos registrados.</div>
        )}

        {!loading &&
          !errMsg &&
          pedidos.map(p => {
            const isOpen = openNro === p.nro;
            const detOpen = !!openDetail[p.nro];
            const foto = Array.isArray(p.fotos_urls)
              ? p.fotos_urls[0]
              : typeof p.fotos_urls === 'string'
              ? p.fotos_urls.replace(/[\[\]"]/g, '')
              : null;

            return (
              <div
                key={p.nro}
                className={`rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md shadow-md ${
                  isOpen ? 'border-white/40' : ''
                }`}
              >
                <button
                  onClick={() => setOpenNro(isOpen ? null : p.nro)}
                  className="w-full flex items-center justify-between gap-3 lg:gap-4 px-3 sm:px-4 lg:px-6 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/15 border border-white/20">
                      <User size={18} />
                    </span>
                    <div className="text-left">
                      <div className="font-extrabold tracking-wide text-sm lg:text-base">N° {p.nro}</div>
                      <div className="text-[10px] lg:text-xs uppercase text-white/85">
                        {p.nombre} • {p.telefono}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 lg:gap-4">
                    <div className="font-extrabold text-white/95 text-sm lg:text-base">
                      {CLP.format(p.total ?? 0)}
                    </div>
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-3 sm:px-4 lg:px-6 pb-3 lg:pb-5">
                    <div className="rounded-xl bg-white/8 border border-white/15 p-2 lg:p-3">
                      <button
                        onClick={() => setOpenDetail(prev => ({ ...prev, [p.nro]: !prev[p.nro] }))}
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
                          <div className="p-4 text-sm text-white/80">
                            Dirección: {p.direccion} <br />
                            Tipo entrega: {p.tipo_entrega} <br />
                            Estado de pago: {p.estado_pago}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 rounded-xl overflow-hidden bg-black/20 border border-white/10">
                        {foto && !imageError[p.nro] ? (
                          <div className="relative w-full aspect-[16/9] lg:h-72">
                            <Image
                              src={foto}
                              alt={`Foto pedido ${p.nro}`}
                              fill
                              sizes="(max-width: 1024px) 100vw, 1200px"
                              onError={() => setImageError(prev => ({ ...prev, [p.nro]: true }))}
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
            {pedidoAbierto ? (
              <>
                <ActionBtn
                  label={pedidoAbierto.estado_pago === 'PAGADO' ? 'Pendiente' : 'Pagado'}
                  onClick={() => togglePago(pedidoAbierto.nro, pedidoAbierto.estado_pago)}
                  disabled={saving}
                  active={pedidoAbierto.estado_pago === 'PAGADO'}
                />
              </>
            ) : (
              <div className="col-span-5 text-center text-xs text-white/70">
                Abre un pedido para habilitar las acciones.
              </div>
            )}
          </div>
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
      className={`rounded-xl py-3 text-sm font-medium border transition ${
        active
          ? 'bg-white/20 border-white/30 text-white'
          : 'bg-white/5 border-white/10 text-white/90 hover:bg-white/10'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {label}
    </button>
  );
}
