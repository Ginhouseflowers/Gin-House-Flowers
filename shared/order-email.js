/**
 * Order notification email when Stripe Checkout completes.
 * Uses Resend (https://resend.com) — set RESEND_API_KEY and ORDER_NOTIFY_EMAIL in Netlify.
 */

const COLOUR_LABELS = {
  bright: "Bright",
  pastel: "Pastel",
  none: "No preference",
  seasonal: "Seasonal",
  other: "Other",
};

function formatMoneyFromPence(pence) {
  return "£" + (Number(pence) / 100).toFixed(2);
}

const { escapeHtml, sendResendEmail } = require("./resend-mail");

function getCustomFieldValue(field) {
  if (!field) return "";
  if (field.text && field.text.value) return String(field.text.value).trim();
  if (field.dropdown && field.dropdown.value) return String(field.dropdown.value).trim();
  if (typeof field.value === "string") return field.value.trim();
  return "";
}

function formatGbpAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "£0.00";
  return "£" + amount.toFixed(2);
}

function formatUkDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return "";
  const parts = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])));
}

function formatClock(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "pm" : "am";
  hour = hour % 12 || 12;
  return hour + ":" + minute + suffix;
}

function formatFulfilment(metadata) {
  metadata = metadata || {};
  const fulfilment = metadata.fulfilment || "";
  const lines = [];

  if (fulfilment === "collection") {
    lines.push("Collect from the shop");
    lines.push("Date: " + (formatUkDate(metadata.collection_date) || "Not given"));
    lines.push("Time: " + (formatClock(metadata.collection_time) || "Not given"));
    lines.push("Delivery cost: £0.00");
  } else if (fulfilment === "delivery") {
    lines.push("Local delivery");
    lines.push("Date: " + (formatUkDate(metadata.delivery_date) || "Not given"));
    lines.push("Delivery cost: " + formatGbpAmount(metadata.delivery_fee_gbp));
    if (metadata.delivery_name) lines.push("Recipient: " + metadata.delivery_name);
    if (metadata.delivery_address) lines.push("Address: " + metadata.delivery_address);
    if (metadata.delivery_postcode) lines.push("Postcode: " + metadata.delivery_postcode);
  } else if (fulfilment === "postage") {
    lines.push("Posted anywhere in the UK");
    lines.push("Delivery cost: " + formatGbpAmount(metadata.delivery_fee_gbp || "3.99"));
  } else {
    lines.push("Date: Not given");
    lines.push("Delivery cost: " + formatGbpAmount(metadata.delivery_fee_gbp));
  }

  return lines.join("\n");
}

function orderHasFlowers(lineItems) {
  const data = lineItems && lineItems.data ? lineItems.data : [];
  return data.some(function (item) {
    const product = item.price && item.price.product;
    const meta = product && typeof product === "object" ? product.metadata : null;
    if (meta && meta.is_flower === "yes") return true;
    const name = String(item.description || (product && product.name) || "").toLowerCase();
    return name.indexOf("bouquet") !== -1 || name.indexOf("hat box") !== -1;
  });
}

function formatLineItems(lineItems) {
  const data = lineItems && lineItems.data ? lineItems.data : [];
  if (!data.length) return "No line items listed.";

  return data
    .map(function (item, index) {
      const qty = item.quantity || 1;
      const total = formatMoneyFromPence(item.amount_total || 0);
      const name =
        (item.description && item.description) ||
        (item.price &&
          item.price.product &&
          typeof item.price.product === "object" &&
          item.price.product.name) ||
        "Item";
      const meta = item.price && item.price.product && item.price.product.metadata;
      let extra = "";
      if (meta && meta.colour) {
        const colour = meta.colour === "other" && meta.colour_other
          ? "Other — " + meta.colour_other
          : COLOUR_LABELS[meta.colour] || meta.colour;
        extra = "\n   Colour: " + colour;
      }
      if (meta && meta.water_bubble_bag === "yes") {
        extra += "\n   Water bubble & bouquet bag: yes";
      }
      return (
        index +
        1 +
        ". " +
        name +
        "\n   Qty: " +
        qty +
        " · " +
        total +
        extra
      );
    })
    .join("\n\n");
}

