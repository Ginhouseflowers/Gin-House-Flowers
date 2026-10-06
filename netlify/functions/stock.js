const { stockGet, stockPost } = require("../../shared/stock-api");

function jsonResponse(result) {
  return {
    statusCode: result.status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(result.body),
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === "GET") {
    return jsonResponse(await stockGet());
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse({ status: 405, body: { error: "Method not allowed" } });
  }

  const body = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body;
  return jsonResponse(await stockPost(body));
};
