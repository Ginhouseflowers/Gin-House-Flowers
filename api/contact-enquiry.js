const { sendContactEnquiryEmail } = require("../shared/contact-email");

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
      res.status(400).send(JSON.stringify({ error: "Invalid request." }));
      return;
    }
    const result = await sendContactEnquiryEmail(payload);
    if (!result.ok) {
      res.status(result.status).send(JSON.stringify({ error: result.error }));
      return;
    }
    res.status(200).send(
      JSON.stringify({
        message: "Thank you — your enquiry has been sent. We will get back to you soon.",
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).send(
      JSON.stringify({
        error: "Unable to send your enquiry. Please try again, email info@ginhouseflowers.co.uk or call 01223 656670.",
      })
    );
  }
};
