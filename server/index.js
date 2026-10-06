/**
 * Local dev server: static site + Stripe checkout API.
 * Run: npm install && npm start
 * Requires .env with STRIPE_SECRET_KEY (see .env.example)
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { createCheckoutSession } = require("../shared/stripe-checkout");
const { keysMatch, previewCookie } = require("../shared/preview-access");
const { sendContactEnquiryEmail } = require("../shared/contact-email");
const {
  stockGet,
  stockPost,
  catalogueScript,
  readImage,
  MAX_BODY_BYTES,
} = require("../shared/stock-api");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 8888;

function loadEnvFile() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf8").split("\n").forEach(function (line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  });
}

loadEnvFile();

if (!process.env.URL) {
  process.env.URL = "http://localhost:" + PORT;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function resolvePreview(req) {
  const params = new URL(req.url, "http://localhost").searchParams;
  if (params.get("preview") === "0") return { active: false, set: "clear" };
  if (params.get("preview") === "1") return { active: true, set: "set" };
  const cookie = req.headers.cookie || "";
  return {
    active: /(?:^|; )ghf_preview=1(?:;|$)/.test(cookie),
    set: null,
  };
}

function serveStatic(req, res) {
  const preview = resolvePreview(req);
  const extraHeaders = {};
  if (preview.set === "set") {
    extraHeaders["Set-Cookie"] = "ghf_preview=1; Path=/; Max-Age=604800; SameSite=Lax";
  } else if (preview.set === "clear") {
    extraHeaders["Set-Cookie"] = "ghf_preview=; Path=/; Max-Age=0; SameSite=Lax";
  }

  let urlPath = req.url.split("?")[0];
  if (urlPath === "/") urlPath = "/index.html";

  const holdingOn = process.env.HOLDING_PAGE !== "0" && !preview.active;
  const showHolding =
    holdingOn &&
    urlPath !== "/holding.html" &&
    (urlPath === "/index.html" || urlPath.endsWith(".html"));

  const filePath = showHolding
    ? path.join(ROOT, "holding.html")
    : path.join(ROOT, decodeURIComponent(urlPath));

  const blocked =
    urlPath === "/.env" ||
    urlPath.startsWith("/.env") ||
    urlPath.startsWith("/.git") ||
    urlPath === "/server" ||
    urlPath.startsWith("/server/") ||
    urlPath.startsWith("/node_modules") ||
    urlPath.startsWith("/netlify/") ||
    urlPath.startsWith("/data/");
  if (blocked || (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(
      200,
      Object.assign(
        { "Content-Type": MIME[ext] || "application/octet-stream" },
        extraHeaders
      )
    );
    res.end(data);
  });
}

const server = http.createServer(async function (req, res) {
  const urlPath = req.url.split("?")[0];

  if (req.method === "GET" && urlPath === "/api/stock") {
    const result = await stockGet();
    sendJson(res, result.status, result.body);
    return;
  }

  if (req.method === "GET" && urlPath === "/api/catalogue.js") {
    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(await catalogueScript());
    return;
  }

  if (req.method === "GET" && urlPath === "/api/product-image") {
    const id = new URL(req.url, "http://localhost").searchParams.get("id");
    const image = await readImage(id);
    if (!image) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": image.contentType, "Cache-Control": "public, max-age=300" });
    res.end(image.buffer);
    return;
  }

  if (req.method === "POST" && urlPath === "/api/stock") {
    let body = "";
    let tooLarge = false;
    req.on("data", function (chunk) {
      if (tooLarge) return;
      body += chunk;
      if (body.length > MAX_BODY_BYTES) tooLarge = true;
    });
    req.on("end", async function () {
      if (tooLarge) {
        sendJson(res, 413, { error: "The photo is too large. Please use a smaller image." });
        return;
      }
      const result = await stockPost(body);
      sendJson(res, result.status, result.body);
    });
    return;
  }

  if (req.method === "POST" && urlPath === "/api/create-checkout-session") {
    let body = "";
    req.on("data", function (chunk) {
      body += chunk;
    });
    req.on("end", async function () {
      let payload;
      try {
        payload = JSON.parse(body || "{}");
      } catch (e) {
        sendJson(res, 400, { error: "Invalid request." });
        return;
      }

      const host = req.headers.host || "localhost:" + PORT;
      const proto = req.headers["x-forwarded-proto"] || "http";
      const origin = proto + "://" + host;

      const result = await createCheckoutSession(payload.items, origin, {
        fulfilment: payload.fulfilment,
        deliveryPostcode: payload.deliveryPostcode,
        deliveryAddress: payload.deliveryAddress,
        deliveryName: payload.deliveryName,
        deliveryDate: payload.deliveryDate,
        collectionDate: payload.collectionDate,
        collectionTime: payload.collectionTime,
      });
      if (!result.ok) {
        sendJson(res, result.status, { error: result.error });
        return;
      }
      sendJson(res, 200, { url: result.url });
    });
    return;
  }

  if (req.method === "POST" && req.url.split("?")[0] === "/api/contact-enquiry") {
    let body = "";
    req.on("data", function (chunk) {
      body += chunk;
    });
    req.on("end", async function () {
      let payload;
      try {
        payload = JSON.parse(body || "{}");
      } catch (e) {
        sendJson(res, 400, { error: "Invalid request." });
        return;
      }

      const result = await sendContactEnquiryEmail(payload);
      if (!result.ok) {
        sendJson(res, result.status, { error: result.error });
        return;
      }
      sendJson(res, 200, {
        message:
          "Thank you — your enquiry has been sent. We will get back to you soon.",
      });
    });
    return;
  }

  if ((req.method === "GET" || req.method === "HEAD") && urlPath === "/api/preview") {
    const requestUrl = new URL(req.url, "http://localhost");
    if (!keysMatch(requestUrl.searchParams.get("key"))) {
      res.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("This preview link is not valid.");
      return;
    }
    const leave = requestUrl.searchParams.get("off") === "1";
    res.writeHead(302, {
      "Set-Cookie": previewCookie(false, leave),
      Location: leave ? "/holding.html" : "/",
    });
    res.end();
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, function () {
  const hasKey = Boolean(process.env.STRIPE_SECRET_KEY);
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  console.log("Gin House Flowers — local server http://localhost:" + PORT);
  console.log(
    hasKey
      ? "Stripe: secret key loaded from .env"
      : "Stripe: NOT configured — add STRIPE_SECRET_KEY to .env (see STRIPE_SETUP.md)"
  );
  console.log(
    hasResend
      ? "Contact form: Resend API key loaded"
      : "Contact form: NOT configured — add RESEND_API_KEY to .env for enquiry emails"
  );
  console.log("Online shop: http://localhost:" + PORT + "/online-shop.html");
});
