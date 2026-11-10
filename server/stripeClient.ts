import Stripe from 'stripe';

/**
 * Stripe client from the connected Stripe integration (live account in the
 * published app, test account in development). Credentials are fetched on
 * every call so a rotated key is picked up without a redeploy.
 */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;
  if (!hostname || !xReplitToken) {
    throw new Error('The Stripe integration is not available in this environment.');
  }
  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!resp.ok) {
    throw new Error(`Failed to fetch Stripe credentials: ${resp.status} ${resp.statusText}`);
  }
  const data = await resp.json();
  const environment = process.env.REPLIT_DEPLOYMENT === "1" ? "production" : "development";
  const items: any[] = data.items ?? [];
  const connection = items.find(item => item.environment === environment) ?? (items.length === 1 ? items[0] : null);
  const secretKey = connection?.settings?.secret ?? connection?.settings?.secret_key;
  if (!secretKey) {
    throw new Error('The Stripe integration is not connected or has no secret key.');
  }
  return new Stripe(secretKey);
}
