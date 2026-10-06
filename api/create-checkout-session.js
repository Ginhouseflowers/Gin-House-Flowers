const { handler } = require("../netlify/functions/create-checkout-session");

function readBody(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    req.on("data", function (chunk) {
      chunks.push(chunk);
    });
    req.on("end", function () {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

module.exports = async function (req, res) {
  const body = req.method === "POST" ? await readBody(req) : "";
  const result = await handler({
    httpMethod: req.method,
    headers: req.headers,
    body: body,
    isBase64Encoded: false,
  });

  res.status(result.statusCode);
  const headers = result.headers || {};
  Object.keys(headers).forEach(function (name) {
    res.setHeader(name, headers[name]);
  });
  res.send(result.body || "");
};
