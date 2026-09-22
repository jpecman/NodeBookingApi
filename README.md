# NodeBookingApi

A learning project: a port of my .NET hobby project — a booking system for a football club's
pitches — written to get hands-on with the Node.js stack, and rewritten the idiomatic NestJS
way rather than translated line by line.

**NestJS + TypeScript** on **PostgreSQL**, with cookie-based JWT auth and an
OpenAPI-documented REST API under `/api/v1`.

## Requirements

Node 24+, PostgreSQL 16 and Docker (or Podman). [Nix](https://nixos.org/download) provides
the first two: run `nix develop` once, or prefix the commands below with `nix develop -c`.

## Running it

```bash
npm install
cp .env.example .env        # set JWT_SECRET and SEED_PASSWORD

docker compose up -d        # PostgreSQL on host port 5433
npm run migration:run       # create the schema
npm run seed:auth-user      # the login — there is no registration endpoint
npm run seed:booking        # a field with pitches, and a couple of contacts

npm run start:dev           # http://localhost:3000/api/v1
```

Swagger UI is at <http://localhost:3000/api/docs>. Log in through `POST /api/v1/auth/login`
first — the session arrives as a cookie, so everything else works from there.

## Tests

```bash
npm test          # unit only — no database, no container
npm run test:e2e  # boots the real app against a throwaway Postgres (Testcontainers)
npm run test:all  # both
```

See [test/README.md](test/README.md) for details.
