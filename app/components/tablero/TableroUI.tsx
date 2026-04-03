import { ReactNode } from 'react';
import { useTableroPedidos, TableroOpciones, PedidoEstado, normalizarDireccion, toE164CL } from './useTableroPedidos';
import {
  Loader2,
  AlertTriangle,
  User,
  ChevronDown,
  ChevronRight,
  Table,
  Archive,
  Camera,
  ImagePlus,
  Printer,
  MapPin,
  Home,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export type BotonAccionDef = {
  id: string;
  title: string | ((pedidoId: number, t: ReturnType<typeof useTableroPedidos>) => string);
  Icon: LucideIcon;
  onClick: (pedidoId: number, t: ReturnType<typeof useTableroPedidos>) => void;
  activeFn?: (pedidoId: number, t: ReturnType<typeof useTableroPedidos>) => boolean;
  variant?: 'default' | 'success';
};

function IconBtn({
  title,
  onClick,
  Icon,
  active = false,
  disabled = false,
  variant = 'default',
}: {
  title: string;
  onClick: () => void;
  Icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'success';
}) {
  let baseClr =
    'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white';
  let actClr =
    'bg-violet-600 border border-violet-400 text-white shadow shadow-violet-500/50';

  if (variant === 'success') {
    actClr =
      'bg-emerald-600 border border-emerald-400 text-white shadow shadow-emerald-500/50';
  }

  const cls = active ? actClr : baseClr;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex items-center justify-center p-2 rounded-lg transition-all w-full h-full',
        cls,
        disabled && !active ? 'opacity-40 cursor-not-allowed saturate-0' : '',
      ].join(' ')}
      title={title}
    >
      <Icon size={20} strokeWidth={active ? 2.5 : 2} />
    </button>
  );
}

