import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    
    // Mercado Pago envia id de pago en query string (data.id o id)
    const topic = url.searchParams.get('topic') || url.searchParams.get('type');
    const id = url.searchParams.get('data.id') || url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: true, warning: 'No id provided' });
    }

    if (topic === 'payment') {
      const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
      const payment = new Payment(client);
      
      const paymentData = await payment.get({ id });

      if (paymentData.status === 'approved') {
        const orderId = paymentData.external_reference;
        if (orderId) {
          // Actualizamos el pedido a pagado = true
          // Se usa la anon_key del backend. En escenarios de alta seguridad, 
          // usar SUPABASE_SERVICE_ROLE_KEY aseguraría bypassear el RLS, pero 
          // usaremos la default instanciada.
          const { error } = await supabase
            .from('pedido')
            .update({ pagado: true, metodo_pago: 'MERCADO PAGO' })
            .eq('nro', orderId);

          if (error) {
            console.error('Error updating order:', error);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('MP Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
