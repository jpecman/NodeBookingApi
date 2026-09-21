import { Migration } from '@mikro-orm/migrations';

/**
 * The whole schema: users, contacts, fields, pitches, bookings, slots — one database, one
 * migration, no history to be compatible with.
 *
 * Everything here is NodeBookingApi's own and follows this project's conventions:
 * lowercase plural tables, snake_case columns, pk_/fk_/ix_/ux_ constraint names, ids
 * defaulted by Postgres, created_at/updated_at everywhere, and NULL (not '') for a missing
 * value. None of BookingApi's schema conventions survive.
 *
 * tenant_id is a plain uuid holding common/constants/tenant.ts's DEFAULT_TENANT_ID. There
 * is no tenants table: the app only ever operates against that one tenant, and the GUID
 * names a tenant that means something in BookingApi's database, not here.
 */
export class InitSchema1789992294000 extends Migration {
  override name = 'InitSchema1789992294000';

  override up(): void {
    this.addSql(`CREATE TYPE "users_role_enum" AS ENUM ('SuperAdmin', 'Administrator', 'Content')`);
    // Accounts are provisioned by seed-auth-user.ts; there is no registration endpoint.
    this.addSql(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" varchar(255) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "role" "users_role_enum" NOT NULL,
        "tenant_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_users" PRIMARY KEY ("id")
      )
    `);
    this.addSql(`CREATE UNIQUE INDEX "ux_users_email" ON "users" ("email")`);

    this.addSql(`
      CREATE TABLE "contacts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "first_name" varchar(30) NOT NULL,
        "last_name" varchar(30) NOT NULL,
        "email" varchar(50) NULL,
        "phone" varchar(20) NULL,
        "show" boolean NOT NULL DEFAULT false,
        "tenant_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_contacts" PRIMARY KEY ("id")
      )
    `);
    this.addSql(`CREATE INDEX "ix_contacts_tenant_id" ON "contacts" ("tenant_id")`);
    // Postgres treats NULLs as distinct, so any number of contacts may have no email.
    this.addSql(`
      CREATE UNIQUE INDEX "ux_contacts_tenant_id_email" ON "contacts" ("tenant_id", "email")
    `);

    this.addSql(`
      CREATE TABLE "fields" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "tenant_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_fields" PRIMARY KEY ("id")
      )
    `);
    this.addSql(`CREATE INDEX "ix_fields_tenant_id" ON "fields" ("tenant_id")`);

    this.addSql(`
      CREATE TABLE "pitches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "field_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_pitches" PRIMARY KEY ("id"),
        CONSTRAINT "fk_pitches_field_id" FOREIGN KEY ("field_id")
          REFERENCES "fields" ("id") ON DELETE CASCADE
      )
    `);
    this.addSql(`CREATE INDEX "ix_pitches_field_id" ON "pitches" ("field_id")`);
    this.addSql(`CREATE INDEX "ix_pitches_tenant_id" ON "pitches" ("tenant_id")`);

    this.addSql(`
      CREATE TABLE "bookings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "contact_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_bookings" PRIMARY KEY ("id"),
        CONSTRAINT "fk_bookings_contact_id" FOREIGN KEY ("contact_id")
          REFERENCES "contacts" ("id") ON DELETE CASCADE
      )
    `);
    this.addSql(`CREATE INDEX "ix_bookings_contact_id" ON "bookings" ("contact_id")`);
    this.addSql(`CREATE INDEX "ix_bookings_tenant_id" ON "bookings" ("tenant_id")`);

    this.addSql(`
      CREATE TABLE "slots" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "duration" tstzrange NOT NULL,
        "price" numeric NOT NULL,
        "pitch_id" uuid NOT NULL,
        "booking_id" uuid NOT NULL,
        "status" integer NOT NULL DEFAULT 0,
        "cancellation_reason" text NULL,
        "tenant_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_slots" PRIMARY KEY ("id"),
        CONSTRAINT "fk_slots_pitch_id" FOREIGN KEY ("pitch_id")
          REFERENCES "pitches" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_slots_booking_id" FOREIGN KEY ("booking_id")
          REFERENCES "bookings" ("id") ON DELETE CASCADE
      )
    `);
    this.addSql(`CREATE INDEX "ix_slots_booking_id" ON "slots" ("booking_id")`);
    this.addSql(`CREATE INDEX "ix_slots_pitch_id" ON "slots" ("pitch_id")`);
    this.addSql(`CREATE INDEX "ix_slots_tenant_id" ON "slots" ("tenant_id")`);

    // btree_gist lets one GiST index mix equality on a uuid with overlap on a range, which
    // is what the exclusion constraint needs.
    this.addSql(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    // Two non-cancelled slots can never overlap on one pitch — the guarantee the
    // application's overlap checks can't make against concurrent requests. Status 3 is
    // SlotStatus.Cancelled; slot-status.enum.ts explains why that number is fixed.
    // A violation raises SQLSTATE 23P01, which AllExceptionsFilter does not yet
    // special-case (it becomes a 500).
    this.addSql(`
      ALTER TABLE "slots" ADD CONSTRAINT "ck_slots_no_overlap"
        EXCLUDE USING gist ("pitch_id" WITH =, "duration" WITH &&)
        WHERE ("status" <> 3)
    `);
  }

  override down(): void {
    // Reverse creation order; foreign keys, indexes and the exclusion constraint go with
    // their tables. btree_gist is left installed — other schemas may use it.
    this.addSql(`DROP TABLE "slots"`);
    this.addSql(`DROP TABLE "bookings"`);
    this.addSql(`DROP TABLE "pitches"`);
    this.addSql(`DROP TABLE "fields"`);
    this.addSql(`DROP TABLE "contacts"`);
    this.addSql(`DROP TABLE "users"`);
    this.addSql(`DROP TYPE "users_role_enum"`);
  }
}