export function TableroUI({
  titulo,
  backURL,
  backLabel = '← Volver',
  opciones,
  botonesAccion,
  permiteImprimirRotulo = false,
  permiteRuta = false,
}: {
  titulo: string;
  backURL: string;
  backLabel?: string;
  opciones: TableroOpciones;
  botonesAccion: BotonAccionDef[];
  permiteImprimirRotulo?: boolean;
  permiteRuta?: boolean;
}) {
  const t = useTableroPedidos(opciones);
  const { router } = t;

  const totalPedidos = t.pedidos.length;
  const totalMonto = t.pedidos.reduce((acc, p) => {
    if (p.items?.length) return acc + p.items.reduce((a, it) => a + it.qty * it.valor, 0);
    return acc + Number(p.total ?? 0);
  }, 0);

  const pedidoAbierto = t.pedidos.find((p) => p.id === t.openId);

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-32 pt-16 lg:pt-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      <header
        className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between
                   px-4 lg:px-10 py-3 lg:py-4
                   bg-gradient-to-r from-violet-800/95 via-fuchsia-700/95 to-indigo-800/95
                   backdrop-blur-md border-b border-white/10"
      >
        <div className="flex flex-col gap-1">
          <h1 className="font-bold text-base lg:text-xl">{titulo}</h1>
          <div className="text-[11px] lg:text-xs text-white/80 flex items-center gap-2">
            <span>{totalPedidos} pedidos</span>
            <span className="opacity-60">•</span>
            <span>Total {CLP.format(totalMonto)}</span>
          </div>
        </div>
        <button
          onClick={() => router.push(backURL)}
          className="text-xs lg:text-sm text-white/90 hover:text-white"
        >
          {backLabel}
        </button>
      </header>

      <section className="relative z-10 w-full px-3 sm:px-6 lg:px-10 grid gap-4 mt-2">
        {t.loading && (
          <div className="mt-4 flex items-center gap-2 text-white/90">
            <Loader2 className="animate-spin" size={18} />
            Cargando pedidos…
          </div>
        )}

        {!t.loading && t.errMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-300/30 p-3 text-sm">
            <AlertTriangle size={16} />
            <span>{t.errMsg}</span>
          </div>
        )}

        {!t.loading && !t.errMsg && t.pedidos.length === 0 && (
          <div className="mt-6 text-white/80">No hay pedidos en estado {opciones.estadoBase}.</div>
        )}

        {!t.loading &&
          !t.errMsg &&
          t.pedidos.map((p) => {
            const isOpen = t.openId === p.id;
            const detOpen = !!t.openDetail[p.id];
            const totalCalc = p.items?.length
              ? p.items.reduce((a, it) => a + it.qty * it.valor, 0)
              : Number(p.total ?? 0);

            const dirCorta = normalizarDireccion(p.direccion || p.detalle) || (p.cliente !== 'SIN NOMBRE' ? p.cliente : null);

            return (
              <div
                key={p.id}
                data-pedido-id={p.id}
                id={`pedido-${p.id}`}
                className={[
                  'rounded-2xl bg-white/10 border backdrop-blur-md shadow-[0_6px_20px_rgba(0,0,0,0.15)]',
                  isOpen ? 'border-white/40' : 'border-white/15',
                ].join(' ')}
              >
                <button
                  onClick={() => t.setOpenId(isOpen ? null : p.id)}
                  className="w-full flex items-center justify-between gap-3 lg:gap-4 px-3 sm:px-4 lg:px-6 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={[
                        'inline-flex items-center justify-center w-10 h-10 rounded-full border-2 shadow text-white/90',
                        p.pagado
                          ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]'
                          : 'bg-red-500 border-red-300 shadow-[0_0_0_3px_rgba(239,68,68,0.25)]',
                      ].join(' ')}
                    >
                      <User size={18} />
                    </span>

                    <div className="text-left">
                      <div className="font-extrabold tracking-wide text-sm lg:text-base">
                        N° {p.id}
                        {p.tipo_entrega === 'LOCAL' && (
                          <span className="ml-1 text-[10px] lg:text-xs bg-black/30 px-2 py-[2px] rounded-full align-middle">LOCAL</span>
                        )}
                        {p.tipo_entrega === 'DOMICILIO' && (
                          <span className="ml-1 text-[10px] lg:text-xs bg-black/30 px-2 py-[2px] rounded-full align-middle">DOMICILIO</span>
                        )}
                      </div>
                      <div className="text-[10px] lg:text-xs uppercase text-white/85">
                        {p.cliente}{' '}
                        {p.telefono && `• +${toE164CL(p.telefono)?.slice(2) ?? p.telefono}`}{' '}
                        {p.pagado ? '• PAGADO' : '• PENDIENTE'}
                      </div>
                      {permiteRuta && dirCorta && (
                        <div className="text-[9px] lg:text-[11px] text-white/75 normal-case">
                          {dirCorta}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 lg:gap-4">
                    {permiteRuta && dirCorta && (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          t.openRuta(p);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-white/80 bg-white/10 text-xs lg:text-sm font-semibold shadow hover:bg-white/20"
                      >
                        <MapPin size={18} />
                        <span>Ruta</span>
                      </button>
                    )}
                    <div className="font-extrabold text-white/95 text-sm lg:text-base">
                      {CLP.format(totalCalc)}
                    </div>
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-3 sm:px-4 lg:px-6 pb-3 lg:pb-5">
                    <div className="rounded-xl bg-white/5 border border-white/15 p-2 lg:p-3">
                      <button
                        onClick={() => t.setOpenDetail((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center gap-2">
                          <Table size={16} />
                          <span className="font-semibold">Detalle Pedido</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              t.goEdit(p.id);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[0.7rem] rounded-lg bg-violet-600 hover:bg-violet-700 text-violet-50 shadow border border-violet-400/60"
                          >
                            <Archive size={14} className="text-violet-50" />
                            <span>Editar</span>
                          </button>

                          {permiteImprimirRotulo && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/rotulos?nro=${p.id}&copies=1`);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[0.7rem] rounded-lg bg-white text-violet-700 hover:bg-violet-50 shadow border border-violet-300"
                              title="Imprimir rótulo de este pedido"
                            >
                              <Printer size={14} />
                              <span>Rótulo</span>
                            </button>
                          )}

                          {detOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
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
                                        {it.articulo.length > 20 ? it.articulo.slice(0, 20) + '.' : it.articulo}
                                      </td>
                                      <td className="px-3 py-2 text-right">{it.qty}</td>
                                      <td className="px-3 py-2 text-right">{CLP.format(it.valor)}</td>
                                      <td className="px-3 py-2 text-right">{CLP.format(it.qty * it.valor)}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td className="px-3 py-4 text-center text-white/70" colSpan={4}>
                                      Sin artículos registrados.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                            <div
                              className="px-3 py-3 bg-white/10 text-right font-extrabold text-white select-none cursor-pointer"
                              title="Doble clic para editar pedido"
                              onDoubleClick={() => t.setAskEditForId(p.id)}
                            >
                              Total: {CLP.format(totalCalc)}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 rounded-xl overflow-hidden bg-black/20 border border-white/10">
                        {p.foto_url && !t.imageError[p.id] ? (
                          <div
                            className="w-full bg-black/10 rounded-xl overflow-hidden border border-white/10 cursor-zoom-in relative max-h-[70vh] flex items-center justify-center p-2"
                            onDoubleClick={() => t.openPickerFor(p.id)}
                            title="Doble clic para cambiar la imagen"
                          >
                            <img
                              src={p.foto_url}
                              alt={`Foto pedido ${p.id}`}
                              className="max-h-[70vh] rounded-md shadow-lg"
                              onError={() => t.setImageError((prev) => ({ ...prev, [p.id]: true }))}
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => t.openPickerFor(p.id)}
                            className="w-full p-6 text-sm text-white/80 hover:text-white hover:bg-white/5 transition flex items-center justify-center gap-2"
                            title="Agregar imagen"
                          >
                            <ImagePlus size={18} />
                            <span>
                              {t.uploading[p.id]
                                ? 'Subiendo…'
                                : 'Sin imagen adjunta. Toca para agregar.'}
                            </span>
                          </button>
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
          <div className="flex gap-2 justify-center overflow-x-auto">
            {botonesAccion.map((b) => (
              <div key={b.id} className="min-w-[50px] flex-1 max-w-[75px]">
                <IconBtn
                  title={typeof b.title === 'function' ? (pedidoAbierto ? b.title(pedidoAbierto.id, t) : '...') : b.title}
                  disabled={!pedidoAbierto || t.saving}
                  onClick={() => pedidoAbierto && b.onClick(pedidoAbierto.id, t)}
                  active={pedidoAbierto && b.activeFn ? b.activeFn(pedidoAbierto.id, t) : false}
                  Icon={b.Icon}
                  variant={b.variant}
                />
              </div>
            ))}
          </div>

          {pedidoAbierto ? (
            <div className="mt-2 text-center text-xs text-white/90">
              Pedido seleccionado: <b>#{pedidoAbierto.id}</b>{' '}
              {t.saving && (
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

      {t.notice && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg bg-black/70 text-white text-sm shadow whitespace-nowrap">
          {t.notice}
        </div>
      )}

      {/* Modal Editar */}
      {t.askEditForId && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-black/50"
          onClick={() => t.setAskEditForId(null)}
          onKeyDown={(e) => e.key === 'Escape' && t.setAskEditForId(null)}
          tabIndex={-1}
        >
          <div
            className="w-[420px] max-w-[92vw] rounded-2xl bg-white p-4 text-violet-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-1">Editar pedido #{t.askEditForId}</h3>
            <p className="text-sm text-black/70 mb-4">¿Desea editar este pedido?</p>
            <div className="flex gap-2">
              <button
                onClick={() => t.goEdit()}
                className="flex-1 rounded-xl bg-violet-600 text-white px-4 py-3 hover:bg-violet-700"
              >
                Editar
              </button>
              <button
                onClick={() => t.setAskEditForId(null)}
                className="flex-1 rounded-xl bg-violet-100 text-violet-800 px-4 py-3 hover:bg-violet-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para elegir cámara/archivo */}
      {t.pickerForPedido && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50">
          <div className="w-[420px] max-w-[92vw] rounded-2xl bg-white p-4 text-violet-800 shadow-2xl">
            <h3 className="text-lg font-semibold mb-3">
              Agregar imagen al pedido #{t.pickerForPedido}
            </h3>
            <div className="grid gap-2">
              <button
                onClick={() => t.handlePick('camera')}
                className="flex items-center gap-2 rounded-xl bg-violet-600 text-white px-4 py-3 hover:bg-violet-700"
              >
                <Camera size={18} />
                Sacar foto
              </button>
              <button
                onClick={() => t.handlePick('file')}
                className="flex items-center gap-2 rounded-xl bg-violet-100 text-violet-800 px-4 py-3 hover:bg-violet-200"
              >
                <ImagePlus size={18} />
                Buscar en archivos
              </button>
              <button
                onClick={() => t.setPickerForPedido(null)}
                className="mt-1 rounded-xl px-3 py-2 text-sm hover:bg-violet-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* inputs ocultos */}
      <input
        ref={t.inputCamRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={t.onFileSelected}
      />
      <input
        ref={t.inputFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={t.onFileSelected}
      />
    </main>
  );
}
