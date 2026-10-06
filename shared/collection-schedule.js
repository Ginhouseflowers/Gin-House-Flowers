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
const OPENING_HOURS_LABEL =
  "Tuesday 10:30am–5pm, Wednesday–Friday 9:30am–5pm, Saturday 9am–1pm";

const CLOSED_DAY_ERROR =
  "The shop is closed on Sundays and Mondays. Collection is available " +
  OPENING_HOURS_LABEL + ".";

const OUTSIDE_HOURS_ERROR =
  "Please choose a collection time within our opening hours (Tue 10:30am–5pm, Wed–Fri 9:30am–5pm, Sat 9am–1pm).";

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
  return new Date();
}

function startOfToday() {
  const today = nowLocal();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getSlotsForDate(date, onlyFutureOnToday) {
  const hours = OPENING_MINUTES[date.getDay()];
  if (!hours) {
    return [];
  }

  const slots = [];
  const today = startOfToday();
  const isToday = date.getTime() === today.getTime();
  const now = nowLocal();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (let mins = hours.open; mins + SLOT_INTERVAL_MINS <= hours.close; mins += SLOT_INTERVAL_MINS) {
    if (isToday && onlyFutureOnToday && mins <= nowMinutes) {
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

function getEarliestCollectionDate() {
  const date = startOfToday();
  for (let i = 0; i < 14; i += 1) {
    const check = new Date(date);
    check.setDate(date.getDate() + i);
    if (getSlotsForDate(check, true).length > 0) {
      return formatIsoDate(check);
    }
  }
  return formatIsoDate(date);
}

function validateCollectionDateTime(dateStr, timeStr) {
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

  const timeMinutes = parseTimeValue(timeStr);
  if (timeMinutes === null) {
    return { ok: false, error: "Please choose a collection time." };
  }

  const slots = getSlotsForDate(date, true);
  const valid = slots.some((slot) => slot.value === timeStr);
  if (!valid) {
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
