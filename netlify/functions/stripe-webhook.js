const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { sendOrderNotificationEmail } = require("../../shared/order-email");
const { consumePaidOrder } = require("../../shared/stock-store");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || !process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 503, body: "Webhook not configured" };
  }

  const signature = event.headers["stripe-signature"];
  let rawBody = event.body;
  if (event.isBase64Encoded && rawBody) {
    rawBody = Buffer.from(rawBody, "base64").toString("utf8");
  }

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: "Invalid signature" };
  }

  let emailError = "";
  let emailNote = "";
  let customerReceipt = false;

  if (stripeEvent.type === "checkout.session.completed") {
    const sessionId = stripeEvent.data.object.id;

    try {
      const emailResult = await sendOrderNotificationEmail(stripe, sessionId);
      if (!emailResult.ok) emailError = emailResult.error || "Order email was not sent.";
      else {
        customerReceipt = true;
        emailNote = emailResult.resend || "";
      }
    } catch (err) {
      emailError = err.message || "Order email was not sent.";
      console.error("Order notification email error:", emailError);
    }

    console.log("Order paid:", sessionId);

    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
        limit: 100,
        expand: ["data.price.product"],
      });
      const lines = (lineItems.data || [])
        .map(function (item) {
          const product = item.price && item.price.product;
          const meta = product && typeof product === "object" ? product.metadata : null;
          if (!meta || !meta.product_id) return null;
          return { productId: meta.product_id, quantity: item.quantity || 1 };
        })
        .filter(Boolean);
      await consumePaidOrder(sessionId, lines);
    } catch (err) {
      console.error("Stock update error:", err.message);
    }
  }

  if (emailError) {
    return {
      statusCode: 500,
      body: JSON.stringify({ received: true, email: emailError }),
    };
  }

  const body = { received: true };
  if (customerReceipt) body.customer = "stripe-receipt";
  if (emailNote) body.resend = emailNote;
  return { statusCode: 200, body: JSON.stringify(body) };
};
