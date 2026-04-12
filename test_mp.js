import { MercadoPagoConfig, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({ accessToken: 'APP_USR-6517124737426968-041208-23b49db5f8ecc61bdc057bb0f0c16a10-152452771' });
const preference = new Preference(client);

async function test() {
  try {
    const response = await preference.create({
      body: {
        items: [
          {
            id: 'general',
            title: `Servicio de Lavandería N° 123`,
            quantity: 1,
            unit_price: 1000,
            currency_id: 'CLP',
          },
        ],
        external_reference: '123',
        back_urls: {
          success: 'https://lf-s.vercel.app',
          failure: 'https://lf-s.vercel.app',
          pending: 'https://lf-s.vercel.app',
        },
        auto_return: 'approved',
        statement_descriptor: 'LAV Fabiola',
      },
    });
    console.log('Success:', response.init_point);
  } catch (error) {
    console.error('MP Error:', error);
  }
}

test();
