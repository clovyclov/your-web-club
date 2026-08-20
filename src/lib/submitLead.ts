const WEBHOOK_URL =
  'https://services.leadconnectorhq.com/hooks/TSqcO2Er7wAliwNMEQpv/webhook-trigger/f3716bf8-2fe1-46d4-97c4-f8b1c1914e4a';

export async function submitLead(data: Record<string, string>, redirectTo: string) {
  const post = fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    keepalive: true,
  }).catch(() => {});

  // Give the webhook a moment to complete, but never block the redirect on it.
  await Promise.race([post, new Promise((resolve) => setTimeout(resolve, 2500))]);

  window.location.href = redirectTo;
}
