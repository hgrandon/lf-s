// app/lib/utils/shareToWhatsApp.ts
import html2canvas from 'html2canvas';

type PedidoMin = {
  id: number;
  cliente?: string | null;
  pagado?: boolean | null;
  total?: number | null;
  items?: { qty: number; valor: number }[];
  telefono?: string | null;
};

function saludoSegunHora(d = new Date()) {
  return d.getHours() < 12 ? 'Buenos días' : 'Buenas tardes';
}

function CLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

/** Normaliza teléfonos chilenos a E.164: 56XXXXXXXXX */
export function toE164CL(raw?: string | null) {
  if (!raw) return undefined;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return undefined;
  const sinCC = digits.replace(/^0?56/, '').replace(/^0/, '');
  return `56${sinCC}`;
}

/** Captura un nodo HTML como PNG (Blob) con fondo blanco y buena nitidez */
export async function captureNodeAsPng(node: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(node, {
    backgroundColor: '#ffffff',
    scale: 2,          // nitidez
    useCORS: true,     // permite imágenes externas con CORS
    logging: false,
  });
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
}

/** Comparte (Web Share nivel 2) o descarga imagen y abre WhatsApp con el texto */
export async function shareOrDownloadImage(opts: {
  blob: Blob;
  text: string;
  phoneE164?: string;
}) {
  const { blob, text, phoneE164 } = opts;

  const file = new File([blob], `comprobante-${Date.now()}.png`, { type: 'image/png' });

  // Web Share API (móvil moderno)
  // @ts-expect-error: detección runtime
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      // @ts-expect-error: detección runtime
      await navigator.share({ files: [file], text });
      return;
    } catch {
      // cancelado o no soportado -> sigo al fallback
    }
  }

  // Fallback: descargar imagen y abrir WhatsApp Web con texto
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'comprobante.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  const encoded = encodeURIComponent(text);
  const wa = phoneE164 ? `https://wa.me/${phoneE164}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  window.open(wa, '_blank');
}

/** Flujo completo: arma texto + captura nodo + comparte/descarga y abre WhatsApp */
export async function shareComprobanteWhatsApp(params: {
  node: HTMLElement;     // contenedor a capturar (la tarjeta del pedido)
  pedido: PedidoMin;
}) {
  const { node, pedido } = params;

  // total calculado por items si viene; si no, usa total del pedido
  const totalCalc = (pedido.items?.length ?? 0) > 0
    ? pedido.items!.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.valor) || 0), 0)
    : Number(pedido.total || 0);

  const saludo = saludoSegunHora();
  const nombre = (pedido.cliente || '').toString().trim() || 'Cliente';
  const cuerpo =
    `${saludo} ${nombre}, tu pedido N° ${pedido.id} ` +
    `está ${pedido.pagado ? 'PAGADO' : 'PENDIENTE'}.\n` +
    `Total: ${CLP(totalCalc)}.\n` +
    `Retiro en Lavandería Fabiola.\n` +
    `Horario: Lunes a Viernes 10:00 a 20:00 hrs.\n` +
    `¡Gracias por preferirnos!`;

  const blob = await captureNodeAsPng(node);
  const phoneE164 = toE164CL(pedido.telefono);
  await shareOrDownloadImage({ blob, text: cuerpo, phoneE164 });
}
