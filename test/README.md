# End-to-end tests

These boot the real Nest application (same `configureApp()` as `main.ts`) against a real
Postgres and drive it over HTTP with supertest. `npm test` does **not** run them — it runs
the unit project only, so the reflexive command never needs a container.

```bash
npm test          # unit only, no database
npm run test:e2e  # this suite
npm run test:all  # both
```

## Getting a database

By default Testcontainers starts a throwaway `postgres:16-alpine` and `globalSetup` migrates
it. Nothing here is tied to a particular container runtime, and **no machine needs any
setup** — Docker and podman, Linux and macOS, all just work:

```bash
npm run test:e2e
```

Testcontainers speaks the Docker API and finds the socket itself, in this order:

1. `tc.host` in `~/.testcontainers.properties`
2. `DOCKER_HOST`, else `docker.host` in that same file (the environment wins)
3. `/var/run/docker.sock`
4. rootless *Docker* paths — `$XDG_RUNTIME_DIR/docker.sock`, `~/.docker/run/docker.sock`,
   `~/.docker/desktop/docker.sock`, `/run/user/$uid/docker.sock`
5. named pipe (Windows)

**Docker** — Linux desktops and CI — is found at step 3 and needs nothing.

**Podman** serves the same API, but none of those probes look for `podman.sock`, so
`test/support/container-runtime.ts` fills the gap: when `DOCKER_HOST` is unset and there is
no `/var/run/docker.sock`, it locates podman's socket and sets `DOCKER_HOST` plus
`TESTCONTAINERS_RYUK_DISABLED` for the run. It covers rootless podman on Linux
(`$XDG_RUNTIME_DIR/podman/podman.sock`) and the podman machine on macOS. Anything explicit —
`DOCKER_HOST`, or a `~/.testcontainers.properties` — short-circuits it untouched, and on a
Docker host it returns before the podman branch is ever reached.

Two details it exists to absorb, both learned the hard way:

- **Ryuk cannot run under rootless podman.** The reaper bind-mounts the socket into its own
  container, which fails with `making volume mountpoint … operation not supported`. Hence
  `TESTCONTAINERS_RYUK_DISABLED`, which must be an environment variable: unlike the Java
  implementation, `reaper.js` reads `process.env` directly and never consults
  `~/.testcontainers.properties`. Disabling it is safe because `globalTeardown` stops the
  container explicitly; the only exposure is a hard kill of Jest, after which `podman ps -a`
  and `podman rm` clean up.
- **`podman machine inspect` reports a socket path built from the asking shell's `$TMPDIR`**,
  not from the `TMPDIR` the machine was started with. Inside `nix develop` — which points
  `TMPDIR` at a private directory — it therefore names a path that has never existed. So the
  file *name* is taken from podman and looked for in each plausible temp directory, with
  `getconf DARWIN_USER_TEMP_DIR` as the reliable one: macOS hands out the same per-user temp
  directory in every shell.

If the socket genuinely isn't there, the run says so and names the likely cause. The usual
answer is `podman machine start`. Pre-pulling (`podman pull docker.io/library/postgres:16-alpine`)
keeps the first run from eating the 60s startup timeout.

### No container runtime — point at an existing Postgres

```bash
docker compose up -d          # podman-compose on macOS; or any other Postgres
TEST_DATABASE_URL=postgres://booking:booking@localhost:5433/nodebooking npm run test:e2e
```

`TEST_DATABASE_URL` skips the container entirely. `globalSetup` migrates whatever it's given
(the migrator is idempotent) and truncates the domain tables between tests, so point it at a
**throwaway** database — never at one holding data you care about.

## How it fits together

| file | role |
|---|---|
| `global-setup.ts` | starts the container (or honours `TEST_DATABASE_URL`), runs the migrations, seeds the shared admin, writes the handshake file |
| `support/container-runtime.ts` | points Testcontainers at podman when that's the only runtime; no-op under Docker |
| `support/setup-env.ts` | runs in each worker **before** the spec's imports, and overrides `DATABASE_URL`/`JWT_SECRET` |
| `support/create-test-app.ts` | boots `AppModule` and applies `configureApp()` |
| `support/db.ts` | `TRUNCATE`s the domain tables between tests; `users` is preserved |
| `support/throttle.ts` | clears the login rate limiter between tests |
| `support/fixtures.ts` | rows written directly, inside `tenantContext.run(...)` |

Two things are load-bearing and easy to break:

- **`setup-env.ts` assigns, never `??=`.** A direnv shell has already exported the
  *development* `DATABASE_URL`, and `@nestjs/config` lets `process.env` win over `.env`.
  `resetDomainTables` re-checks the same invariant before every `TRUNCATE`.
- **`test:e2e` runs `--runInBand`.** One shared database plus `TRUNCATE` means parallel
  workers would wipe each other's fixtures. `maxWorkers` inside a Jest `projects` entry is
  silently ignored, so the flag has to stay on the script.
- **`POST /auth/login` allows five attempts a minute** per (IP, email), so any spec that logs
  in more often than that must call `resetRateLimit(ctx.app)` in `beforeEach` — `auth.e2e-spec.ts`
  does. The others log in once in `beforeAll` and don't care. `setup-env.ts` pins
  `LOGIN_RATE_LIMIT`/`LOGIN_RATE_TTL` for the same reason it pins `DATABASE_URL`: a direnv
  shell has already exported whatever the developer put in `.env`, and
  `auth-rate-limit.e2e-spec.ts` counts attempts. The policy itself is explained in
  [../docs/design-notes.md](../docs/design-notes.md).

Every spec must `afterAll(() => ctx.close())`, or the connection pool leaks and Jest hangs.

## Tests that pin known bugs

These specs assert current behaviour that contradicts the docs or the obvious intent. They
say so in their titles; when the underlying issue is fixed, flip the assertion.

1. `POST /auth/login` returns **201**, not the documented 200 (no `@HttpCode`).
2. A slot exclusion-constraint violation (SQLSTATE `23P01`) surfaces as a **500** —
   `AllExceptionsFilter` special-cases `23505` only.
3. A whole-field booking on a field with no pitches returns **201 with zero slots**, though
   `bookings.swagger.ts` documents a 400.
4. `GET /health` returns **503 until some other request has queried the database**.
   MikroORM v7's `init()` only discovers metadata — the pool connects lazily — and Terminus
   asks `connection.isConnected()`, which short-circuits on an internal `connected` flag.
   `AllExceptionsFilter` then rewrites the failure into the standard error envelope, so the
   per-indicator details never reach the client.

One bug these tests found was fixed rather than pinned: `BookingsService.findOccupied()`
projected `['pitch', 'duration']` without the primary key, so `getResultList()` threw
*"You cannot merge entity 'Slot' without identifier"* as soon as the query matched a row —
i.e. every booking onto a field that already had an overlapping slot returned a 500, which
made the whole half-field allocation path unreachable. The unit spec missed it because it
mocks `getResultList`.
