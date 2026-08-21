import Stripe from 'stripe';

export interface Env {
  STRIPE_SECRET_KEY: string;
}

const ALLOWED_ORIGINS = new Set([
  'https://yourwebclub.com',
  'https://www.yourwebclub.com',
]);

const PRICE_ID = 'price_1U6fbiG7tav84tnb62iqsZMe';

function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://yourwebclub.com';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const headers = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);

    if (url.pathname !== '/create-checkout-session') {
      return new Response('Not Found', { status: 404, headers });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers });
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient(),
      apiVersion: '2025-02-24.acacia',
    });

    try {
      const session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        mode: 'subscription',
        line_items: [{ price: PRICE_ID, quantity: 1 }],
        return_url: 'https://yourwebclub.com/thank-you?session_id={CHECKOUT_SESSION_ID}',
      });

      return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
  },
};
