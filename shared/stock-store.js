/**
 * Online stock. Blank availability means no limit.
 * A ticked out-of-stock flag, or an available count of 0, stops online sales.
 * Products added from the stock panel live in customProducts, photos alongside.
 * Local server stores data/stock.json and data/uploads. On Netlify the same data is kept in Blobs.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { getProduct } = require("./shop-products");

const FILE = path.join(__dirname, "..", "data", "stock.json");
const UPLOADS = path.join(__dirname, "..", "data", "uploads");
const GROUPS = ["cards", "gifts", "chocolate"];
const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function passwordMatches(given) {
  const expected = process.env.STOCK_PASSWORD || "";
  const attempt = String(given || "");
  if (!expected || !attempt) return false;
  const a = Buffer.from(attempt);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function emptyStock() {
  return { products: {}, customProducts: {}, consumedSessions: [] };
}

function tidyStock(data) {
  if (!data || !data.products || typeof data.products !== "object") return emptyStock();
  data.consumedSessions = Array.isArray(data.consumedSessions) ? data.consumedSessions : [];
  data.customProducts =
    data.customProducts && typeof data.customProducts === "object" ? data.customProducts : {};
  data.notice = data.notice && typeof data.notice === "object" ? data.notice : null;
  return data;
}

function customToProduct(custom) {
  return {
    id: custom.id,
    name: custom.name,
    minValue: custom.pricePence / 100,
    maxValue: custom.pricePence / 100,
    valueStep: 1,
    waterBubbleBagAddon: false,
    fixedPrice: true,
    fixedPricePence: custom.pricePence,
    saleLabel: custom.product,
    group: custom.group,
    custom: true,
  };
}

function productFor(id, stock) {
  const known = getProduct(id);
  if (known) return known;
  const custom = stock && stock.customProducts && stock.customProducts[id];
  return custom ? customToProduct(custom) : null;
}

function useBlobs() {
  return process.env.NETLIFY === "true";
}

function parsePence(value) {
  if (value === "" || value === undefined || value === null) return null;
  const text = String(value).trim().replace(/^£/, "");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(text)) return NaN;
  const pence = Math.round(Number(text) * 100);
  return pence > 0 && pence <= 100000 ? pence : NaN;
}

function normaliseRecord(raw, product) {
  if (!raw || typeof raw !== "object") {
    return { error: "Invalid stock." };
  }
  let available = raw.available;
  if (available === "" || available === undefined || available === null) {
    available = null;
  } else {
    available = Number(available);
    if (!Number.isInteger(available) || available < 0 || available > 9999) {
      return {
        error: "Enter a whole number from 0 to 9999, or leave available blank for no limit.",
      };
    }
  }
  const outOfStock = Boolean(raw.outOfStock) || available === 0;
  const record = {
    available: available,
    outOfStock: outOfStock,
    deleted: Boolean(raw.deleted),
    pricePence: null,
    onSale: false,
    salePricePence: null,
  };

  if (!product.fixedPrice) return record;

  const pricePence = parsePence(raw.price);
  if (Number.isNaN(pricePence)) {
    return { error: "Enter a price such as 3.50, or leave it blank for the usual price." };
  }
  record.pricePence = pricePence === product.fixedPricePence ? null : pricePence;

  if (raw.onSale) {
    const salePricePence = parsePence(raw.salePrice);
    if (salePricePence == null || Number.isNaN(salePricePence)) {
      return { error: "Enter a sale price such as 2.50." };
    }
    const regular = record.pricePence || product.fixedPricePence;
    if (salePricePence >= regular) {
      return { error: "The sale price must be lower than the usual price." };
    }
    record.onSale = true;
    record.salePricePence = salePricePence;
  }
  return record;
}

function isDefaultRecord(record) {
  return (
    record.available == null &&
    !record.outOfStock &&
    !record.deleted &&
    record.pricePence == null &&
    !record.onSale
  );
}

function effectivePricePence(product, record) {
  if (!product || !product.fixedPrice) return null;
  if (record && record.onSale && record.salePricePence) return record.salePricePence;
  if (record && record.pricePence) return record.pricePence;
  return product.fixedPricePence;
}

async function readStock() {
  if (useBlobs()) {
    try {
      const { getStore } = require("@netlify/blobs");
      const store = getStore("gin-house-stock");
      return tidyStock(await store.get("products", { type: "json" }));
    } catch (err) {
      console.error("Stock read failed:", err.message);
    }
    return emptyStock();
  }

  try {
    return tidyStock(JSON.parse(fs.readFileSync(FILE, "utf8")));
  } catch (err) {
    return emptyStock();
  }
}

async function writeStock(data) {
  const payload = {
    products: data.products || {},
    customProducts: data.customProducts || {},
    notice: data.notice || null,
    consumedSessions: Array.isArray(data.consumedSessions) ? data.consumedSessions.slice(-200) : [],
  };
  if (useBlobs()) {
    const { getStore } = require("@netlify/blobs");
    const store = getStore("gin-house-stock");
    await store.setJSON("products", payload);
    return;
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(payload, null, 2) + "\n");
}

async function saveProduct(id, raw) {
  const stock = await readStock();
  const product = productFor(id, stock);
  if (!product) return { ok: false, error: "Unknown product." };
  const record = normaliseRecord(raw, product);
  if (record.error) return { ok: false, error: record.error };
  if (isDefaultRecord(record)) {
    delete stock.products[id];
  } else {
    stock.products[id] = record;
  }
  await writeStock(stock);
  return {
    ok: true,
    product: stock.products[id] || {
      available: null,
      outOfStock: false,
      deleted: false,
      pricePence: null,
      onSale: false,
      salePricePence: null,
    },
  };
}

function checkLines(items, stock) {
  const totals = {};
  (items || []).forEach(function (item) {
    const id = item && item.productId;
    if (!id) return;
    totals[id] = (totals[id] || 0) + Number(item.quantity || 0);
  });
  const products = (stock && stock.products) || {};
  const ids = Object.keys(totals);
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    const record = products[id];
    const product = productFor(id, stock);
    const name = product ? product.name : "An item";
    const qty = totals[id];
    if (record && record.deleted) {
      return { ok: false, error: name + " is no longer available online." };
    }
    if (record && (record.outOfStock || record.available === 0)) {
      return { ok: false, error: name + " is out of stock online." };
    }
    if (record && record.available != null && qty > record.available) {
      return {
        ok: false,
        error: name + " has " + record.available + " available online.",
      };
    }
  }
  return { ok: true };
}

async function consumePaidOrder(sessionId, lines) {
  if (!sessionId) return;
  const stock = await readStock();
  if (stock.consumedSessions.indexOf(sessionId) !== -1) return;
  (lines || []).forEach(function (line) {
    const record = stock.products[line.productId];
    if (!record || record.available == null) return;
    const next = Math.max(0, record.available - Number(line.quantity || 0));
    record.available = next;
    if (next === 0) record.outOfStock = true;
  });
  stock.consumedSessions.push(sessionId);
  await writeStock(stock);
}

function cleanText(value, max) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function slug(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "product"
  );
}

function decodeImage(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!match) return { error: "The photo must be a JPEG, PNG or WebP image." };
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) return { error: "The photo could not be read." };
  if (buffer.length > MAX_IMAGE_BYTES) return { error: "The photo is too large. Please use a smaller image." };
  return { buffer: buffer, contentType: match[1] };
}

async function writeImage(id, image) {
  if (useBlobs()) {
    const { getStore } = require("@netlify/blobs");
    await getStore("gin-house-images").set(id, image.buffer, {
      metadata: { contentType: image.contentType },
    });
    return;
  }
  fs.mkdirSync(UPLOADS, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS, id + "." + IMAGE_TYPES[image.contentType]), image.buffer);
}

async function readImage(id) {
  if (!/^[a-z0-9-]{1,80}$/.test(String(id || ""))) return null;
  if (useBlobs()) {
    try {
      const { getStore } = require("@netlify/blobs");
      const found = await getStore("gin-house-images").getWithMetadata(id, { type: "arrayBuffer" });
      if (!found) return null;
      return {
        buffer: Buffer.from(found.data),
        contentType: (found.metadata && found.metadata.contentType) || "image/jpeg",
      };
    } catch (err) {
      return null;
    }
  }
  const types = Object.keys(IMAGE_TYPES);
  for (let i = 0; i < types.length; i += 1) {
    const file = path.join(UPLOADS, id + "." + IMAGE_TYPES[types[i]]);
    if (fs.existsSync(file)) return { buffer: fs.readFileSync(file), contentType: types[i] };
  }
  return null;
}

async function removeImage(id) {
  if (useBlobs()) {
    try {
      const { getStore } = require("@netlify/blobs");
      await getStore("gin-house-images").delete(id);
    } catch (err) {
      console.error("Image delete failed:", err.message);
    }
    return;
  }
  Object.keys(IMAGE_TYPES).forEach(function (type) {
    const file = path.join(UPLOADS, id + "." + IMAGE_TYPES[type]);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });
}

async function addProduct(raw) {
  raw = raw || {};
  const name = cleanText(raw.name, 120);
  const brand = cleanText(raw.brand, 80);
  const group = String(raw.group || "");
  const productType = cleanText(raw.productType, 60);
  const occasion = cleanText(raw.occasion, 60) || "Everyday";
  const blurb = cleanText(raw.blurb, 600);
  const styles = (Array.isArray(raw.styles) ? raw.styles : String(raw.styles || "").split(","))
    .map(function (style) {
      return cleanText(style, 40);
    })
    .filter(Boolean)
    .slice(0, 8);

  if (!name) return { ok: false, error: "Enter the product title." };
  if (!brand) return { ok: false, error: "Enter the brand." };
  if (GROUPS.indexOf(group) === -1) return { ok: false, error: "Choose cards, gifts or chocolate." };
  if (!productType) return { ok: false, error: "Enter the product type, such as Greeting card." };
  const pricePence = parsePence(raw.price);
  if (pricePence == null || Number.isNaN(pricePence)) {
    return { ok: false, error: "Enter a price such as 3.50." };
  }

  let image = null;
  if (raw.image) {
    image = decodeImage(raw.image);
    if (image.error) return { ok: false, error: image.error };
  }

  const stock = await readStock();
  let id;
  do {
    id = "new-" + slug(name) + "-" + crypto.randomBytes(3).toString("hex");
  } while (getProduct(id) || stock.customProducts[id]);

  const custom = {
    id: id,
    name: name,
    pricePence: pricePence,
    brand: brand,
    group: group,
    product: productType,
    occasion: occasion,
    styles: styles,
    blurb: blurb,
    image: image ? "/api/product-image?id=" + id : "",
    imageAlt: name,
    custom: true,
  };

  const record = normaliseRecord(
    { available: raw.available, outOfStock: raw.outOfStock },
    customToProduct(custom)
  );
  if (record.error) return { ok: false, error: record.error };

  if (image) await writeImage(id, image);
  stock.customProducts[id] = custom;
  if (!isDefaultRecord(record)) stock.products[id] = record;
  await writeStock(stock);
  return { ok: true, customProduct: custom, product: stock.products[id] || null };
}

async function removeProduct(id) {
  const stock = await readStock();
  if (!stock.customProducts[id]) {
    return { ok: false, error: "Only products added here can be deleted for good." };
  }
  delete stock.customProducts[id];
  delete stock.products[id];
  await writeStock(stock);
  await removeImage(id);
  return { ok: true };
}

function ukToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

function noticeFor(stock) {
  const notice = stock && stock.notice;
  if (!notice || !notice.enabled || !notice.message) return null;
  if (notice.until && notice.until < ukToday()) return null;
  return { message: notice.message, link: notice.link || "", until: notice.until || "" };
}

async function saveNotice(raw) {
  const message = cleanText(raw.message, 160);
  const until = String(raw.until || "").trim();
  const link = String(raw.link || "").trim();
  const enabled = Boolean(raw.enabled);
  if (enabled && !message) {
    return { ok: false, error: "Write the banner message before switching it on." };
  }
  if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return { ok: false, error: "Choose a valid end date." };
  }
  if (link && !/^[a-z0-9-]+\.html(\?[a-z0-9=&-]+)?(#[a-z0-9-]+)?$/i.test(link)) {
    return { ok: false, error: "Choose a page on this website for the banner link." };
  }
  const stock = await readStock();
  stock.notice = { enabled, message, until, link };
  await writeStock(stock);
  return { ok: true, notice: stock.notice };
}

function customList(stock) {
  return Object.keys((stock && stock.customProducts) || {}).map(function (id) {
    return stock.customProducts[id];
  });
}

module.exports = {
  readStock,
  saveProduct,
  addProduct,
  removeProduct,
  readImage,
  customList,
  noticeFor,
  saveNotice,
  productFor,
  checkLines,
  consumePaidOrder,
  passwordMatches,
  effectivePricePence,
};
