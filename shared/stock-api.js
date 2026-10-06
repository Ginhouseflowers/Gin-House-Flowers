const {
  readStock,
  saveProduct,
  addProduct,
  removeProduct,
  readImage,
  customList,
  noticeFor,
  saveNotice,
  passwordMatches,
} = require("./stock-store");

const MAX_BODY_BYTES = 5 * 1024 * 1024;

async function stockGet() {
  const stock = await readStock();
  return {
    status: 200,
    body: {
      products: stock.products || {},
      customProducts: customList(stock),
      notice: stock.notice || null,
    },
  };
}

async function stockPost(rawBody) {
  if (rawBody && rawBody.length > MAX_BODY_BYTES) {
    return { status: 413, body: { error: "The photo is too large. Please use a smaller image." } };
  }
  let payload;
  try {
    payload = JSON.parse(rawBody || "{}");
  } catch (err) {
    return { status: 400, body: { error: "Invalid request." } };
  }
  if (!passwordMatches(payload.password)) {
    return { status: 401, body: { error: "That password is not correct." } };
  }
  if (payload.action === "unlock") {
    return { status: 200, body: { ok: true } };
  }
  if (payload.action === "add") {
    const added = await addProduct(payload);
    if (!added.ok) return { status: 400, body: { error: added.error } };
    return { status: 200, body: { customProduct: added.customProduct, product: added.product } };
  }
  if (payload.action === "remove") {
    const removed = await removeProduct(payload.id);
    if (!removed.ok) return { status: 400, body: { error: removed.error } };
    return { status: 200, body: { ok: true } };
  }
  if (payload.action === "notice") {
    const saved = await saveNotice(payload);
    if (!saved.ok) return { status: 400, body: { error: saved.error } };
    return { status: 200, body: { notice: saved.notice } };
  }
  const result = await saveProduct(payload.id, payload);
  if (!result.ok) return { status: 400, body: { error: result.error } };
  return { status: 200, body: { product: result.product } };
}

function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function analyticsId() {
  const id = String(process.env.GA_MEASUREMENT_ID || "").trim().toUpperCase();
  return /^G-[A-Z0-9]{4,15}$/.test(id) ? id : "";
}

async function catalogueScript() {
  const stock = await readStock();
  return (
    "window.GinCustomProducts = " +
    scriptJson(customList(stock)) +
    ";\nwindow.GinNotice = " +
    scriptJson(noticeFor(stock)) +
    ";\nwindow.GinAnalyticsId = " +
    scriptJson(analyticsId()) +
    ";\n"
  );
}

module.exports = { stockGet, stockPost, catalogueScript, readImage, MAX_BODY_BYTES };
