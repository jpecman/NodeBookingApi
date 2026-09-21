/**
 * Two projects: `unit` over src/**\/*.spec.ts (pure, no database), and `e2e` over
 * test/**\/*.e2e-spec.ts, which drives the real app over HTTP against a real Postgres.
 *
 * Jest only runs a project's globalSetup when that project actually matched test files,
 * so `jest --selectProjects unit` never starts a container.
 *
 * Note: maxWorkers is a global-only option — setting it inside a project entry is
 * silently ignored. The e2e suite shares one database and TRUNCATEs between tests, so it
 * must not run in parallel; that comes from --runInBand in the npm script.
 */
const common = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: __dirname,
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      ...common,
      displayName: 'unit',
      roots: ['<rootDir>/src'],
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
    },
    {
      ...common,
      displayName: 'e2e',
      roots: ['<rootDir>/test'],
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      // Runs in the Jest main process, transpiled by ts-jest — no ts-node needed.
      globalSetup: '<rootDir>/test/global-setup.ts',
      globalTeardown: '<rootDir>/test/global-teardown.ts',
      // setupFiles run before the spec's own imports, which is the only point early
      // enough to override DATABASE_URL: ConfigModule.forRoot() executes when
      // src/app.module.ts is imported, not when the testing module is compiled.
      setupFiles: ['<rootDir>/test/support/setup-env.ts'],
      testTimeout: 60_000,
    },
  ],
};
