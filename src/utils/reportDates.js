import { fromDateOnlyString, addDaysToDateOnly, getTodayIST, dateToISTDateString } from './dateOnly';

export const REPORT_PRESETS = {
  TODAY: 'TODAY',
  LAST_7: 'LAST_7',
  LAST_15: 'LAST_15',
  LAST_30: 'LAST_30',
  THIS_WEEK: 'THIS_WEEK',
  THIS_MONTH: 'THIS_MONTH',
  CUSTOM_DATE: 'CUSTOM_DATE', // Prefix for "CUSTOM_DATE:YYYY-MM-DD"
  CUSTOM_RANGE: 'CUSTOM_RANGE', // Prefix for "CUSTOM_RANGE:YYYY-MM-DD:YYYY-MM-DD"
};

// Kept for backwards compatibility; delegates to the centralized IST helper.
export const getKolkataDateString = (date = new Date()) => dateToISTDateString(date);

export const addDays = (dateString, delta) => {
  try {
    return addDaysToDateOnly(dateString, delta);
  } catch (error) {
    console.error('⚠️ addDays error:', { dateString, delta, error });
    return dateString;
  }
};

export const getDateRangeList = (startDate, endDate) => {
  const dates = [];
  let current = startDate;
  let iterations = 0;
  const MAX_ITERATIONS = 400; // Safety limit (over 1 year)

  while (iterations < MAX_ITERATIONS) {
    // Use string comparison since dates are in YYYY-MM-DD format
    if (current > endDate) break;

    dates.push(current);

    // If we've reached the end date, stop
    if (current === endDate) break;

    const nextDate = addDays(current, 1);
    if (nextDate === current) {
      console.error('getDateRangeList: addDays returned same date', { current, nextDate });
      break;
    }

    current = nextDate;
    iterations++;
  }

  if (iterations >= MAX_ITERATIONS) {
    console.error('getDateRangeList: hit max iterations limit', { startDate, endDate });
  }

  return dates;
};

export const toKolkataStartOfDayISO = (dateString) => `${dateString}T00:00:00+05:30`;
export const toKolkataEndOfDayISO = (dateString) => `${dateString}T23:59:59.999+05:30`;

// Week/month starts computed by string arithmetic so they never drift with the
// device timezone. fromDateOnlyString builds a local-midnight Date only to read
// the weekday; the returned day is derived from the input string via addDays.
const getWeekStart = (dateString) => {
  const date = fromDateOnlyString(dateString);
  const day = date.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // Monday-based week start
  return addDays(dateString, diff);
};

const getMonthStart = (dateString) => `${dateString.slice(0, 7)}-01`;

export const getPresetRange = (preset) => {
  const today = getTodayIST();

  // Support "CUSTOM_DATE:YYYY-MM-DD" formatted preset strings
  if (preset && preset.startsWith('CUSTOM_DATE:')) {
    const selectedDate = preset.split(':')[1];
    return {
      startDate: selectedDate,
      endDate: selectedDate,
      label: formatDateLabel(selectedDate),
    };
  }

  // Support "CUSTOM_RANGE:YYYY-MM-DD:YYYY-MM-DD" formatted preset strings
  if (preset && preset.startsWith('CUSTOM_RANGE:')) {
    const [, a, b] = preset.split(':');
    const [startDate, endDate] = a <= b ? [a, b] : [b, a];
    return {
      startDate,
      endDate,
      label: `${formatDateLabel(startDate, true)} – ${formatDateLabel(endDate, true)}`,
    };
  }

  switch (preset) {
    case REPORT_PRESETS.LAST_7:
      return {
        startDate: addDays(today, -6),
        endDate: today,
        label: 'Last 7 days',
      };
    case REPORT_PRESETS.LAST_15:
      return {
        startDate: addDays(today, -14),
        endDate: today,
        label: 'Last 15 days',
      };
    case REPORT_PRESETS.LAST_30:
      return {
        startDate: addDays(today, -29),
        endDate: today,
        label: 'Last 30 days',
      };
    case REPORT_PRESETS.THIS_WEEK:
      return {
        startDate: getWeekStart(today),
        endDate: today,
        label: 'This week',
      };
    case REPORT_PRESETS.THIS_MONTH:
      return {
        startDate: getMonthStart(today),
        endDate: today,
        label: 'This month',
      };
    case REPORT_PRESETS.TODAY:
    default:
      return {
        startDate: today,
        endDate: today,
        label: 'Today',
      };
  }
};

export const formatDateLabel = (dateString, includeYear = false) => {
  if (!dateString) return '';
  try {
    const date = new Date(`${dateString}T00:00:00+05:30`);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: includeYear ? 'numeric' : undefined,
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return dateString;
  }
};
