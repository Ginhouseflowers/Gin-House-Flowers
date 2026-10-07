const { readImage } = require("../../shared/stock-api");

exports.handler = async function (event) {
  const id = (event.queryStringParameters && event.queryStringParameters.id) || "";
  const image = await readImage(id);
  if (!image) {
    return { statusCode: 404, headers: { "Content-Type": "text/plain" }, body: "Not found" };
  }
  return {
    statusCode: 200,
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=86400",
    },
    isBase64Encoded: true,
    body: image.buffer.toString("base64"),
  };
};