function buildOrderEmailContent(session, lineItems, forCustomer) {
  const customer = session.customer_details || {};
  const shipping = session.shipping_details || {};
  const address = shipping.address || {};
  const name = [customer.name, shipping.name].filter(Boolean)[0] || "Not provided";
  const email = customer.email || "Not provided";
  const phone = customer.phone || "Not provided";

  const metadata = session.metadata || {};
  const addressLines = [];
  if (metadata.delivery_address) {
    if (metadata.delivery_name) addressLines.push(metadata.delivery_name);
    addressLines.push(metadata.delivery_address);
  } else {
    if (shipping.name) addressLines.push(shipping.name);
    if (address.line1) addressLines.push(address.line1);
    if (address.line2) addressLines.push(address.line2);
    if (address.city) addressLines.push(address.city);
    if (address.postal_code) addressLines.push(address.postal_code);
  }
  const addressText = addressLines.length ? addressLines.join(", ") : "Not provided";
  const discountPence = (session.total_details && session.total_details.amount_discount) || 0;
  const discountText = discountPence > 0 ? "Discount: -" + formatMoneyFromPence(discountPence) : "";

  const customCardMessage = (session.custom_fields || [])
    .filter(function (f) {
      return f.key === "card_message";
    })
    .map(getCustomFieldValue)
    .filter(Boolean)[0];
  const cardMessage = metadata.card_message || customCardMessage || "";
  const flowers = orderHasFlowers(lineItems);
  const whenText = formatFulfilment(metadata);
  const cardLine = flowers
    ? "Note with the flowers: " + (cardMessage || "(none)")
    : "";

  const textParts = [
    forCustomer
      ? "Thank you for your order from Gin House Flowers."
      : "New online shop order — Gin House Flowers",
    "",
    whenText,
    "",
    cardLine,
    "",
    "Payment: " + formatMoneyFromPence(session.amount_total || 0),
    ...(discountText ? [discountText] : []),
    ...(forCustomer ? [] : ["Stripe payment ID: " + session.payment_intent]),
    "Order reference: " + session.id,
    "",
    ...(forCustomer
      ? []
      : ["Customer", "Name: " + name, "Email: " + email, "Phone: " + phone, ""]),
    "Deliver to",
    addressText,
    "",
    "Items",
    formatLineItems(lineItems),
    "",
    ...(forCustomer
      ? ["If anything looks wrong, call us on 01223 656670 or reply to this email."]
      : [
          "View in Stripe Dashboard: https://dashboard.stripe.com/payments/" +
            session.payment_intent,
        ]),
  ];

  const text = textParts.filter(function (line, i, arr) {
    if (line !== "") return true;
    return i > 0 && arr[i - 1] !== "";
  }).join("\n");

  const html = [
    "<h1 style=\"font-family:Georgia,serif;font-size:22px;\">" +
      (forCustomer ? "Your Gin House Flowers order" : "New online shop order") +
      "</h1>",
    forCustomer ? "<p>Thank you. Here is what we have for your order.</p>" : "",
    "<h2 style=\"font-size:16px;\">When</h2>",
    "<pre style=\"font-family:Georgia,serif;font-size:16px;white-space:pre-wrap;\">" +
      escapeHtml(whenText) +
      "</pre>",
    flowers
      ? "<p><strong>Note with the flowers:</strong> " + escapeHtml(cardMessage || "(none)") + "</p>"
      : "",
    forCustomer
      ? ""
      : "<h2 style=\"font-size:16px;\">Customer</h2><ul><li><strong>Name:</strong> " +
        escapeHtml(name) +
        "</li><li><strong>Email:</strong> " +
        escapeHtml(email) +
        "</li><li><strong>Phone:</strong> " +
        escapeHtml(phone) +
        "</li></ul>",
    "<p><strong>Total paid:</strong> " + escapeHtml(formatMoneyFromPence(session.amount_total || 0)) + "</p>",
    discountText ? "<p>" + escapeHtml(discountText) + "</p>" : "",
    "<h2 style=\"font-size:16px;\">Deliver to</h2>",
    "<p>" + escapeHtml(addressText) + "</p>",
    "<h2 style=\"font-size:16px;\">Items</h2>",
    "<pre style=\"font-family:monospace;font-size:14px;white-space:pre-wrap;\">" +
      escapeHtml(formatLineItems(lineItems)) +
      "</pre>",
    forCustomer
      ? "<p>If anything looks wrong, call us on 01223 656670 or reply to this email.</p>"
      : "<p><a href=\"https://dashboard.stripe.com/payments/" +
        escapeHtml(String(session.payment_intent || "")) +
        "\">View payment in Stripe</a></p>",
  ].join("");

  return {
    subject: forCustomer
      ? "Your Gin House Flowers order"
      : "New online order — Gin House Flowers (" +
        formatMoneyFromPence(session.amount_total || 0) +
        ")",
    text,
    html,
  };
}

