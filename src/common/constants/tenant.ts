/**
 * "FK Borovany" in the shared BookingDb — the one real BookingApi tenant this app
 * operates against. Seeded users' tenant_id must match this so their JWT's tenant
 * context lines up with the tenant Contacts are actually stamped with.
 */
export const DEFAULT_TENANT_ID = '2434c89e-e6ae-4815-92de-99646bd2e42c';
