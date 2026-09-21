import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { basename, join } from 'path';

const DOCKER_SOCKET = '/var/run/docker.sock';
const TESTCONTAINERS_PROPERTIES = join(homedir(), '.testcontainers.properties');

/**
 * Points Testcontainers at podman when that's the only runtime present.
 *
 * Testcontainers speaks the Docker API and locates the socket itself: DOCKER_HOST, then
 * /var/run/docker.sock, then a few rootless *Docker* paths. Podman serves the same API,
 * but none of those probes look for podman.sock — so a podman-only machine otherwise needs
 * DOCKER_HOST exported by hand, and on macOS that path is not even stable, because the
 * socket lives under $TMPDIR and moves when the machine is restarted from another shell.
 *
 * Filling the gap here keeps `npm run test:e2e` free of per-machine setup everywhere: a
 * Docker host returns at the second check and never reaches the podman branch, and anything
 * explicit is left exactly as it was.
 */
export function resolveContainerRuntime(): void {
  // Explicit configuration always wins. A properties file counts: Testcontainers reads its
  // `tc.host` at a *higher* precedence than DOCKER_HOST, so setting the variable here could
  // silently contradict it.
  if (process.env.DOCKER_HOST || existsSync(TESTCONTAINERS_PROPERTIES)) {
    return;
  }

  // Docker needs no help — this is the Linux and CI path.
  if (existsSync(DOCKER_SOCKET)) {
    return;
  }

  const socket = findPodmanSocket();

  if (!socket) {
    return; // Let Testcontainers report the missing runtime in its own words.
  }

  process.env.DOCKER_HOST = `unix://${socket}`;
  // Ryuk bind-mounts the socket into its own container, which rootless podman refuses
  // ("operation not supported"). globalTeardown stops the container explicitly, so nothing
  // is left behind without it. Only ever set for podman — under Docker, Ryuk earns its keep.
  process.env.TESTCONTAINERS_RYUK_DISABLED ??= 'true';

  console.log(`e2e: using podman socket ${socket}`);
}

function findPodmanSocket(): string | undefined {
  // Rootless podman on Linux: socket-activated, no VM involved.
  const runtimeDir =
    process.env.XDG_RUNTIME_DIR ??
    (process.getuid ? join('/run', 'user', String(process.getuid())) : undefined);

  if (runtimeDir) {
    const socket = join(runtimeDir, 'podman', 'podman.sock');

    if (existsSync(socket)) {
      return socket;
    }
  }

  // macOS: the socket belongs to a podman machine. `machine inspect` knows its *file name*
  // but not reliably its directory — it renders the path from the TMPDIR of whichever shell
  // asks, which is not necessarily the TMPDIR the machine was started with. Inside
  // `nix develop` that alone makes it point somewhere nothing has ever existed. So take the
  // name from podman and look for it in each plausible temp directory.
  const reported = podmanMachineSocket();

  if (!reported) {
    return undefined;
  }

  const candidates = [
    reported,
    ...tempDirs().map((dir) => join(dir, 'podman', basename(reported))),
  ];
  const socket = candidates.find((candidate) => existsSync(candidate));

  if (!socket) {
    console.warn(
      `e2e: podman is installed but its API socket (${basename(reported)}) was not found.\n` +
        '     Is the machine running? `podman machine start` — see test/README.md.',
    );
  }

  return socket;
}

function tempDirs(): string[] {
  // DARWIN_USER_TEMP_DIR is the per-user temp directory macOS itself hands out, and unlike
  // $TMPDIR it is identical in every shell — including inside `nix develop`, which points
  // TMPDIR at a private directory of its own.
  const dirs = [process.env.TMPDIR, darwinUserTempDir(), '/tmp'];

  return [...new Set(dirs.filter((dir): dir is string => Boolean(dir)))];
}

function darwinUserTempDir(): string | undefined {
  if (process.platform !== 'darwin') {
    return undefined;
  }

  return run('getconf', ['DARWIN_USER_TEMP_DIR']);
}

function podmanMachineSocket(): string | undefined {
  return run('podman', ['machine', 'inspect', '--format', '{{.ConnectionInfo.PodmanSocket.Path}}']);
}

/** Returns trimmed stdout, or undefined if the command is missing or fails. */
function run(command: string, args: string[]): string | undefined {
  try {
    const output = execFileSync(command, args, {
      encoding: 'utf8',
      timeout: 15_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    return output || undefined;
  } catch {
    // Not installed, or nothing to report. Neither is an error here.
    return undefined;
  }
}
