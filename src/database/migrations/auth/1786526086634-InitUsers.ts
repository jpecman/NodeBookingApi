import { Migration } from '@mikro-orm/migrations';

/**
 * Ported from the original TypeORM migration. Every statement is guarded because the
 * auth database may already have these objects from the TypeORM run (tracked in its own
 * "migrations" table, which MikroORM doesn't read) — on such a database this migration
 * only gets recorded in mikro_orm_migrations. Constraint names are TypeORM's.
 */
export class InitUsers1786526086634 extends Migration {
  override name = 'InitUsers1786526086634';

  override up(): void {
    this.addSql(`
      DO $$ BEGIN
        CREATE TYPE "public"."users_role_enum" AS ENUM('SuperAdmin', 'Administrator', 'Content');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    // gen_random_uuid() is built into Postgres 13+, unlike uuid-ossp's uuid_generate_v4(),
    // which TypeORM installed on its own. The app sets ids itself either way.
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "role" "public"."users_role_enum" NOT NULL,
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
        CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
      )
    `);
  }

  override down(): void {
    this.addSql(`DROP TABLE "users"`);
    this.addSql(`DROP TYPE "public"."users_role_enum"`);
  }
}
