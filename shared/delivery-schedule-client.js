/**
 * Browser-side delivery day validation.
 * Tuesday–Saturday. Next-day delivery only until 1pm UK time the day before.
 * Same-day delivery is by enquiry.
 */
(function (global) {
  var DELIVERY_DAY_ERROR =
    "Deliveries can only be booked for Tuesday, Wednesday, Thursday, Friday or Saturday.";

  var SAME_DAY_DELIVERY_ERROR =
    "If you would like to enquire about same day delivery, please contact us on 01223 656670 and we will see what we can do!";

  var NEXT_DAY_CUTOFF_ERROR =
    "Next-day delivery is only available if you order by 1pm the day before. Please choose a later delivery date.";

  var NEXT_DAY_CUTOFF_MINUTES = 13 * 60;

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

  function londonNow(now) {
    var fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    var parts = {};
    fmt.formatToParts(now || new Date()).forEach(function (part) {
      if (part.type !== "literal") parts[part.type] = part.value;
    });
    var hour = Number(parts.hour);
    if (hour === 24) hour = 0;
    return {
      today: new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
      minutes: hour * 60 + Number(parts.minute),
    };
  }

  function isDeliveryWeekday(date) {
    var day = date.getDay();
    return day >= 2 && day <= 6;
  }

  function getEarliestDeliveryDate(now) {
    var london = londonNow(now);
    var date = new Date(london.today.getTime());
    date.setDate(date.getDate() + (london.minutes <= NEXT_DAY_CUTOFF_MINUTES ? 1 : 2));
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

  function validateDeliveryDate(dateStr, now) {
    var date = parseIsoDate(dateStr);
    if (!date) {
      return { ok: false, error: "Please choose a delivery date." };
    }

    var today = londonNow(now).today;
    if (date <= today) {
      return { ok: false, error: SAME_DAY_DELIVERY_ERROR, sameDay: true };
    }

    if (!isDeliveryWeekday(date)) {
      return { ok: false, error: DELIVERY_DAY_ERROR };
    }

    var earliest = parseIsoDate(getEarliestDeliveryDate(now));
    if (earliest && date < earliest) {
      return { ok: false, error: NEXT_DAY_CUTOFF_ERROR };
    }

    return { ok: true, date: dateStr };
  }

  global.GinDeliverySchedule = {
    DELIVERY_DAY_ERROR: DELIVERY_DAY_ERROR,
    SAME_DAY_DELIVERY_ERROR: SAME_DAY_DELIVERY_ERROR,
    NEXT_DAY_CUTOFF_ERROR: NEXT_DAY_CUTOFF_ERROR,
    getEarliestDeliveryDate: getEarliestDeliveryDate,
    listDeliveryDates: listDeliveryDates,
    formatDeliveryLabel: formatDeliveryLabel,
    validateDeliveryDate: validateDeliveryDate,
  };
})(typeof window !== "undefined" ? window : global);
