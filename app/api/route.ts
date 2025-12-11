// app/api/whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server';

type WhatsAppRequestBody = {
  to?: string;
  message?: string;
};

export async function POST(req: NextRequest) {
  try {
    let body: WhatsAppRequestBody;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: 'El cuerpo de la petición debe ser JSON válido.',
        },
        { status: 400 },
      );
    }

    const { to, message } = body;

    if (!to || !message) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Faltan parámetros obligatorios: "to" y/o "message".',
        },
        { status: 400 },
      );
    }

    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    // Si no hay credenciales configuradas, no reventamos la app, solo simulamos.
    if (!token || !phoneId) {
      console.warn(
        '[WHATSAPP] Falta WHATSAPP_TOKEN o WHATSAPP_PHONE_ID; mensaje NO enviado a Meta.',
      );
      console.warn('[WHATSAPP] MODO SIMULADO →', { to, message });

      return NextResponse.json(
        {
          ok: false,
          simulated: true,
          reason: 'Sin credenciales de WhatsApp configuradas (modo simulado).',
        },
        { status: 200 },
      );
    }

    const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;

    const waBody = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(waBody),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[WHATSAPP] Error respuesta API:', res.status, text);

      return NextResponse.json(
        {
          ok: false,
          status: res.status,
          body: text,
        },
        { status: 500 },
      );
    }

    const data = await res.json();

    return NextResponse.json(
      {
        ok: true,
        data,
      },
      { status: 200 },
    );
  } catch (e: any) {
    console.error('[WHATSAPP] Error general:', e);
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? 'Error interno inesperado.',
      },
      { status: 500 },
    );
  }
}
