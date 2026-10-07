const { createCheckoutSession } = require("../../shared/stripe-checkout");

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return jsonResponse(400, { error: "Invalid request." });
  }

  const origin =
    (event.headers && (event.headers.origin || event.headers.Origin)) ||
    process.env.URL ||
    "https://www.ginhouseflowers.co.uk";

  const result = await createCheckoutSession(payload.items, origin, {
    fulfilment: payload.fulfilment,
    deliveryPostcode: payload.deliveryPostcode,
    deliveryAddress: payload.deliveryAddress,
    deliveryName: payload.deliveryName,
    deliveryDate: payload.deliveryDate,
    collectionDate: payload.collectionDate,
    collectionTime: payload.collectionTime,
    cardNote: payload.cardNote,
    cardMessage: payload.cardMessage,
  });

  if (!result.ok) {
    return jsonResponse(result.status, { error: result.error, code: result.code || "" });
  }

  return jsonResponse(200, { url: result.url });
};
