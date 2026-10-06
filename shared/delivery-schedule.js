/**
 * Delivery days: Tuesday–Saturday only (local UK dates).
 * Same-day delivery: enquire by phone or email (not bookable online).
 */

const DELIVERY_DAY_ERROR =
  "Deliveries can only be booked for Tuesday, Wednesday, Thursday, Friday or Saturday.";

const SAME_DAY_DELIVERY_ERROR =
  "If you would like to enquire about same day delivery, please contact us on 01223 656670 and we will see what we can do!";

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

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isDeliveryWeekday(date) {
  const day = date.getDay();
  return day >= 2 && day <= 6;
}

function getEarliestDeliveryDate() {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  while (!isDeliveryWeekday(date)) {
    date.setDate(date.getDate() + 1);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function validateDeliveryDate(dateStr) {
  const date = parseIsoDate(dateStr);
  if (!date) {
    return { ok: false, error: "Please choose a valid delivery date." };
  }

  const today = startOfToday();
  if (date <= today) {
    return { ok: false, error: SAME_DAY_DELIVERY_ERROR, sameDay: true };
  }

  if (!isDeliveryWeekday(date)) {
    return { ok: false, error: DELIVERY_DAY_ERROR };
  }

  return { ok: true, date: dateStr };
}

module.exports = {
  DELIVERY_DAY_ERROR,
  SAME_DAY_DELIVERY_ERROR,
  parseIsoDate,
  isDeliveryWeekday,
  getEarliestDeliveryDate,
  validateDeliveryDate,
};
