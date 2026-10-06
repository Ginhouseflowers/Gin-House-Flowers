/**
 * Browser-side delivery radius check (10 miles from 11 High Street, Histon).
 * Uses postcodes.io — same rules as shared/delivery-radius.js on the server.
 */
(function (global) {
  var SHOP = {
    latitude: 52.252278,
    longitude: 0.105793,
  };
  var MAX_DELIVERY_MILES = 10;
  var LOCAL_DELIVERY_FEE_GBP = 3;
  var STANDARD_DELIVERY_FEE_GBP = 5;
  var LOCAL_VILLAGE_NAMES = [
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
    var toRad = function (deg) {
      return (deg * Math.PI) / 180;
    };
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
    var text = postcodeLocationText(result);
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

  function validateDeliveryPostcode(postcode) {
    var normalized = normalizePostcode(postcode);
    if (!normalized || normalized.length < 5 || normalized.length > 7) {
      return Promise.resolve({
        ok: false,
        error: "Please enter a valid UK delivery postcode.",
      });
    }

    var url =
      "https://api.postcodes.io/postcodes/" + encodeURIComponent(normalized);

    return fetch(url)
      .then(function (response) {
        if (response.status === 404) {
          return {
            ok: false,
            error: "That postcode was not found. Please check and try again.",
          };
        }
        if (!response.ok) {
          return {
            ok: false,
            error: "We could not verify that postcode. Please check and try again.",
          };
        }
        return response.json();
      })
      .then(function (data) {
        if (data && data.ok === false) {
          return data;
        }
        var result = data && data.result;
        if (
          !result ||
          typeof result.latitude !== "number" ||
          typeof result.longitude !== "number"
        ) {
          return {
            ok: false,
            error: "We could not verify that postcode. Please check and try again.",
          };
        }

        var distanceMiles = milesBetween(
          SHOP.latitude,
          SHOP.longitude,
          result.latitude,
          result.longitude
        );

        if (distanceMiles > MAX_DELIVERY_MILES) {
          return {
            ok: false,
            error:
              "Sorry — we only deliver within 10 miles of our shop at 11 High Street, Histon (CB24 9JD). " +
              "Please choose collection instead, or contact us to discuss your order.",
            distanceMiles: distanceMiles,
          };
        }

        var fee = getDeliveryFeeForResult(result);

        return {
          ok: true,
          distanceMiles: distanceMiles,
          postcode: result.postcode || postcode,
          deliveryFeeGbp: fee.deliveryFeeGbp,
          isLocalDelivery: fee.isLocalDelivery,
        };
      })
      .catch(function () {
        return {
          ok: false,
          error: "We could not check your postcode right now. Please try again shortly.",
        };
      });
  }

  global.GinDelivery = {
    MAX_DELIVERY_MILES: MAX_DELIVERY_MILES,
    LOCAL_DELIVERY_FEE_GBP: LOCAL_DELIVERY_FEE_GBP,
    STANDARD_DELIVERY_FEE_GBP: STANDARD_DELIVERY_FEE_GBP,
    normalizePostcode: normalizePostcode,
    validatePostcode: validateDeliveryPostcode,
  };
})(typeof window !== "undefined" ? window : global);
