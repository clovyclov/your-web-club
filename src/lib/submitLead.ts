import { WORKER_BASE_URL } from './workerConfig';

export async function submitLead(data: Record<string, string>, redirectTo: string) {
  const post = fetch(`${WORKER_BASE_URL}/submit-lead`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    keepalive: true,
  }).catch(() => {});

  // Give the webhook a moment to complete, but never block the redirect on it.
  await Promise.race([post, new Promise((resolve) => setTimeout(resolve, 2500))]);

  window.location.href = redirectTo;
}