async function sendViaResend({ subject, text, html, to, replyTo }) {
  return sendResendEmail({
    to: to || process.env.ORDER_NOTIFY_EMAIL || "info@ginhouseflowers.co.uk",
    subject,
    text,
    html,
    replyTo,
  });
}

function shopNotifyEmail() {
  return String(process.env.ORDER_NOTIFY_EMAIL || "info@ginhouseflowers.co.uk").trim();
}

async function sendStripeCustomerReceipt(stripe, session, lineItems) {
  const email = session.customer_details && session.customer_details.email;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent && session.payment_intent.id;
  if (!email || !paymentIntentId) {
    return { ok: false, error: "Customer email: no email address on the payment" };
  }

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const metadata = (intent && intent.metadata) || {};
  const customerAlready = Boolean(intent && intent.receipt_email);
  const shopAlready = metadata.shop_receipt_sent === "yes";
  const customerText = String(buildOrderEmailContent(session, lineItems, true).text || "").slice(0, 1000);
  const shopText = String(buildOrderEmailContent(session, lineItems, false).text || "").slice(0, 1000);

  if (!customerAlready) {
    await stripe.paymentIntents.update(paymentIntentId, {
      receipt_email: email,
      description: customerText,
    });
  }

  if (!shopAlready) {
    await stripe.paymentIntents.update(paymentIntentId, {
      description: shopText,
    });
    const chargeId =
      intent && typeof intent.latest_charge === "string"
        ? intent.latest_charge
        : intent && intent.latest_charge && intent.latest_charge.id;
    if (chargeId) {
      await stripe.charges.update(chargeId, { receipt_email: shopNotifyEmail() });
    } else {
      await stripe.paymentIntents.update(paymentIntentId, { receipt_email: shopNotifyEmail() });
    }
    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: { shop_receipt_sent: "yes" },
    });
  }

  return {
    ok: true,
    already: customerAlready,
    shopReceipt: shopAlready ? "already-sent" : "sent",
  };
}

async function sendOrderNotificationEmail(stripe, sessionId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price.product", "customer_details"],
  });

  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 100,
    expand: ["data.price.product"],
  });

  let receipt;
  try {
    receipt = await sendStripeCustomerReceipt(stripe, session, lineItems);
  } catch (err) {
    receipt = { ok: false, error: err.message || "Stripe receipt was not sent." };
  }

  const content = buildOrderEmailContent(session, lineItems);
  const shopResult = await sendViaResend(content);
  const customerEmail = session.customer_details && session.customer_details.email;
  let customerResult = { ok: true, skipped: true };
  if (customerEmail) {
    const copy = buildOrderEmailContent(session, lineItems, true);
    customerResult = await sendViaResend({
      ...copy,
      to: customerEmail,
      replyTo: process.env.ORDER_NOTIFY_EMAIL || "info@ginhouseflowers.co.uk",
    });
  }

  const problems = [];
  if (!shopResult.ok) problems.push("Shop email: " + (shopResult.error || "not sent"));
  if (customerEmail && !customerResult.ok) {
    problems.push("Customer email: " + (customerResult.error || "not sent"));
  }
  if (problems.length) console.error(problems.join(" "));

  if (!receipt.ok) {
    return { ok: false, error: receipt.error || "Stripe receipt was not sent.", resend: problems.join(" ") };
  }

  console.log(
    receipt.already ? "Stripe receipt already sent for session" : "Stripe receipt sent for session",
    sessionId
  );
  return {
    ok: true,
    receipt: receipt.already ? "already-sent" : "sent",
    shopReceipt: receipt.shopReceipt || "sent",
    resend: problems.join(" "),
  };
}

module.exports = {
  buildOrderEmailContent,
  sendOrderNotificationEmail,
  sendStripeCustomerReceipt,
};
