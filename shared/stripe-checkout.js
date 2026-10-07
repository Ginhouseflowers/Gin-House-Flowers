const { validateDeliveryPostcode, normalizePostcode } = require("./delivery-radius");
const { validateDeliveryDate } = require("./delivery-schedule");
const { validateCollectionDateTime } = require("./collection-schedule");
const { validateColourOther } = require("./shop-colour");
const { validateProductValue } = require("./shop-products");
const { readStock, checkLines, effectivePricePence, productFor } = require("./stock-store");

const WATER_BUBBLE_BAG_GBP = 5;
const UK_POSTAGE_PENCE = 399;

const COLOUR_LABELS = {
  bright: "Bright",
  pastel: "Pastel",
  none: "No preference",
  seasonal: "Seasonal",
  other: "Other",
};

function colourLabel(item) {
  if (item.colour === "other" && item.colourOther) {
    return "Other — " + String(item.colourOther).slice(0, 120);
  }
  return COLOUR_LABELS[item.colour] || String(item.colour || "No preference");
}

function validateItems(items, stock) {
  const records = (stock && stock.products) || {};
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Your basket is empty." };
  }
  if (items.length > 80) {
    return { ok: false, error: "Too many line items in basket." };
  }

  const lineItems = [];

  for (const item of items) {
    const quantity = Number(item.quantity);
    const product = productFor(item.productId, stock);

    if (!product) {
      return { ok: false, error: "Unrecognised product in basket." };
    }

    const pricePence = effectivePricePence(product, records[product.id]);
    let value;
    if (product.fixedPrice) {
      if (Math.round(Number(item.value) * 100) !== pricePence) {
        return {
          ok: false,
          error:
            "The price of " +
            product.name +
            " has changed. Please refresh your basket and try again.",
        };
      }
      value = pricePence / 100;
    } else {
      const valueCheck = validateProductValue(item.productId, item.value);
      if (!valueCheck.ok) {
        return { ok: false, error: valueCheck.error };
      }
      value = valueCheck.value;
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return { ok: false, error: "Invalid quantity." };
    }

    const colourCheck = validateColourOther(String(item.colour || ""), item.colourOther);
    if (!colourCheck.ok) {
      return { ok: false, error: colourCheck.error };
    }
    item.colourOther = colourCheck.colourOther;

    const waterBubbleBag =
      product.waterBubbleBagAddon && Boolean(item.waterBubbleBag);

    lineItems.push({
      price_data: {
        currency: "gbp",
        unit_amount: product.fixedPrice ? pricePence : Math.round(value * 100),
        product_data: {
          name: product.name,
          description: product.fixedPrice
            ? product.saleLabel || "Greeting card"
            : "Colour preference: " + colourLabel(item),
          metadata: {
            product_id: product.id,
            colour: String(item.colour || ""),
            colour_other: String(item.colourOther || "").slice(0, 120),
            water_bubble_bag: waterBubbleBag ? "yes" : "no",
            is_flower:
              product.group === "cards" || product.group === "gifts" || product.group === "chocolate"
                ? "no"
                : "yes",
          },
        },
      },
      quantity,
    });

    if (waterBubbleBag) {
      lineItems.push({
        price_data: {
          currency: "gbp",
          unit_amount: WATER_BUBBLE_BAG_GBP * 100,
          product_data: {
            name: "Water bubble & bouquet bag",
            description: product.addonDescription,
          },
        },
        quantity,
      });
    }
  }

  return { ok: true, lineItems };
}

function isCardsAndGiftsOnly(items, stock) {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.every(function (item) {
      const product = productFor(item.productId, stock);
      return product && (product.group === "cards" || product.group === "gifts");
    })
  );
}

function cleanLine(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function postcodeFromAddress(address) {
  const matches = String(address || "")
    .toUpperCase()
    .match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g);
  return matches ? normalizePostcode(matches[matches.length - 1]) : "";
}

function validateOrder(order, items, stock) {
  const requested = order && order.fulfilment;
  const fulfilment =
    requested === "delivery" || requested === "postage" ? requested : "collection";

  if (fulfilment === "postage") {
    if (!isCardsAndGiftsOnly(items, stock)) {
      return {
        ok: false,
        error: "Delivery anywhere for £3.99 is only available when the basket is cards and gifts.",
      };
    }
    return { ok: true, fulfilment };
  }

  if (fulfilment === "delivery") {
    if (!cleanLine(order.deliveryName, 80)) {
      return { ok: false, error: "Please enter the recipient’s name." };
    }
    if (cleanLine(order.deliveryAddress, 300).length < 6) {
      return { ok: false, error: "Please enter the delivery address." };
    }
    if (!postcodeFromAddress(order.deliveryAddress)) {
      return {
        ok: false,
        error: "Please include the postcode in the delivery address so we can confirm you are within our delivery area.",
      };
    }

    const dateCheck = validateDeliveryDate(order.deliveryDate);
    if (!dateCheck.ok) {
      return { ok: false, error: dateCheck.error };
    }
  }

  if (fulfilment === "collection") {
    const collectionCheck = validateCollectionDateTime(
      order.collectionDate,
      order.collectionTime
    );
    if (!collectionCheck.ok) {
      return { ok: false, error: collectionCheck.error };
    }
  }

  return { ok: true, fulfilment };
}

