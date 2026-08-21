import Stripe from 'stripe';

export interface Env {
  STRIPE_SECRET_KEY: string;
  TURNSTILE_SECRET_KEY?: string;
  GHL_WEBHOOK_URL: string;
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

function json(data: unknown, headers: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

async function handleCreateCheckoutSession(env: Env, headers: Record<string, string>): Promise<Response> {
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

    return json({ clientSecret: session.client_secret }, headers);
  } catch (err) {
    return json({ error: (err as Error).message }, headers, 500);
  }
}

async function verifyTurnstile(token: string | undefined, secretKey: string, ip: string | null): Promise<boolean> {
  if (!token) return false;

  const body = new URLSearchParams({ secret: secretKey, response: token });
  if (ip) body.set('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const outcome = (await res.json()) as { success: boolean };
  return outcome.success === true;
}

async function handleSubmitLead(request: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  let payload: Record<string, unknown>;

  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, headers, 400);
  }

  // Honeypot: a hidden field real users never fill in. If it has a value, silently
  // pretend success so bots don't learn to avoid it, but drop the submission.
  if (typeof payload.website === 'string' && payload.website.trim() !== '') {
    return json({ ok: true }, headers);
  }

  const requiredFields = ['fullName', 'businessName', 'phone', 'email'];
  const missing = requiredFields.filter((field) => !payload[field] || typeof payload[field] !== 'string');
  if (missing.length > 0) {
    return json({ error: `Missing fields: ${missing.join(', ')}` }, headers, 400);
  }

  if (env.TURNSTILE_SECRET_KEY) {
    const token = typeof payload.turnstileToken === 'string' ? payload.turnstileToken : undefined;
    const ip = request.headers.get('CF-Connecting-IP');
    const verified = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, ip);
    if (!verified) {
      return json({ error: 'Bot verification failed' }, headers, 403);
    }
  }

  const { turnstileToken, website, ...leadData } = payload;

  try {
    await fetch(env.GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadData),
    });
    return json({ ok: true }, headers);
  } catch (err) {
    return json({ error: (err as Error).message }, headers, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const headers = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers });
    }

    if (url.pathname === '/create-checkout-session') {
      return handleCreateCheckoutSession(env, headers);
    }

    if (url.pathname === '/submit-lead') {
      return handleSubmitLead(request, env, headers);
    }

    return new Response('Not Found', { status: 404, headers });
  },
};
