/**
 * Mirrors BookingApi's SlotStatus. Stored as a plain integer column, so the numeric
 * values are the contract — value 3 in particular is hardcoded into the EnsureUniqueSlot
 * exclusion constraint on the "Slots" table and must not change.
 */
export enum SlotStatus {
  Booked = 0,
  Invoiced = 1,
  Paid = 2,
  Cancelled = 3,
}
