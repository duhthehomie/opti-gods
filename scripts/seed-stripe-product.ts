/**
 * Opti Gods — Stripe Product Seed Script
 *
 * Run this ONCE after setting up your Stripe account to create the Pro product.
 * Usage: npx tsx scripts/seed-stripe-product.ts
 *
 * Prerequisites:
 *   1. Create a Stripe account at https://stripe.com
 *   2. Get your Secret Key from https://dashboard.stripe.com/apikeys
 *   3. Set STRIPE_SECRET_KEY in your environment variables
 *
 * After running:
 *   - Copy the printed STRIPE_PRICE_ID and add it to your environment variables
 *   - Set VITE_STRIPE_ENABLED=true to show the card payment button in the UI
 */

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error("\nERROR: STRIPE_SECRET_KEY environment variable not set.");
  console.error("Add it in your Replit Secrets panel, then re-run this script.\n");
  process.exit(1);
}

async function seed() {
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(secretKey!, { apiVersion: "2024-06-20" });

  console.log("\n  Opti Gods PRO — Stripe Product Setup");
  console.log("  =====================================\n");

  // Check if product already exists
  const existing = await stripe.products.search({ query: "name:'Opti Gods PRO'" });
  if (existing.data.length > 0) {
    const product = existing.data[0];
    const prices = await stripe.prices.list({ product: product.id, active: true });
    const price = prices.data[0];
    console.log("  [EXISTS] Product already created.");
    console.log(`  Product ID:  ${product.id}`);
    console.log(`  Price ID:    ${price?.id || "No active price"}`);
    console.log("\n  Add this to your environment variables:");
    console.log(`  STRIPE_PRICE_ID=${price?.id || "<no-price>"}`);
    console.log("  VITE_STRIPE_ENABLED=true\n");
    return;
  }

  // Create the product
  const product = await stripe.products.create({
    name: "Opti Gods PRO",
    description: "Lifetime access to 130+ Windows 10/11 optimizations — Registry, Network, GPU, Memory, FiveM, Fortnite, and 10+ game packs. One script. One time.",
    metadata: { product_type: "optigods_pro_lifetime" },
  });

  // Create the price ($9.99 one-time)
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 999,
    currency: "usd",
  });

  console.log("  [CREATED] Opti Gods PRO product");
  console.log(`  Product ID:  ${product.id}`);
  console.log(`  Price ID:    ${price.id}`);
  console.log(`  Price:       $${(price.unit_amount! / 100).toFixed(2)} USD (one-time)`);
  console.log("\n  ✅ Copy these into your environment variables:");
  console.log(`  STRIPE_PRICE_ID=${price.id}`);
  console.log("  VITE_STRIPE_ENABLED=true");
  console.log("\n  Then reload your app — the 'Pay with Card' button will appear.\n");
}

seed().catch((err) => {
  console.error("\nStripe error:", err.message, "\n");
  process.exit(1);
});
