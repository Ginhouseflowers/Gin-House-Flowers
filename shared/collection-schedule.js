/**
 * Shop collection times — 11 High Street, Histon.
 * Tuesday 10:30am–5pm, Wed–Fri 9:30am–5pm, Saturday 9am–1pm. Closed Sunday & Monday.
 */

const OPENING_MINUTES = {
  2: { open: 10 * 60 + 30, close: 17 * 60 },
  3: { open: 9 * 60 + 30, close: 17 * 60 },
  4: { open: 9 * 60 + 30, close: 17 * 60 },
  5: { open: 9 * 60 + 30, close: 17 * 60 },
  6: { open: 9 * 60, close: 13 * 60 },
};

const SLOT_INTERVAL_MINS = 30;
const LATE_ORDER_FROM_MINS = 17 * 60;
const LATE_ORDER_UNTIL_MINS = 9 * 60;
const LATE_ORDER_EARLIEST_MINS = 10 * 60 + 30;
const SAME_DAY_LEAD_MINS = 120;
/** Allows for the time a customer spends between choosing a slot and reaching checkout. */
const SAME_DAY_CHECKOUT_GRACE_MINS = 15;
const OPENING_HOURS_LABEL =
  "Tuesday 10:30am–5pm, Wednesday–Friday 9:30am–5pm, Saturday 9am–1pm";

const CLOSED_DAY_ERROR =
  "The shop is closed on Sundays and Mondays. Collection is available " +
  OPENING_HOURS_LABEL + ".";

const OUTSIDE_HOURS_ERROR =
  "Please choose a collection time within our opening hours (Tue 10:30am–5pm, Wed–Fri 9:30am–5pm, Sat 9am–1pm).";

const LATE_ORDER_ERROR =
  "Orders placed after 5pm can be collected from 10:30am on the next day we are open.";

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

function formatIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTimeValue(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseTimeValue(timeStr) {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) {
    return null;
  }
  const parts = timeStr.split(":").map(Number);
  if (parts[1] % SLOT_INTERVAL_MINS !== 0) {
    return null;
  }
  return parts[0] * 60 + parts[1];
}

function nowLocal() {
  const parts = {};
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(new Date())
    .forEach((part) => {
      parts[part.type] = Number(part.value);
    });
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

function startOfToday() {
  const today = nowLocal();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isExtraClosed(date, closedDates) {
  return Array.isArray(closedDates) && closedDates.indexOf(formatIsoDate(date)) !== -1;
}

function isOpenDay(date, closedDates) {
  return Boolean(OPENING_MINUTES[date.getDay()]) && !isExtraClosed(date, closedDates);
}

/** Orders placed from 5pm until the next morning can't be collected before 10:30am on the next open day. */
function lateOrderCollectionDay(closedDates) {
  const now = nowLocal();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes < LATE_ORDER_FROM_MINS && nowMinutes >= LATE_ORDER_UNTIL_MINS) {
    return null;
  }
  const day = startOfToday();
  if (nowMinutes >= LATE_ORDER_FROM_MINS) day.setDate(day.getDate() + 1);
  for (let i = 0; i < 21; i += 1) {
    if (isOpenDay(day, closedDates)) return day.getTime();
    day.setDate(day.getDate() + 1);
  }
  return null;
}

function getSlotsForDate(date, onlyFutureOnToday, closedDates) {
  const hours = OPENING_MINUTES[date.getDay()];
  if (!hours || isExtraClosed(date, closedDates)) {
    return [];
  }

  const slots = [];
  const today = startOfToday();
  const isToday = date.getTime() === today.getTime();
  const now = nowLocal();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isLateOrderDay = onlyFutureOnToday && date.getTime() === lateOrderCollectionDay(closedDates);

  for (let mins = hours.open; mins + SLOT_INTERVAL_MINS <= hours.close; mins += SLOT_INTERVAL_MINS) {
    if (isToday && onlyFutureOnToday && mins < nowMinutes + SAME_DAY_LEAD_MINS - SAME_DAY_CHECKOUT_GRACE_MINS) {
      continue;
    }
    if (isLateOrderDay && mins < LATE_ORDER_EARLIEST_MINS) {
      continue;
    }
    slots.push({
      value: formatTimeValue(mins),
      label: formatTimeLabel(mins),
    });
  }

  return slots;
}

function formatTimeLabel(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "am" : "pm";
  if (m === 0) {
    return `${hour12}${ampm}`;
  }
  return `${hour12}:${String(m).padStart(2, "0")}${ampm}`;
}

function getEarliestCollectionDate(closedDates) {
  const date = startOfToday();
  for (let i = 0; i < 21; i += 1) {
    const check = new Date(date);
    check.setDate(date.getDate() + i);
    if (getSlotsForDate(check, true, closedDates).length > 0) {
      return formatIsoDate(check);
    }
  }
  return formatIsoDate(date);
}

function validateCollectionDateTime(dateStr, timeStr, closedDates) {
  const date = parseIsoDate(dateStr);
  if (!date) {
    return { ok: false, error: "Please choose a valid collection date." };
  }

  const today = startOfToday();
  if (date < today) {
    return { ok: false, error: "Collection date cannot be in the past." };
  }

  if (!OPENING_MINUTES[date.getDay()]) {
    return { ok: false, error: CLOSED_DAY_ERROR };
  }

  if (isExtraClosed(date, closedDates)) {
    return {
      ok: false,
      error: "The shop is closed for collection on that date. Please choose another day.",
    };
  }

  const timeMinutes = parseTimeValue(timeStr);
  if (timeMinutes === null) {
    return { ok: false, error: "Please choose a collection time." };
  }

  const slots = getSlotsForDate(date, true, closedDates);
  const valid = slots.some((slot) => slot.value === timeStr);
  if (!valid) {
    if (
      date.getTime() === lateOrderCollectionDay(closedDates) &&
      timeMinutes < LATE_ORDER_EARLIEST_MINS
    ) {
      return { ok: false, error: LATE_ORDER_ERROR };
    }
    return { ok: false, error: OUTSIDE_HOURS_ERROR };
  }

  return { ok: true, date: dateStr, time: timeStr };
}

module.exports = {
  OPENING_HOURS_LABEL,
  CLOSED_DAY_ERROR,
  OUTSIDE_HOURS_ERROR,
  getSlotsForDate,
  getEarliestCollectionDate,
  validateCollectionDateTime,
};
