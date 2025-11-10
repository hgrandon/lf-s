// app/servicio/[nro]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

type Params = { params: { nro: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const nro = params.nro;
  return {
    title: `Servicio #${nro} | Lavandería Fabiola`,
    description: `Detalle del servicio #${nro}`,
    robots: { index: false, follow: false },
  };
}

function fmtCLP(n: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function fmtTel(raw: string | null): { telFmt: string; telE164: string | null } {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return { telFmt: "—", telE164: null };
  const local = digits.startsWith("56") ? digits.slice(2) : digits;
  const is9 = local.length === 9;
  const telFmt = is9 ? `+56 9 ${local.slice(1, 5)} ${local.slice(5)}` : `+${digits}`;
  const telE164 = is9 ? `569${local.slice(1)}` : digits.startsWith("56") ? digits : `56${local}`;
  return { telFmt, telE164 };
}

export default async function ServicioPage({ params }: Params) {
  const nro = Number(params.nro || 0);

  if (!nro || Number.isNaN(nro)) {
    return (
      <main className="min-h-screen bg-white text-gray-900 grid place-items-center p-6">
        <div className="max-w-md w-full text-center">
          <h1 className="text-xl font-bold mb-2">N° inválido</h1>
          <p className="text-sm text-gray-600">La URL debe ser /servicio/1234</p>
          <Link href="/base" className="inline-block mt-4 text-violet-700 font-medium">← Volver</Link>
        </div>
      </main>
    );
  }

  const [{ data: pedido }, { data: lineas }] = await Promise.all([
    supabase
      .from("pedido")
      .select("nro, telefono, total, detalle, pagado, estado, tipo_entrega, fecha_ingreso, fecha_entrega")
      .eq("nro", nro)
      .maybeSingle(),
    supabase.from("pedido_linea").select("articulo, cantidad, valor").eq("pedido_id", nro),
  ]);

  if (!pedido) {
    return (
      <main className="min-h-screen bg-white text-gray-900 grid place-items-center p-6">
        <div className="max-w-md w-full text-center">
          <h1 className="text-xl font-bold mb-2">No encontrado</h1>
          <p className="text-sm text-gray-600">No existe el pedido #{nro}</p>
          <Link href="/base" className="inline-block mt-4 text-violet-700 font-medium">← Volver</Link>
        </div>
      </main>
    );
  }

  // Cliente (por teléfono) — opcional
  let clienteNombre: string | null = null;
  let clienteDireccion: string | null = null;
  if (pedido.telefono) {
    const { data: cli } = await supabase
      .from("cliente")
      .select("nombre, direccion")
      .eq("telefono", pedido.telefono)
      .maybeSingle();
    clienteNombre = cli?.nombre ?? null;
    clienteDireccion = cli?.direccion ?? null;
  }

  const items = (lineas ?? []).map((l) => ({
    articulo: String(l.articulo ?? "").trim() || "SIN NOMBRE",
    qty: Number(l.cantidad ?? 0),
    valor: Number(l.valor ?? 0),
  }));

  const total =
    items.length > 0
      ? items.reduce(
          (a, it) =>
            a +
            (Number.isFinite(it.qty) ? it.qty : 0) *
              (Number.isFinite(it.valor) ? it.valor : 0),
          0
        )
      : Number(pedido.total ?? 0);

  const { telFmt, telE164 } = fmtTel(String(pedido.telefono ?? ""));

  const listoParaRetirar = ["ENTREGAR", "GUARDADO", "ENTREGADO"].includes(String(pedido.estado ?? ""));
  const estadoBadge =
    pedido.pagado === true
      ? { txt: "PAGADO", cls: "bg-green-100 text-green-700" }
      : { txt: "PENDIENTE", cls: "bg-rose-100 text-rose-700" };

  const saludo = clienteNombre ? `Hola ${clienteNombre},` : "Servicio";

  const msgWA = encodeURIComponent(
    [
      `${saludo} tu servicio #${nro} está ${listoParaRetirar ? "listo para retirar" : "en proceso"}.`,
      "",
      ...items.map((it) => `• ${it.articulo} x${it.qty} = ${fmtCLP(it.qty * it.valor)}`),
      "",
      `Total: ${fmtCLP(total)}`,
      pedido.detalle ? `Nota: ${pedido.detalle}` : "",
      telFmt ? `Contacto: ${telFmt}` : "",
      "",
      "Gracias por preferir Lavandería Fabiola 💜",
    ]
      .filter(Boolean)
      .join("\n")
  );
  const waHref = telE164 ? `https://wa.me/${telE164}?text=${msgWA}` : null;

  // Auto-imprimir si viene ?popup=1
  const autoPrintScript = `
    (function(){
      try {
        const qs = new URLSearchParams(window.location.search);
        if (qs.get("popup") === "1") {
          setTimeout(() => window.print(), 400);
        }
      } catch {}
    })();
  `;

  return (
    <main className="min-h-screen bg-[#F6F7FB] text-gray-900 p-4">
      <div className="mx-auto max-w-[520px]">
        {/* Header superior */}
        <header className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm text-gray-500">{saludo}</div>
            <h1 className="text-xl font-extrabold -mt-0.5">
              {listoParaRetirar ? "¡Tu servicio está listo!" : "Estado de tu servicio"}
            </h1>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">N° SERVICIO</div>
            <div className="text-2xl font-extrabold text-violet-600 leading-none">{nro}</div>
            {listoParaRetirar && (
              <div className="text-[11px] font-semibold text-emerald-600 mt-1">LISTO</div>
            )}
          </div>
        </header>

        {/* Tarjeta de monto y estado */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-sm text-gray-500">Monto a Pagar</div>
              <div className="text-3xl font-extrabold leading-tight">{fmtCLP(total)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Estado</div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold ${estadoBadge.cls}`}>
                {/* ícono alerta simple */}
                <svg viewBox="0 0 24 24" className="w-4 h-4 mr-1" fill="currentColor">
                  <path d="M12 2a10 10 0 100 20 10 10 0 000-20Zm1 14h-2v-2h2v2Zm0-4h-2V6h2v6Z" />
                </svg>
                {estadoBadge.txt}
              </span>
            </div>
          </div>

          {/* Banner efectivo si no está pagado */}
          {pedido.pagado !== true && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 text-sm font-semibold flex items-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" fill="currentColor">
                <path d="M21 7H3a1 1 0 00-1 1v8a1 1 0 001 1h18a1 1 0 001-1V8a1 1 0 00-1-1Zm-2 6a3 3 0 11-6 0 3 3 0 016 0Z" />
              </svg>
              SOLO PAGO EFECTIVO
              <span className="font-normal ml-1 text-amber-700">· Por favor, ten el monto exacto.</span>
            </div>
          )}
        </section>

        {/* Info de retiro */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <h2 className="font-bold text-gray-800 mb-3">Información de Retiro</h2>

          <div className="flex items-start gap-3 mb-3">
            <svg viewBox="0 0 24 24" className="w-5 h-5 mt-0.5 text-violet-600" fill="currentColor">
              <path d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/>
            </svg>
            <div>
              <div className="text-sm text-gray-500">Dirección</div>
              <div className="font-medium text-gray-900">
                {clienteDireccion ?? "Periodista Mario Peña Carreño #5304"}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <svg viewBox="0 0 24 24" className="w-5 h-5 mt-0.5 text-violet-600" fill="currentColor">
              <path d="M12 7a1 1 0 0 1 1 1v4.06l2.47 1.42a1 1 0 1 1-1 1.74l-3-1.73A1 1 0 0 1 11 13V8a1 1 0 0 1 1-1Zm0-5a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Z"/>
            </svg>
            <div>
              <div className="text-sm text-gray-500">Horario de Atención</div>
              <div className="font-medium text-gray-900">Lunes a Viernes de 10:00 a 20:00 hrs.</div>
            </div>
          </div>
        </section>

        {/* Detalle del servicio */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="p-4">
            <h2 className="font-bold text-gray-800">Detalle del Servicio</h2>
          </div>
          <div className="border-t border-gray-100" />
          <div className="p-4">
            {items.length ? (
              <div className="space-y-3">
                {items.map((it, i) => (
                  <div key={i} className="flex items-start justify-between">
                    <div className="pr-2">
                      <div className="font-semibold text-gray-900">{it.articulo} {fmtCLP(it.valor)}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Cantidad: <span className="font-medium text-gray-700">{it.qty}</span> · Valor unitario: <span className="font-medium text-gray-700">{fmtCLP(it.valor)}</span>
                      </div>
                    </div>
                    <div className="font-extrabold text-gray-900">{fmtCLP(it.qty * it.valor)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500">Sin artículos</div>
            )}
          </div>
          <div className="border-t border-gray-100" />
          <div className="p-4 flex items-center justify-between text-sm">
            <div className="font-bold tracking-wide">TOTAL</div>
            <div className="font-extrabold text-violet-600">{fmtCLP(total)}</div>
          </div>
        </section>

        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm mb-6">
          <button
            className="px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
            onClick={() => typeof window !== "undefined" && window.print()}
          >
            Imprimir
          </button>

          <a
            href={`/servicio/${nro}?popup=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
          >
            Abrir en ventana nueva
          </a>

          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
            >
              WhatsApp al cliente
            </a>
          )}

          <Link href="/base" className="px-3 py-2 rounded-lg border border-violet-300 text-violet-700 bg-white hover:bg-violet-50">
            ← Volver
          </Link>
        </div>

        <footer className="text-center text-[13px] text-gray-500 mb-8">
          Gracias por su preferencia{clienteNombre ? `, ${clienteNombre}` : ""}.
        </footer>
      </div>

      {/* Estilos de impresión mínimos */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page { margin: 10mm; }
            @media print {
              html, body { background: #fff !important; }
              a, button { display: none !important; }
            }
          `,
        }}
      />
      <script dangerouslySetInnerHTML={{ __html: autoPrintScript }} />
    </main>
  );
}
