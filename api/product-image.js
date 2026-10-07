const { readImage } = require("../shared/stock-api");

module.exports = async function (req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).send("Method not allowed");
    return;
  }
  const id = (req.query && req.query.id) || "";
  const image = await readImage(id);
  if (!image) {
    res.status(404).send("Not found");
    return;
  }
  res.setHeader("Content-Type", image.contentType);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(200).send(image.buffer);
};
