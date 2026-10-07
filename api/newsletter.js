const { subscribeNewsletter } = require("../shared/newsletter");

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
  if (req.method !== "POST") {
    res.status(405).send(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  try {
    const raw = await readBody(req);
    let payload = {};
    try {
      payload = JSON.parse(raw || "{}");
    } catch (e) {
      res.status(400).send(JSON.stringify({ error: "Please enter a valid email address." }));
      return;
    }
    const result = await subscribeNewsletter(payload);
    res.status(result.status).send(JSON.stringify(result.body));
  } catch (err) {
    console.error(err);
    res.status(500).send(JSON.stringify({ error: "We couldn't add you to the list. Please try again in a moment." }));
  }
};
