/**
 * Browser-side delivery day validation (Tuesday–Saturday; same-day by enquiry).
 */
(function (global) {
  var DELIVERY_DAY_ERROR =
    "Deliveries can only be booked for Tuesday, Wednesday, Thursday, Friday or Saturday.";

  var SAME_DAY_DELIVERY_ERROR =
    "If you would like to enquire about same day delivery, please contact us on 01223 656670 and we will see what we can do!";

  function parseIsoDate(dateStr) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return null;
    }
    var parts = dateStr.split("-").map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (
      date.getFullYear() !== parts[0] ||
      date.getMonth() !== parts[1] - 1 ||
      date.getDate() !== parts[2]
    ) {
      return null;
    }
    return date;
  }

  function formatIsoDate(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function startOfToday() {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  function isDeliveryWeekday(date) {
    var day = date.getDay();
    return day >= 2 && day <= 6;
  }

  function getEarliestDeliveryDate() {
    var date = startOfToday();
    date.setDate(date.getDate() + 1);
    while (!isDeliveryWeekday(date)) {
      date.setDate(date.getDate() + 1);
    }
    return formatIsoDate(date);
  }

  function listDeliveryDates(weeks) {
    var limit = (Number(weeks) || 8) * 5;
    var dates = [];
    var cursor = parseIsoDate(getEarliestDeliveryDate());
    if (!cursor) return dates;
    while (dates.length < limit) {
      if (isDeliveryWeekday(cursor)) dates.push(formatIsoDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  function formatDeliveryLabel(iso) {
    var date = parseIsoDate(iso);
    if (!date) return iso;
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  function validateDeliveryDate(dateStr) {
    var date = parseIsoDate(dateStr);
    if (!date) {
      return { ok: false, error: "Please choose a delivery date." };
    }

    var today = startOfToday();
    if (date <= today) {
      return { ok: false, error: SAME_DAY_DELIVERY_ERROR, sameDay: true };
    }

    if (!isDeliveryWeekday(date)) {
      return { ok: false, error: DELIVERY_DAY_ERROR };
    }

    return { ok: true, date: dateStr };
  }

  global.GinDeliverySchedule = {
    DELIVERY_DAY_ERROR: DELIVERY_DAY_ERROR,
    SAME_DAY_DELIVERY_ERROR: SAME_DAY_DELIVERY_ERROR,
    getEarliestDeliveryDate: getEarliestDeliveryDate,
    listDeliveryDates: listDeliveryDates,
    formatDeliveryLabel: formatDeliveryLabel,
    validateDeliveryDate: validateDeliveryDate,
  };
})(typeof window !== "undefined" ? window : global);
