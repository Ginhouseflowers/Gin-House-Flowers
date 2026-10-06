const { stockGet, stockPost } = require("../shared/stock-api");

function readBody(req) {
  return new Promise(function (resolve, reject) {
    if (typeof req.body === "string") {
      resolve(req.body);
      return;
    }
    if (Buffer.isBuffer(req.body)) {
      resolve(req.body.toString("utf8"));
      return;
    }
    if (req.body && typeof req.body === "object") {
      resolve(JSON.stringify(req.body));
      return;
    }
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
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  try {
    let result;
    if (req.method === "GET") result = await stockGet();
    else if (req.method === "POST") result = await stockPost(await readBody(req));
    else result = { status: 405, body: { error: "Method not allowed" } };
    res.status(result.status).send(JSON.stringify(result.body));
  } catch (err) {
    console.error(err);
    res.status(500).send(JSON.stringify({ error: "The stock service is unavailable. Please try again." }));
  }
};
