/**
 * Standard Value Formatters for Weather-Aware Truck Routing (WATR).
 *
 * Per Section 8 UI/UX Quality Bar:
 * - Numbers formatted consistently across all cards, tables, and chips.
 * - Miles: 1 decimal place.
 * - Wind speed: integer mph.
 * - Rain/snow precipitation: 2 decimal places.
 * - Duration: hours and minutes format.
 * - Datetimes: user's local timezone with timezone acronym/offset shown.
 * - Weights: comma-separated integer with 'lb' unit.
 */

import dayjs from 'dayjs';

/**
 * Format distance in miles to 1 decimal place.
 * @param {number | null | undefined} miles
 * @returns {string} e.g. "1,003.4 mi"
 */
export function formatMiles(miles) {
  if (miles == null || isNaN(miles)) return '0.0 mi';
  return `${Number(miles).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
}

/**
 * Format wind speed in miles per hour to an integer.
 * @param {number | null | undefined} mph
 * @returns {string} e.g. "27 mph"
 */
export function formatMph(mph) {
  if (mph == null || isNaN(mph)) return '0 mph';
  return `${Math.round(mph)} mph`;
}

/**
 * Format precipitation in inches per hour to 2 decimal places.
 * @param {number | null | undefined} inHr
 * @returns {string} e.g. "0.25 in/hr"
 */
export function formatInHr(inHr) {
  if (inHr == null || isNaN(inHr)) return '0.00 in/hr';
  return `${Number(inHr).toFixed(2)} in/hr`;
}

/**
 * Format duration in minutes into hours and minutes.
 * @param {number | null | undefined} minutes
 * @returns {string} e.g. "15h 5m"
 */
export function formatDuration(minutes) {
  if (minutes == null || isNaN(minutes) || minutes <= 0) return '0m';
  const totalMin = Math.round(minutes);
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

/**
 * Format gross cargo load weight in pounds.
 * @param {number | null | undefined} lb
 * @returns {string} e.g. "42,000 lb"
 */
export function formatWeight(lb) {
  if (lb == null || isNaN(lb)) return '0 lb';
  return `${Math.round(lb).toLocaleString('en-US')} lb`;
}

/**
 * Format ISO datetime string in user's local timezone.
 * @param {string | Date} isoDate
 * @returns {string} e.g. "Nov 2, 8:00 AM CST"
 */
export function formatDateTime(isoDate) {
  if (!isoDate) return '—';
  const d = dayjs(isoDate);
  if (!d.isValid()) return '—';

  // Get user's timezone abbreviation if available
  const tzAbbr =
    new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(d.toDate())
      .find((p) => p.type === 'timeZoneName')?.value || '';

  const formatted = d.format('MMM D, h:mm A');
  return tzAbbr ? `${formatted} ${tzAbbr}` : formatted;
}

/**
 * Format ISO datetime string to time only (e.g. for checkpoint ETA table).
 * @param {string | Date} isoDate
 * @returns {string} e.g. "8:00 AM"
 */
export function formatTimeOnly(isoDate) {
  if (!isoDate) return '—';
  const d = dayjs(isoDate);
  return d.isValid() ? d.format('h:mm A') : '—';
}
