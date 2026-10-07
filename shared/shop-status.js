/**
 * Whether the public online shop is taking orders.
 * Stored on a Stripe customer so the switch survives on Vercel.
 * Missing record means the shop is open.
 */

const CONTROL_EMAIL = "shop-status@ginhouseflowers.co.uk";
const CACHE_MS = 8000;

let cache = { at: 0, open: true };

function stripeClient() {
  const secretKey = String(process.env.STRIPE_SECRET_KEY || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  if (!secretKey || secretKey.startsWith("pk_")) return null;
  return require("stripe")(secretKey);
}

function remember(open) {
  cache = { at: Date.now(), open: open };
  return open;
}

async function findControlCustomer(stripe) {
  const listed = await stripe.customers.list({ email: CONTROL_EMAIL, limit: 1 });
  return listed.data && listed.data[0] ? listed.data[0] : null;
}

async function getShopOpen(force) {
  if (!force && Date.now() - cache.at < CACHE_MS) return cache.open;
  const stripe = stripeClient();
  if (!stripe) return remember(true);
  try {
    const customer = await findControlCustomer(stripe);
    const open = !customer || !customer.metadata || customer.metadata.shop_open !== "no";
    return remember(open);
  } catch (err) {
    console.error("Shop status read failed:", err.message);
    return cache.at ? cache.open : true;
  }
}

async function setShopOpen(open) {
  const stripe = stripeClient();
  if (!stripe) {
    return { ok: false, error: "Card payments are not connected, so the shop switch cannot be saved." };
  }
  const next = open ? "yes" : "no";
  try {
    const customer = await findControlCustomer(stripe);
    if (!customer) {
      await stripe.customers.create({
        email: CONTROL_EMAIL,
        name: "Shop on/off switch",
        description: "Controls whether ginhouseflowers.co.uk takes online orders. Do not delete.",
        metadata: { shop_open: next, gin_house_shop_switch: "yes" },
      });
    } else {
      await stripe.customers.update(customer.id, {
        metadata: { shop_open: next, gin_house_shop_switch: "yes" },
      });
    }
    remember(Boolean(open));
    return { ok: true, open: Boolean(open) };
  } catch (err) {
    console.error("Shop status save failed:", err.message);
    return { ok: false, error: "Could not save the shop switch. Please try again." };
  }
}

module.exports = { getShopOpen, setShopOpen };
