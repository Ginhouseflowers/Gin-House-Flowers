/**
 * Delivery days: Tuesday–Saturday only (UK dates).
 * Next-day delivery is bookable online only until 1pm UK time the day before.
 * Same-day delivery: enquire by phone or email (not bookable online).
 */

const DELIVERY_DAY_ERROR =
  "Deliveries can only be booked for Tuesday, Wednesday, Thursday, Friday or Saturday.";

const SAME_DAY_DELIVERY_ERROR =
  "If you would like to enquire about same day delivery, please contact us on 01223 656670 and we will see what we can do!";

const NEXT_DAY_CUTOFF_ERROR =
  "Next-day delivery is only available if you order by 1pm the day before. Please choose a later delivery date.";

const NEXT_DAY_CUTOFF_MINUTES = 13 * 60;

function parseIsoDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }
  const parts = dateStr.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (
    date.getFullYear() !== parts[0] ||
    date.getMonth() !== parts[1] - 1 ||
    date.getDate() !== parts[2]
  ) {
    return null;
  }
  return date;
}

function londonNow(now) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = {};
  fmt.formatToParts(now || new Date()).forEach(function (part) {
    if (part.type !== "literal") parts[part.type] = part.value;
  });
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  return {
    today: new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
    minutes: hour * 60 + Number(parts.minute),
  };
}

function isDeliveryWeekday(date) {
  const day = date.getDay();
  return day >= 2 && day <= 6;
}

function formatIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getEarliestDeliveryDate(now) {
  const london = londonNow(now);
  const date = new Date(london.today.getTime());
  date.setDate(date.getDate() + (london.minutes <= NEXT_DAY_CUTOFF_MINUTES ? 1 : 2));
  while (!isDeliveryWeekday(date)) {
    date.setDate(date.getDate() + 1);
  }
  return formatIsoDate(date);
}

function listDeliveryDates(weeks) {
  const limit = (Number(weeks) || 8) * 5;
  const dates = [];
  const cursor = parseIsoDate(getEarliestDeliveryDate());
  if (!cursor) return dates;
  while (dates.length < limit) {
    if (isDeliveryWeekday(cursor)) dates.push(formatIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function validateDeliveryDate(dateStr, now) {
  const date = parseIsoDate(dateStr);
  if (!date) {
    return { ok: false, error: "Please choose a valid delivery date." };
  }

  const today = londonNow(now).today;
  if (date <= today) {
    return { ok: false, error: SAME_DAY_DELIVERY_ERROR, sameDay: true };
  }

  if (!isDeliveryWeekday(date)) {
    return { ok: false, error: DELIVERY_DAY_ERROR };
  }

  const earliest = parseIsoDate(getEarliestDeliveryDate(now));
  if (earliest && date < earliest) {
    return { ok: false, error: NEXT_DAY_CUTOFF_ERROR };
  }

  return { ok: true, date: dateStr };
}

module.exports = {
  DELIVERY_DAY_ERROR,
  SAME_DAY_DELIVERY_ERROR,
  NEXT_DAY_CUTOFF_ERROR,
  parseIsoDate,
  isDeliveryWeekday,
  getEarliestDeliveryDate,
  listDeliveryDates,
  validateDeliveryDate,
};
