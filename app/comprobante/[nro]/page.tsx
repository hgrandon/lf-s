// app/comprobante/[nro]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

type Params = { params: { nro: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const nro = params.nro;
  return {
    title: `Comprobante #${nro} | Lavandería Fabiola`,
    description: `Comprobante visual del pedido #${nro}`,
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

export default async function ComprobantePage({ params }: Params) {
  const nro = Number(params.nro || 0);

  if (!nro || Number.isNaN(nro)) {
    return (
      <main className="min-h-screen bg-white text-gray-900 grid place-items-center p-6">
        <div className="max-w-md w-full text-center">
          <h1 className="text-xl font-bold mb-2">N° inválido</h1>
          <p className="text-sm text-gray-600">La URL debe ser /comprobante/1234</p>
          <Link href="/base" className="inline-block mt-4 text-violet-700 font-medium">← Volver</Link>
        </div>
      </main>
    );
  }

  // Carga de datos
  const [{ data: pedido }, { data: lineas }, { data: fotos }] = await Promise.all([
    supabase
      .from("pedido")
      .select("nro, telefono, total, detalle, pagado, estado, tipo_entrega, fecha_ingreso, fecha_entrega, foto_url")
      .eq("nro", nro)
      .maybeSingle(),
    supabase.from("pedido_linea").select("articulo, cantidad, valor").eq("pedido_id", nro),
    supabase.from("pedido_foto").select("url").eq("pedido_id", nro),
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

  // Cliente por teléfono (si existe tabla cliente con PK telefono)
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

  const foto =
    (typeof pedido.foto_url === "string" && pedido.foto_url) ||
    (fotos && fotos[0]?.url) ||
    null;

  const { telFmt, telE164 } = fmtTel(String(pedido.telefono ?? ""));

  const fIng =
    pedido.fecha_ingreso ? new Date(pedido.fecha_ingreso) : new Date();
  const fEnt =
    pedido.fecha_entrega ? new Date(pedido.fecha_entrega) : null;

  const fechaCL = (d: Date | null) =>
    d ? d.toLocaleString("es-CL", { dateStyle: "medium", timeStyle: undefined }) : "—";

  const badgePago =
    pedido.pagado === true
      ? "bg-green-100 text-green-700 border-green-200"
      : pedido.pagado === false
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-gray-100 text-gray-600 border-gray-200";

  const pagoTxt =
    pedido.pagado === true ? "PAGADO" : pedido.pagado === false ? "PENDIENTE" : "—";

  const estadoTxt = String(pedido.estado ?? "—");

  // Mensaje de WhatsApp
  const msg = encodeURIComponent(
    [
      `Hola ${clienteNombre ?? ""} 👋`,
      `Tu pedido #${nro} (${estadoTxt})`,
      "",
      ...items.map(
        (it) => `• ${it.articulo} x${it.qty} = ${fmtCLP(it.qty * it.valor)}`
      ),
      "",
      `Total: ${fmtCLP(total)}`,
      pedido.detalle ? `Nota: ${pedido.detalle}` : "",
      fEnt ? `Entrega: ${fechaCL(fEnt)}` : "",
      "",
      "Gracias por preferir Lavandería Fabiola 💜",
    ]
      .filter(Boolean)
      .join("\n")
  );

  const waHref = telE164 ? `https://wa.me/${telE164}?text=${msg}` : null;
  const selfPopupHref = `/comprobante/${nro}?popup=1`;

  // Detectar query ?popup=1 en el cliente (script inline) para auto-imprimir y limpiar UI
  const autoPrintScript = `
    (function(){
      try {
        const qs = new URLSearchParams(window.location.search);
        if (qs.get("popup") === "1") {
          document.documentElement.classList.add("print-compact");
          setTimeout(() => window.print(), 300);
        }
      } catch {}
    })();
  `;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8">
      <div className="mx-auto max-w-[480px] bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-violet-700 text-white px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 grid place-items-center font-extrabold">LF</div>
            <div className="leading-tight">
              <h1 className="font-bold">Lavandería Fabiola</h1>
              <div className="text-xs text-white/80">Periodista Mario Peña Carreño #5304</div>
            </div>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full border ${badgePago}`}>
            {pagoTxt}
          </span>
        </div>

        {/* Encabezado comprobante */}
        <div className="px-5 pt-4 pb-2 text-sm">
          <div className="font-semibold text-base">Comprobante N° {nro}</div>
          <div className="text-gray-600">Estado: <span className="font-medium">{estadoTxt}</span></div>
          <div className="text-gray-600">Ingreso: {fechaCL(fIng)}{fEnt ? ` · Entrega: ${fechaCL(fEnt)}` : ""}</div>
          <div className="text-gray-600">Teléfono: {telFmt}</div>
          {clienteNombre && (
            <div className="mt-1">
              <div className="text-gray-900">{clienteNombre}</div>
              <div className="text-gray-600">{clienteDireccion ?? "—"}</div>
            </div>
          )}
          {pedido.detalle && (
            <div className="mt-2 text-gray-700">
              <span className="font-semibold">Nota: </span>{pedido.detalle}
            </div>
          )}
        </div>

        {/* Tabla */}
        <div className="px-5">
          <div className="border-t border-gray-200 my-2" />
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2">Artículo</th>
                <th className="py-2 text-right">Cant.</th>
                <th className="py-2 text-right">Valor</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((it, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-2 pr-2">{it.articulo}</td>
                    <td className="py-2 text-right">{it.qty}</td>
                    <td className="py-2 text-right">{fmtCLP(it.valor)}</td>
                    <td className="py-2 text-right">{fmtCLP(it.qty * it.valor)}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-gray-100">
                  <td colSpan={4} className="py-4 text-center text-gray-500">
                    Sin artículos
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Total */}
          <div className="flex justify-end mt-3 mb-2">
            <div className="px-4 py-2 rounded-xl bg-violet-50 text-violet-800 font-extrabold">
              Total: {fmtCLP(total)}
            </div>
          </div>
        </div>

        {/* Foto (opcional) */}
        {foto && (
          <div className="px-5 pb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto}
              alt={`pedido ${nro}`}
              className="w-full rounded-lg border border-gray-200"
              crossOrigin="anonymous"
            />
          </div>
        )}

        {/* Pie */}
        <div className="px-5 pb-6 text-center text-sm">
          <div className="text-gray-500">Lun a Vie 10:00 a 20:00 hrs.</div>
          <div className="text-violet-700 font-semibold mt-2">
            ¡Gracias por preferirnos! 💜
          </div>
          <div className="text-gray-400 text-xs mt-1">
            — Documento no válido como boleta tributaria —
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="mx-auto max-w-[480px] mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
        <button
          className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          onClick={() => typeof window !== "undefined" && window.print()}
        >
          Imprimir
        </button>

        <a
          href={selfPopupHref}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          title="Abrir en una ventana/solapa separada y auto-imprimir"
        >
          Abrir en ventana nueva
        </a>

        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            WhatsApp al cliente
          </a>
        )}

        <Link href="/base" className="px-3 py-2 rounded-lg border border-violet-300 text-violet-700 hover:bg-violet-50">
          ← Volver
        </Link>
      </div>

      {/* CSS de impresión + modo compacto para ?popup=1 */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page { margin: 10mm; }
            @media print {
              html, body { background: #fff !important; }
              a, button { display: none !important; }
              .print-hide { display: none !important; }
            }
            .print-compact body {
              background: #fff !important;
            }
            .print-compact a, .print-compact button {
              display: none !important;
            }
          `,
        }}
      />

      {/* Script inline para detectar ?popup=1 y disparar print */}
      <script dangerouslySetInnerHTML={{ __html: autoPrintScript }} />
    </main>
  );
}
