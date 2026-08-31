const pad2 = (value) => String(value).padStart(2, '0');

// ── IST (Asia/Kolkata) date helpers ──────────────────────────────────────────
// The factory runs on a single IST business day. Deriving the calendar day from
// the *device* clock (toDateOnlyString below) drifts by a day on non-IST devices
// (simulators, travelling phones). Use these helpers for any date-only flow so
// the day we read/write is always the Asia/Kolkata day, regardless of device TZ.

// Convert any Date instant to its Asia/Kolkata calendar day as 'YYYY-MM-DD'.
export const dateToISTDateString = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch (error) {
    // Fallback: shift the UTC instant by +05:30 and read the date part.
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 330 * 60000);
    return `${ist.getFullYear()}-${pad2(ist.getMonth() + 1)}-${pad2(ist.getDate())}`;
  }
};

// Today's Asia/Kolkata business day as 'YYYY-MM-DD'.
export const getTodayIST = () => dateToISTDateString(new Date());

export const toDateOnlyString = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const fromDateOnlyString = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return new Date();
  const [year, month, day] = dateString.split('-').map((part) => Number(part));
  if (!year || !month || !day) return new Date(dateString);
  return new Date(year, month - 1, day);
};

export const addDaysToDateOnly = (dateString, delta) => {
  if (!dateString || typeof dateString !== 'string') return dateString;
  const [year, month, day] = dateString.split('-').map((part) => Number(part));
  if (!year || !month || !day) return dateString;
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + delta);
  return `${utcDate.getUTCFullYear()}-${pad2(utcDate.getUTCMonth() + 1)}-${pad2(utcDate.getUTCDate())}`;
};
