import { DateTime } from 'luxon';

/**
 * Booking dates relative to today, because POST /bookings rejects a start in the past.
 * Everything is venue-local (BookingsService's VENUE_ZONE), where opening hours and the
 * weekly recurrence are defined.
 */
const VENUE_ZONE = 'Europe/Prague';

/** `hour:minute` venue time on the first Monday at least a week from today. */
export function upcomingMonday(hour: number, minute = 0): DateTime {
  const weekOut = DateTime.now().setZone(VENUE_ZONE).startOf('day').plus({ weeks: 1 });
  return weekOut
    .plus({ days: (8 - weekOut.weekday) % 7 })
    .set({ hour, minute, second: 0, millisecond: 0 });
}

/**
 * `hour:00` venue time on the next autumn DST-change day (last Sunday of October) whose
 * preceding Sunday is still in the future, so a two-week series can straddle it.
 */
export function autumnDstChange(hour: number): DateTime {
  const now = DateTime.now().setZone(VENUE_ZONE);
  for (let year = now.year; ; year++) {
    const oct31 = DateTime.fromObject({ year, month: 10, day: 31, hour }, { zone: VENUE_ZONE });
    const change = oct31.minus({ days: oct31.weekday % 7 });
    if (change.minus({ weeks: 1 }) > now) return change;
  }
}

/** The instant as the API prints it: `2026-09-21T16:00:00.000Z`. */
export const iso = (dateTime: DateTime): string => dateTime.toJSDate().toISOString();
