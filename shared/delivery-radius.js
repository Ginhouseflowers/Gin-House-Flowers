/**
 * Delivery area: 10 miles from 11 High Street, Histon (CB24 9JD).
 * Uses postcodes.io for UK postcode coordinates (no API key).
 * Local delivery (£3): Histon, Cottenham, Impington, Oakington, Girton.
 * All other deliveries within range: £5.
 */

const SHOP = {
  name: "11 High Street, Histon",
  postcode: "CB24 9JD",
  latitude: 52.252278,
  longitude: 0.105793,
};

const MAX_DELIVERY_MILES = 10;
const LOCAL_DELIVERY_FEE_GBP = 3;
const STANDARD_DELIVERY_FEE_GBP = 5;

const LOCAL_VILLAGE_NAMES = [
  "histon",
  "cottenham",
  "impington",
  "oakington",
  "girton",
];

function normalizePostcode(postcode) {
  return String(postcode || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function milesBetween(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 3958.7613 * c;
}

function postcodeLocationText(result) {
  return [
    result.parish,
    result.admin_ward,
    result.built_up_area,
    result.nuts,
    result.administrative_area,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isLocalDeliveryVillage(result) {
  const text = postcodeLocationText(result);
  return LOCAL_VILLAGE_NAMES.some(function (name) {
    return text.indexOf(name) !== -1;
  });
}

function getDeliveryFeeForResult(result) {
  if (result && isLocalDeliveryVillage(result)) {
    return { deliveryFeeGbp: LOCAL_DELIVERY_FEE_GBP, isLocalDelivery: true };
  }
  return { deliveryFeeGbp: STANDARD_DELIVERY_FEE_GBP, isLocalDelivery: false };
}

async function fetchPostcodeDetails(postcode) {
  const normalized = normalizePostcode(postcode);
  if (!normalized || normalized.length < 5 || normalized.length > 7) {
    return { ok: false, error: "Please enter a valid UK delivery postcode." };
  }

  const url = "https://api.postcodes.io/postcodes/" + encodeURIComponent(normalized);

  let response;
  try {
    response = await fetch(url);
  } catch (e) {
    return {
      ok: false,
      error: "We could not check your postcode right now. Please try again shortly.",
    };
  }

  if (response.status === 404) {
    return { ok: false, error: "That postcode was not found. Please check and try again." };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: "We could not verify that postcode. Please check it and try again.",
    };
  }

  const data = await response.json();
  const result = data && data.result;
  if (!result || typeof result.latitude !== "number" || typeof result.longitude !== "number") {
    return {
      ok: false,
      error: "We could not verify that postcode. Please check it and try again.",
    };
  }

  const fee = getDeliveryFeeForResult(result);

  return {
    ok: true,
    result,
    latitude: result.latitude,
    longitude: result.longitude,
    postcode: result.postcode || postcode,
    deliveryFeeGbp: fee.deliveryFeeGbp,
    isLocalDelivery: fee.isLocalDelivery,
  };
}

async function validateDeliveryPostcode(postcode) {
  const details = await fetchPostcodeDetails(postcode);
  if (!details.ok) {
    return details;
  }

  const distanceMiles = milesBetween(
    SHOP.latitude,
    SHOP.longitude,
    details.latitude,
    details.longitude
  );

  if (distanceMiles > MAX_DELIVERY_MILES) {
    return {
      ok: false,
      error:
        "Sorry — we only deliver within 10 miles of our shop at 11 High Street, Histon (CB24 9JD). " +
        "Your postcode is outside our delivery area. Please choose collection, or contact us to discuss your order.",
      distanceMiles,
    };
  }

  return {
    ok: true,
    distanceMiles,
    postcode: details.postcode,
    deliveryFeeGbp: details.deliveryFeeGbp,
    isLocalDelivery: details.isLocalDelivery,
  };
}

module.exports = {
  SHOP,
  MAX_DELIVERY_MILES,
  LOCAL_DELIVERY_FEE_GBP,
  STANDARD_DELIVERY_FEE_GBP,
  LOCAL_VILLAGE_NAMES,
  normalizePostcode,
  isLocalDeliveryVillage,
  getDeliveryFeeForResult,
  validateDeliveryPostcode,
};
