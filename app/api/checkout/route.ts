import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'Falta token del servicio' }, { status: 400 });
    }

    // 1. Obtener datos del pedido
    const { data: pedido, error: pedErr } = await supabase
      .from('pedido')
      .select('nro, total, pagado, telefono, detalle')
      .eq('token_servicio', token)
      .single();

    if (pedErr || !pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    if (pedido.pagado) {
      return NextResponse.json({ error: 'Este pedido ya se encuentra pagado' }, { status: 400 });
    }

    // 2. Obtener lineas
    const { data: lineas, error: lineasErr } = await supabase
      .from('pedido_linea')
      .select('id, articulo, cantidad, valor')
      .eq('pedido_id', pedido.nro);

    let items = [];
    if (!lineasErr && lineas && lineas.length > 0) {
      items = lineas.map((l) => ({
        id: String(l.id || l.articulo),
        title: l.articulo.toUpperCase(),
        quantity: Number(l.cantidad) || 1,
        unit_price: Number(l.valor) || 0,
        currency_id: 'CLP',
      }));
    } else {
      items = [
        {
          id: 'general',
          title: `Servicio de Lavandería N° ${pedido.nro}`,
          quantity: 1,
          unit_price: Number(pedido.total) || 0,
          currency_id: 'CLP',
        },
      ];
    }

    // Validador de suma (a veces items da 0 si es nulo, evitar error MP)
    if (items.reduce((acc, it) => acc + it.unit_price * it.quantity, 0) <= 0) {
        return NextResponse.json({ error: 'El total a pagar no es válido.' }, { status: 400 });
    }

    // 3. Crear preferencia
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
    const preference = new Preference(client);

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://lf-s.vercel.app';
    const callbackUrl = `${origin}/servicio?token=${token}`;

    const response = await preference.create({
      body: {
        items,
        external_reference: pedido.nro.toString(),
        back_urls: {
          success: callbackUrl,
          failure: callbackUrl,
          pending: callbackUrl,
        },
        auto_return: 'approved',
        statement_descriptor: 'LAV Fabiola',
      },
    });

    return NextResponse.json({ init_point: response.init_point });
  } catch (error: any) {
    console.error('MP Checkout Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
