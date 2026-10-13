const SHOP_PRODUCTS = {
  "florists-choice-bouquet": {
    id: "florists-choice-bouquet",
    name: "Florist's choice hand tied bouquet",
    minValue: 25,
    maxValue: 150,
    valueStep: 5,
    waterBubbleBagAddon: true,
    addonDescription: "Add-on for florist's choice hand tied bouquet",
  },
  "florists-choice-hatbox": {
    id: "florists-choice-hatbox",
    name: "Florist's choice hat box arrangement",
    minValue: 40,
    maxValue: 100,
    valueStep: 10,
    waterBubbleBagAddon: false,
    addonDescription: "",
  },
};

function getProduct(productId) {
  return SHOP_PRODUCTS[productId] || null;
}

function validateProductValue(productId, value) {
  const product = getProduct(productId);
  if (!product) {
    return { ok: false, error: "Unrecognised product in basket." };
  }
  const amount = Number(value);
  if (product.fixedPrice) {
    const pence = Math.round(amount * 100);
    if (!Number.isFinite(pence) || pence !== product.fixedPricePence) {
      return {
        ok: false,
        error: "Invalid " + product.name.toLowerCase() + " price.",
      };
    }
    return { ok: true, product, value: product.fixedPricePence / 100 };
  }
  if (
    !Number.isInteger(amount) ||
    amount < product.minValue ||
    amount > product.maxValue ||
    amount % product.valueStep !== 0
  ) {
    return {
      ok: false,
      error: "Invalid " + product.name.toLowerCase() + " value.",
    };
  }
  return { ok: true, product, value: amount };
}

module.exports = { SHOP_PRODUCTS, getProduct, validateProductValue };
