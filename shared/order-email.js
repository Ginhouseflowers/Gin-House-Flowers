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
  if (field.text && field.text.value) return field.text.value;
  if (field.dropdown && field.dropdown.value) return field.dropdown.value;
  return "";
}

function formatMetadataBlock(metadata) {
  if (!metadata || typeof metadata !== "object") return "";
  const fulfilment = metadata.fulfilment || "";
  const lines = [];

  if (fulfilment === "postage") {
    lines.push("Fulfilment: UK delivery");
    lines.push("Posted anywhere in the UK");
    if (metadata.delivery_fee_gbp) {
      lines.push("Delivery fee: £" + metadata.delivery_fee_gbp);
    }
  } else if (fulfilment === "delivery") {
    lines.push("Fulfilment: Delivery");
    if (metadata.delivery_postcode) {
      lines.push("Delivery postcode: " + metadata.delivery_postcode);
    }
    if (metadata.delivery_date) {
      lines.push("Preferred delivery date: " + metadata.delivery_date);
    }
    if (metadata.delivery_fee_gbp) {
      lines.push("Delivery fee: £" + metadata.delivery_fee_gbp);
    }
  } else if (fulfilment === "collection") {
    lines.push("Fulfilment: Collection from shop");
    if (metadata.collection_date) {
      lines.push("Collection date: " + metadata.collection_date);
    }
    if (metadata.collection_time) {
      lines.push("Collection time: " + metadata.collection_time);
    }
  }

  return lines.join("\n");
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

function buildOrderEmailContent(session, lineItems) {
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

  const cardMessage = (session.custom_fields || [])
    .filter(function (f) {
      return f.key === "card_message";
    })
    .map(getCustomFieldValue)
    .filter(Boolean)[0];

  const textParts = [
    "New online shop order — Gin House Flowers",
    "",
    "Payment: " + formatMoneyFromPence(session.amount_total || 0),
    ...(discountText ? [discountText] : []),
    "Stripe payment ID: " + session.payment_intent,
    "Order reference: " + session.id,
    "",
    "Customer",
    "Name: " + name,
    "Email: " + email,
    "Phone: " + phone,
    "",
    formatMetadataBlock(session.metadata),
    "",
    "Deliver to (if delivery)",
    addressText,
    "",
    cardMessage ? "Card message: " + cardMessage : "Card message: (none)",
    "",
    "Items",
    formatLineItems(lineItems),
    "",
    "View in Stripe Dashboard: https://dashboard.stripe.com/payments/" + session.payment_intent,
  ];

  const text = textParts.filter(function (line, i, arr) {
    if (line !== "") return true;
    return i > 0 && arr[i - 1] !== "";
  }).join("\n");

  const html = [
    "<h1 style=\"font-family:Georgia,serif;font-size:22px;\">New online shop order</h1>",
    "<p><strong>Total paid:</strong> " + escapeHtml(formatMoneyFromPence(session.amount_total || 0)) + "</p>",
    discountText ? "<p>" + escapeHtml(discountText) + "</p>" : "",
    "<h2 style=\"font-size:16px;\">Customer</h2>",
    "<ul>",
    "<li><strong>Name:</strong> " + escapeHtml(name) + "</li>",
    "<li><strong>Email:</strong> " + escapeHtml(email) + "</li>",
    "<li><strong>Phone:</strong> " + escapeHtml(phone) + "</li>",
    "</ul>",
    "<h2 style=\"font-size:16px;\">Collection / delivery</h2>",
    "<pre style=\"font-family:monospace;font-size:14px;white-space:pre-wrap;\">" +
      escapeHtml(formatMetadataBlock(session.metadata)) +
      "</pre>",
    "<h2 style=\"font-size:16px;\">Deliver to</h2>",
    "<p>" + escapeHtml(addressText) + "</p>",
    "<p><strong>Card message:</strong> " + escapeHtml(cardMessage || "(none)") + "</p>",
    "<h2 style=\"font-size:16px;\">Items</h2>",
    "<pre style=\"font-family:monospace;font-size:14px;white-space:pre-wrap;\">" +
      escapeHtml(formatLineItems(lineItems)) +
      "</pre>",
    "<p><a href=\"https://dashboard.stripe.com/payments/" +
      escapeHtml(String(session.payment_intent || "")) +
      "\">View payment in Stripe</a></p>",
  ].join("");

  return {
    subject:
      "New online order — Gin House Flowers (" +
      formatMoneyFromPence(session.amount_total || 0) +
      ")",
    text,
    html,
  };
}

async function sendViaResend({ subject, text, html }) {
  return sendResendEmail({
    to: process.env.ORDER_NOTIFY_EMAIL || "info@ginhouseflowers.co.uk",
    subject,
    text,
    html,
  });
}

async function sendOrderNotificationEmail(stripe, sessionId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price.product", "customer_details"],
  });

  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 100,
    expand: ["data.price.product"],
  });

  const content = buildOrderEmailContent(session, lineItems);
  const result = await sendViaResend(content);

  if (result.skipped) {
    console.warn(result.error);
    return result;
  }

  if (!result.ok) {
    console.error("Order notification email failed:", result.error);
    return result;
  }

  console.log("Order notification email sent:", result.id, "for session", sessionId);
  return result;
}

module.exports = {
  buildOrderEmailContent,
  sendOrderNotificationEmail,
};
