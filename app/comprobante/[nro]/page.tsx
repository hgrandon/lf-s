// app/comprobante/[nro]/page.tsx
import { Metadata } from "next";
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

  const [{ data: pedido }, { data: lineas }, { data: fotos }] = await Promise.all([
    supabase
      .from("pedido")
      .select("nro, telefono, total, detalle, pagado, estado, foto_url")
      .eq("nro", nro)
      .maybeSingle(),
    supabase
      .from("pedido_linea")
      .select("articulo, cantidad, valor")
      .eq("pedido_id", nro),
    supabase
      .from("pedido_foto")
      .select("url")
      .eq("pedido_id", nro),
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

  const items = (lineas ?? []).map((l) => ({
    articulo: String(l.articulo ?? "").trim() || "SIN NOMBRE",
    qty: Number(l.cantidad ?? 0),
    valor: Number(l.valor ?? 0),
  }));

  const CLP = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });

  const total =
    items.length > 0
      ? items.reduce((a, it) => a + (Number.isFinite(it.qty) ? it.qty : 0) * (Number.isFinite(it.valor) ? it.valor : 0), 0)
      : Number(pedido.total ?? 0);

  const foto =
    (typeof pedido.foto_url === "string" && pedido.foto_url) ||
    (fotos && fotos[0]?.url) ||
    null;

  // Teléfono legible: quita prefijo 56 si viene duplicado, y agrupa
  const telRaw = String(pedido.telefono ?? "").replace(/\D/g, "");
  const telCL = telRaw.startsWith("56") ? telRaw.slice(2) : telRaw;
  const telFmt =
    telCL.length === 9
      ? `+56 9 ${telCL.slice(1, 5)} ${telCL.slice(5)}`
      : telRaw
      ? `+${telRaw}`
      : "—";

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8">
      <div className="mx-auto max-w-[420px] bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-violet-700 text-white px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 grid place-items-center font-extrabold">LF</div>
          <h1 className="font-bold">Lavandería Fabiola</h1>
        </div>

        {/* Encabezado comprobante */}
        <div className="px-5 pt-4 pb-2 text-sm">
          <div className="font-semibold">Comprobante N° {nro}</div>
          <div className="text-gray-600">Teléfono: {telFmt}</div>
          <div className="text-gray-600">Fecha: {new Date().toLocaleString("es-CL")}</div>
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
                    <td className="py-2 text-right">{CLP.format(it.valor)}</td>
                    <td className="py-2 text-right">{CLP.format(it.qty * it.valor)}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-gray-100">
                  <td colSpan={4} className="py-4 text-center text-gray-500">Sin artículos</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Total */}
          <div className="flex justify-end mt-3 mb-2">
            <div className="px-4 py-2 rounded-xl bg-violet-50 text-violet-800 font-extrabold">
              Total: {CLP.format(total)}
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
          <div className="text-gray-700">
            Retiro en:<br />Periodista Mario Peña Carreño #5304
          </div>
          <div className="text-gray-500 mt-1">Lun a Vie 10:00 a 20:00 hrs.</div>
          <div className="text-violet-700 font-semibold mt-3">Gracias por preferir Lavandería Fabiola</div>
          <div className="text-gray-400 text-xs mt-1">— Documento no válido como boleta tributaria —</div>
        </div>
      </div>

      <div className="text-center mt-4">
        <Link href="/base" className="text-violet-700 font-medium">← Volver</Link>
      </div>

      {/* CSS de impresión SIN styled-jsx */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page { margin: 10mm; }
            @media print {
              html, body { background: #fff !important; }
            }
          `,
        }}
      />
    </main>
  );
}
