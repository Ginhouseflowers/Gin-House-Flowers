const { getShopOpen } = require("../shared/shop-status");

module.exports = async function (req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const open = await getShopOpen(false);
  res.status(200).json({ open: open });
};
