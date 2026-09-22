# Design notes

Why the less obvious parts work the way they do. Structure lives in `README.md`, test
mechanics in `test/README.md`.

## Login rate limiting

`POST /auth/login` is the only public route that touches credentials — there is no
registration endpoint — and `validateUser()` bcrypt-compares even for unknown emails so the
two failures are indistinguishable, which puts ~80 ms of CPU behind every attempt. The policy:
**five attempts a minute per (client IP, submitted email)**, from `rateLimit.login.{limit,ttlMs}`
(`LOGIN_RATE_LIMIT` / `LOGIN_RATE_TTL`, ms).

- **Login only.** No `APP_GUARD` throttler; the controller applies `ThrottlerGuard` by hand and
  the module's one throttler *is* the policy. Everything else sits behind a session.
- **IP + email, not IP alone,** so one mistyped password can't lock out everyone behind a shared
  NAT. Accepted cost: a spray across many emails from one IP isn't capped as a whole — add a
  second, looser IP-only throttler if that changes.
- **The tracker reads `req.body.email` raw.** It runs before `ValidationPipe` but after the JSON
  body parser; anything that isn't a string email shares one `ip:` bucket.
- **Successful logins spend the budget too** — the guard can't know the outcome, and a lucky
  guess mid-run shouldn't reset the counter.
- **The in-memory store is per process.** A second instance means a second budget; a Redis
  `ThrottlerStorage` is the drop-in.
- **`req.ip` is the proxy's address** unless `trust proxy` is set, which depends on the
  deployment. With email in the key, getting it wrong costs one bucket per email, not per site.
- 429s reach the client through `AllExceptionsFilter`'s standard envelope, with `Retry-After`
  and `X-RateLimit-*` headers from the guard.

## `/health` is public and unthrottled

- **Authenticating it** would need a seeded account and a re-login every few hours (httpOnly
  cookie, no refresh, no API keys), and a retrying scraper would collide with the login limiter.
  A container healthcheck would need those credentials in its compose file.
- **Throttling it** would be worse: probes read a 429 as a failed check, so the limiter would
  pull healthy instances out of rotation. The endpoint is one `SELECT 1` and leaks only whether
  the database is reachable.
- The control that fits is the network — keep the API on loopback behind a proxy and allow-list
  the route there:

```nginx
location = /api/v1/health {
	allow 127.0.0.1;        # the box itself, monitoring included
	deny all;
	proxy_pass http://127.0.0.1:8080;
	proxy_set_header Host $host;
	proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
	proxy_set_header X-Forwarded-Proto $scheme;
}
```

`location =` beats the `/api/` prefix block regardless of order, but has to repeat its
`proxy_pass` and headers. Two prerequisites, neither configured yet: the app must not be
reachable on its own port (`app.listen(port)` binds every interface), and express needs
`app.set('trust proxy', 'loopback')` — without it every login attempt keys to the proxy's
address. `'loopback'`, not `true`, which reads the leftmost `X-Forwarded-For` entry and is
spoofable.

