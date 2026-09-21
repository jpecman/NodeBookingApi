import { Booking } from '../bookings/entities/bookings.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { Field } from '../fields/entities/field.entity';
import { Pitch } from '../pitches/entities/pitch.entity';
import { Slot } from '../slots/entities/slot.entity';
import { User } from '../users/entities/user.entity';

/**
 * Every entity, for the contexts that have no Nest module to autoload them from — the
 * migration runner and the e2e harness, both of which need the full schema.
 *
 * The seed scripts deliberately keep their own narrower lists: they only touch the tables
 * they write to.
 */
export const ENTITIES = [User, Contact, Field, Pitch, Booking, Slot];
