// lib/utils/shareToWhatsApp.ts
export async function shareOrDownloadImage(opts: {
  blob: Blob;
  text: string;
  phoneE164?: string; // Ejemplo: "56999999999"
}) {
  const { blob, text, phoneE164 } = opts;

  // Crear archivo de imagen a compartir
  const file = new File([blob], `comprobante-${Date.now()}.png`, { type: 'image/png' });

  // Web Share API (móvil moderno)
  const navAny = navigator as any;
  if (navAny?.share && navAny?.canShare && navAny.canShare({ files: [file] })) {
    try {
      await navAny.share({ files: [file], text });
      return;
    } catch {
      // cancelado o no soportado → fallback
    }
  }

  // Fallback: descargar imagen y abrir WhatsApp Web con texto
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'comprobante.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const encoded = encodeURIComponent(text);
  const phone = phoneE164 ? phoneE164.replace(/\D/g, '') : '';
  const wa = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  window.open(wa, '_blank');
}