async function createCheckoutSession(items, baseUrl, order) {
  const secretKey = String(process.env.STRIPE_SECRET_KEY || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  if (!secretKey || secretKey.startsWith("pk_")) {
    return {
      ok: false,
      status: 503,
      error: "Card payments are not connected yet. Please call us on 01223 656670 to place your order.",
      code: secretKey.startsWith("pk_") ? "secret_key_required" : "missing_key",
    };
  }

  const stock = await readStock();
  const validation = validateItems(items, stock);
  if (!validation.ok) {
    return { ok: false, status: 400, error: validation.error };
  }

  const stockCheck = checkLines(items, stock);
  if (!stockCheck.ok) {
    return { ok: false, status: 400, error: stockCheck.error };
  }

  const orderCheck = validateOrder(order || {}, items, stock);
  if (!orderCheck.ok) {
    return { ok: false, status: 400, error: orderCheck.error };
  }

  const fulfilment = orderCheck.fulfilment;
  let deliveryPostcode = "";
  let deliveryAddress = "";
  let deliveryName = "";
  let deliveryDate = "";
  let deliveryFeeGbp = 0;
  let isLocalDelivery = false;
  let collectionDate = "";
  let collectionTime = "";

  if (fulfilment === "collection") {
    collectionDate = String(order.collectionDate || "").trim();
    collectionTime = String(order.collectionTime || "").trim();
  }

  if (fulfilment === "delivery") {
    deliveryDate = String(order.deliveryDate || "").trim();
    deliveryAddress = cleanLine(order.deliveryAddress, 300);
    deliveryName = cleanLine(order.deliveryName, 80);
    const addressPostcode = postcodeFromAddress(deliveryAddress);
    const radiusCheck = await validateDeliveryPostcode(addressPostcode);
    if (!radiusCheck.ok) {
      return { ok: false, status: 400, error: radiusCheck.error };
    }
    deliveryPostcode = radiusCheck.postcode || addressPostcode;
    deliveryFeeGbp = Number(radiusCheck.deliveryFeeGbp) || 0;
    isLocalDelivery = Boolean(radiusCheck.isLocalDelivery);
  }

  if (fulfilment === "postage") {
    deliveryFeeGbp = UK_POSTAGE_PENCE / 100;
  }

  const stripe = require("stripe")(secretKey);
  const base = String(baseUrl || process.env.URL || "https://www.ginhouseflowers.co.uk").replace(
    /\/$/,
    ""
  );

  const checkoutLineItems = validation.lineItems.slice();

  if ((fulfilment === "delivery" && deliveryFeeGbp > 0) || fulfilment === "postage") {
    checkoutLineItems.push({
      price_data: {
        currency: "gbp",
        unit_amount: fulfilment === "postage" ? UK_POSTAGE_PENCE : deliveryFeeGbp * 100,
        product_data: {
          name: fulfilment === "postage" ? "UK delivery" : "Delivery charge",
          description:
            fulfilment === "postage"
              ? "Posted anywhere in the UK"
              : isLocalDelivery
                ? "Local delivery (Histon, Cottenham, Impington, Oakington or Girton)"
                : "Delivery within 10 miles of our Histon shop",
        },
      },
      quantity: 1,
    });
  }

  const sessionConfig = {
    mode: "payment",
    line_items: checkoutLineItems,
    success_url:
      base + "/shop-checkout-success.html?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: base + "/shop-checkout-cancelled.html",
    phone_number_collection: { enabled: true },
    allow_promotion_codes: true,
    custom_fields: [
      {
        key: "card_message",
        label: { type: "custom", custom: "Card message (optional)" },
        type: "text",
        optional: true,
      },
    ],
    metadata: {
      source: "ginhouseflowers-online-shop",
      fulfilment,
      delivery_postcode: deliveryPostcode,
      delivery_name: deliveryName,
      delivery_address: deliveryAddress,
      delivery_fee_gbp: String(deliveryFeeGbp),
      delivery_date: deliveryDate,
      collection_date: collectionDate,
      collection_time: collectionTime,
    },
  };

  if (fulfilment === "postage") {
    sessionConfig.shipping_address_collection = { allowed_countries: ["GB"] };
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionConfig);

    return { ok: true, status: 200, url: session.url };
  } catch (err) {
    console.error("Stripe Checkout error:", err.type, err.code, err.message);
    const invalidKey =
      err.type === "StripeAuthenticationError" ||
      err.code === "api_key_expired" ||
      /invalid api key/i.test(err.message || "");
    if (invalidKey) {
      return {
        ok: false,
        status: 503,
        error: "Card payments are not connected yet. Please call us on 01223 656670 to place your order.",
        code: err.code || err.type || "invalid_key",
      };
    }
    return {
      ok: false,
      status: 500,
      error: "Unable to start checkout. Please try again or call us on 01223 656670.",
      code: err.code || err.type || "checkout_error",
    };
  }
}

module.exports = { createCheckoutSession, validateItems };
