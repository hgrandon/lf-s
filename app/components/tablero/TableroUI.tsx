import { ReactNode, useState } from 'react';
import { useTableroPedidos, TableroOpciones, PedidoEstado, normalizarDireccion, toE164CL } from './useTableroPedidos';
import {
  Loader2,
  AlertTriangle,
  User,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Table,
  Archive,
  Camera,
  ImagePlus,
  Printer,
  MapPin,
  Home,
  Store,
  Droplet,
  WashingMachine,
  CheckCircle2,
  Truck,
  PackageCheck,
  Maximize,
  X,
  MessageCircle,
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
  const [fullscreenFoto, setFullscreenFoto] = useState<string | null>(null);

  const totalPedidos = t.pedidos.length;
  const totalMonto = t.pedidos.reduce((acc, p) => {
    if (p.items?.length) return acc + p.items.reduce((a, it) => a + it.qty * it.valor, 0);
    return acc + Number(p.total ?? 0);
  }, 0);

  const getEstadoIcon = () => {
    switch (opciones.estadoBase) {
      case 'LAVAR': return <Droplet size={26} />;
      case 'LAVANDO': return <WashingMachine size={26} />;
      case 'GUARDADO': return <CheckCircle2 size={26} />;
      case 'ENTREGAR': return <Truck size={26} />;
      case 'ENTREGADO': return <PackageCheck size={26} />;
      default: return <h1 className="font-bold text-base lg:text-xl truncate">{titulo}</h1>;
    }
  };

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
        <div className="flex flex-col gap-1 z-10 relative max-w-[40%] overflow-hidden">
          <div className="flex items-center gap-2 text-white" title={titulo}>
            {getEstadoIcon()}
          </div>
          <div className="text-[11px] lg:text-xs text-white/80 flex items-center gap-2">
            <span className="whitespace-nowrap">{totalPedidos} pedidos</span>
            <span className="opacity-60 hidden sm:inline">•</span>
            <span className="whitespace-nowrap hidden sm:inline">Total {CLP.format(totalMonto)}</span>
          </div>
        </div>

        {pedidoAbierto && (
          <div className="absolute left-1/2 -translate-x-1/2 font-black text-3xl lg:text-4xl text-white drop-shadow-md">
            {pedidoAbierto.id}
          </div>
        )}

        <button
          onClick={() => router.push(backURL)}
          className="text-xs lg:text-sm text-white/90 hover:text-white z-10 relative"
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
                          <span className="ml-2 inline-flex items-center justify-center bg-black/30 w-6 h-6 rounded-full align-middle text-amber-400" title="Retiro en Local">
                            <Archive size={14} />
                          </span>
                        )}
                        {p.tipo_entrega === 'DOMICILIO' && (
                          <span className="ml-2 inline-flex items-center justify-center bg-black/30 w-6 h-6 rounded-full align-middle text-sky-400" title="Entrega a Domicilio">
                            <Truck size={14} />
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] lg:text-xs uppercase text-white/85">
                        {p.cliente}{' '}
                        {p.telefono && `• +${toE164CL(p.telefono)?.slice(2) ?? p.telefono}`}
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
                  <div className="px-3 sm:px-4 lg:px-6 pb-4 pt-1">
                    {/* Action buttons & Details Toggle */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          t.setOpenDetail((prev) => ({ ...prev, [p.id]: !prev[p.id] }));
                        }}
                        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white font-semibold text-xs sm:text-sm shadow-sm transition-colors"
                      >
                        <Table size={15} />
                        <span>Detalles</span>
                        {detOpen ? <ChevronDown size={16} className="opacity-70" /> : <ChevronRight size={16} className="opacity-70" />}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            t.goEdit(p.id);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs lg:text-sm font-semibold rounded-lg bg-violet-600/90 hover:bg-violet-600 text-white shadow-sm border border-violet-400/50 transition-colors"
                        >
                          <Archive size={15} />
                          <span className="hidden sm:inline">Editar</span>
                        </button>

                        {permiteImprimirRotulo && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/rotulos?nro=${p.id}&copies=1`);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs lg:text-sm font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white shadow-sm border border-white/20 transition-colors"
                          >
                            <Printer size={15} />
                            <span className="hidden sm:inline">Rótulo</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {detOpen && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Table Details */}
                        <div className="bg-black/20 rounded-2xl p-3 lg:p-4 border border-white/10 mb-3 shadow-inner">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs lg:text-sm text-left">
                              <thead>
                                <tr className="text-white/50 border-b border-white/10 uppercase text-[10px] tracking-wider">
                                  <th className="pb-2 font-semibold w-[45%]">Artículo</th>
                                  <th className="pb-2 font-semibold text-center w-[15%] hidden sm:table-cell">Valor</th>
                                  <th className="pb-2 font-semibold text-center w-[15%]">Can.</th>
                                  <th className="pb-2 font-semibold text-right w-[25%] gap-2">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {p.items?.length ? (
                                  p.items.map((it, idx) => (
                                    <tr key={idx} className="text-white/90">
                                      <td className="py-2.5 pr-2 truncate max-w-[140px] font-medium text-white" title={it.articulo}>
                                        {it.articulo}
                                      </td>
                                      <td className="py-2.5 text-center text-white/70 hidden sm:table-cell">
                                        {CLP.format(it.valor)}
                                      </td>
                                      <td className="py-2.5 text-center">
                                        <span className="bg-white/10 px-2 py-0.5 rounded text-white/90 text-[11px] font-bold">{it.qty}</span>
                                      </td>
                                      <td className="py-2.5 text-right font-semibold text-white">
                                        {CLP.format(it.qty * it.valor)}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td className="py-4 text-center text-white/50" colSpan={4}>
                                      Sin artículos en este pedido.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                          
                          <div className="mt-3 pt-3 border-t border-white/10 flex justify-end">
                            <div 
                              className="inline-block px-4 py-2 bg-gradient-to-r from-violet-600/40 to-fuchsia-600/40 border border-white/20 rounded-xl font-bold text-sm lg:text-base text-white shadow-md cursor-pointer hover:from-violet-600/60 hover:to-fuchsia-600/60 transition-colors"
                              onClick={() => t.setAskEditForId(p.id)}
                              title="Doble clic para editar pedido total"
                            >
                              Total: {CLP.format(totalCalc)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Image Section: FUERA del acordeon de Detalles */}
                    <div className="bg-black/20 rounded-2xl p-2 border border-white/10 shadow-inner mt-4">
                      {(() => {
                        const fotosList = (p.fotos && p.fotos.length > 0) ? p.fotos : (p.foto_url ? [p.foto_url] : []);
                        const tieneFotos = fotosList.length > 0 && !t.imageError[p.id];
                        const slideIdx = t.currentSlide[p.id] || 0;
                        const validIdx = slideIdx >= 0 && slideIdx < fotosList.length ? slideIdx : 0;
                        const actualFoto = fotosList[validIdx];

                        return tieneFotos ? (
                          <div
                            className="relative w-full aspect-[4/3] sm:aspect-video rounded-xl overflow-hidden cursor-zoom-in group border border-white/5"
                            onDoubleClick={() => t.openPickerFor(p.id)}
                            title="Doble clic para adjuntar otra foto"
                          >
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setFullscreenFoto(actualFoto);
                              }}
                              className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/80 backdrop-blur-md z-10 transition-all active:scale-95"
                              title="Ampliar imagen"
                            >
                              <Maximize size={16} />
                            </button>
                            <img
                              src={actualFoto}
                              alt={`Foto pedido ${p.id}`}
                              className="w-full h-full object-contain bg-black/40 transition-transform duration-300 group-hover:scale-[1.02]"
                              onError={() => t.setImageError((prev) => ({ ...prev, [p.id]: true }))}
                            />
                            
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                              <span className="text-white text-xs font-semibold bg-black/60 px-3 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-md">
                                <Camera size={14} /> Adjuntar foto
                              </span>
                            </div>

                            {fotosList.length > 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    t.changeSlide(p.id, -1);
                                  }}
                                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/80 backdrop-blur-md transition-all active:scale-95"
                                >
                                  <ChevronLeft size={20} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    t.changeSlide(p.id, 1);
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/80 backdrop-blur-md transition-all active:scale-95"
                                >
                                  <ChevronRight size={20} />
                                </button>
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-md font-bold tracking-wider pointer-events-none">
                                  {validIdx + 1} / {fotosList.length}
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => t.openPickerFor(p.id)}
                            className="w-full flex flex-col items-center justify-center gap-3 py-8 rounded-xl border border-dashed border-white/20 text-white/50 hover:text-white hover:bg-white/5 hover:border-white/40 transition-all"
                            title="Agregar imagen"
                          >
                            <div className="p-3 bg-white/5 rounded-full">
                              <ImagePlus size={20} />
                            </div>
                            <span className="text-xs sm:text-sm font-medium">Toca para adjuntar una foto</span>
                          </button>
                        );
                      })()}
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
            t.saving ? (
              <div className="mt-2 text-center text-xs text-white/90">
                <span className="inline-flex items-center gap-1">
                  <Loader2 size={14} className="animate-spin" /> Guardando…
                </span>
              </div>
            ) : <div className="mt-2 h-[18px]"></div>
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

      {/* Modal Guardado + WhatsApp */}
      {t.askWaForGuardado && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
          onClick={() => t.setAskWaForGuardado(null)}
        >
          <div
            className="w-[380px] max-w-[92vw] rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-2 text-emerald-600">
              <CheckCircle2 size={24} />
              <h3 className="text-lg font-bold">Pedido #{t.askWaForGuardado.id} Guardado</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6 font-medium">
              Antes de continuar, ¿Deseas enviar el WhatsApp automático al cliente avisando que está listo para retiro?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  const p = t.askWaForGuardado;
                  if (!p) return;
                  t.setAskWaForGuardado(null);
                  await t.changeEstado(p.id, 'GUARDADO');
                  t.sendComprobanteLink(p);
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-white font-bold px-4 py-3.5 hover:bg-emerald-600 transition-all active:scale-95"
              >
                <div className="bg-white/20 p-1 rounded-full"><MessageCircle size={16} /></div>
                Sí, Guardar y Enviar Aviso
              </button>
              <button
                onClick={async () => {
                  const p = t.askWaForGuardado;
                  if (!p) return;
                  t.setAskWaForGuardado(null);
                  await t.changeEstado(p.id, 'GUARDADO');
                }}
                className="rounded-xl border border-slate-200 text-slate-700 font-bold px-4 py-3.5 hover:bg-slate-50 transition-all active:scale-95"
              >
                Solo Guardar (Sin Avisar)
              </button>
              <button
                onClick={() => t.setAskWaForGuardado(null)}
                className="rounded-xl mt-1 text-slate-500 font-semibold px-4 py-2 hover:bg-slate-50 transition-all"
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

      {/* Modal Foto Fullscreen */}
      {fullscreenFoto && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-2 sm:p-4 backdrop-blur-sm"
          onClick={() => setFullscreenFoto(null)}
        >
          <button 
            className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-white/10 p-3 rounded-full text-white/80 hover:bg-white/20 hover:text-white transition-colors"
            onClick={() => setFullscreenFoto(null)}
          >
            <X size={24} />
          </button>
          <img
            src={fullscreenFoto}
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </main>
  );
}
