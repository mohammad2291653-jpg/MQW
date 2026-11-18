import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  accessSync,
  chmodSync,
  chownSync,
  constants,
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(appDirectory);
process.umask(0o077);
process.env.NODE_ENV = "production";
process.env.NEXT_TELEMETRY_DISABLED = "1";

function stop(message) {
  // Configuration errors deliberately omit actual email, token, and origin values.
  console.error(`MQW could not start: ${message}`);
  process.exit(1);
}

const major = Number(process.versions.node.split(".")[0]);
if (major < 24) stop("Node.js 24 or newer is required.");
if (!existsSync(join(appDirectory, ".next", "BUILD_ID"))) {
  stop("production build missing; run npm run build before starting.");
}

const localPreview = process.env.MQW_LOCAL_PREVIEW === "1";
const ownerEmail = process.env.MQW_OWNER_EMAIL?.trim().toLowerCase();
const setupTokenHash = process.env.MQW_SETUP_TOKEN_HASH;
if (!localPreview) {
  if (!ownerEmail || !/^\S+@\S+\.\S+$/.test(ownerEmail)) {
    stop("set MQW_OWNER_EMAIL before exposing a personal instance.");
  }
  if (!setupTokenHash || !/^[a-f\d]{64}$/i.test(setupTokenHash)) {
    stop(
      "set MQW_SETUP_TOKEN_HASH to the SHA-256 hash of a private setup token.",
    );
  }
} else {
  console.warn(
    "MQW_LOCAL_PREVIEW is enabled. Keep this instance on a trusted local network.",
  );
}

const configuredOrigin =
  process.env.MQW_APP_ORIGIN || process.env.RENDER_EXTERNAL_URL;
if (configuredOrigin) {
  let origin;
  try {
    origin = new URL(configuredOrigin);
  } catch {
    stop("MQW_APP_ORIGIN or RENDER_EXTERNAL_URL must be a valid URL.");
  }
  if (
    origin.username ||
    origin.password ||
    !["https:", "http:"].includes(origin.protocol)
  ) {
    stop("the public application origin is invalid.");
  }
  if (!localPreview && origin.protocol !== "https:") {
    stop("a public production instance requires an HTTPS application origin.");
  }
  process.env.MQW_APP_ORIGIN = origin.origin;
} else if (!localPreview) {
  stop("set MQW_APP_ORIGIN to the public HTTPS origin.");
}

const configuredPort = process.env.PORT || "10000";
if (
  !/^\d+$/.test(configuredPort) ||
  Number(configuredPort) < 1 ||
  Number(configuredPort) > 65535
) {
  stop("PORT must be an integer between 1 and 65535.");
}
const port = String(Number(configuredPort));
process.env.PORT = port;

const storageBackend =
  process.env.MQW_STORAGE_BACKEND ||
  (process.env.MQW_DATABASE_URL ? "postgres" : "sqlite");
if (!["sqlite", "postgres"].includes(storageBackend)) {
  stop("MQW_STORAGE_BACKEND must be sqlite or postgres.");
}
process.env.MQW_STORAGE_BACKEND = storageBackend;

let dataDirectory;
if (storageBackend === "postgres") {
  if (!process.env.MQW_DATABASE_URL) {
    stop("MQW_DATABASE_URL is required for PostgreSQL storage.");
  }
  let connection;
  try {
    connection = new URL(process.env.MQW_DATABASE_URL);
  } catch {
    stop("MQW_DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
  if (
    !["postgres:", "postgresql:"].includes(connection.protocol) ||
    !connection.hostname
  ) {
    stop("MQW_DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
  if (
    ["disable", "no-verify"].includes(
      (connection.searchParams.get("sslmode") || "").toLowerCase(),
    ) ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0"
  ) {
    stop("PostgreSQL storage requires verified TLS; do not disable it.");
  }
  // db.ts enforces rejectUnauthorized:true, optionally with MQW_DATABASE_CA_CERT.
  // Records and private audio are durable database rows. A free web instance
  // must not create, validate, or depend on a local persistent data directory.
} else {
  const configuredDataDirectory = process.env.MQW_DATA_DIR || "/var/data/mqw";
  if (!isAbsolute(configuredDataDirectory)) {
    stop(
      "MQW_DATA_DIR must be an absolute path on a persistent private volume.",
    );
  }
  dataDirectory = resolve(configuredDataDirectory);
  if (dataDirectory === "/" || dataDirectory === appDirectory) {
    stop("MQW_DATA_DIR must be a dedicated private subdirectory.");
  }
  process.env.MQW_DATA_DIR = dataDirectory;
}

try {
  if (dataDirectory) {
    mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
    // Only SQLite needs a dedicated persistent volume. Never change ownership
    // recursively or touch other contents of an optional mounted disk.
    if (process.getuid?.() === 0) {
      chownSync(dataDirectory, 1000, 1000);
      chmodSync(dataDirectory, 0o700);
    }
  }
  if (process.getuid?.() === 0) {
    process.setgroups([]);
    process.setgid(1000);
    process.setuid(1000);
  }
  if (dataDirectory) {
    accessSync(dataDirectory, constants.R_OK | constants.W_OK | constants.X_OK);
    const probe = join(dataDirectory, `.mqw-startup-${randomUUID()}`);
    const handle = openSync(probe, "wx", 0o600);
    closeSync(handle);
    unlinkSync(probe);
  }
} catch {
  stop(
    "unable to initialize private storage or switch to the application user (uid 1000).",
  );
}

const child = spawn(
  process.execPath,
  [
    join(appDirectory, "node_modules", "next", "dist", "bin", "next"),
    "start",
    "--hostname",
    "0.0.0.0",
    "--port",
    port,
  ],
  { cwd: appDirectory, env: process.env, stdio: "inherit" },
);

let shutdownTimer;
let shuttingDown = false;
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    child.kill(signal);
    // Leave room inside Render's default 30-second termination window.
    shutdownTimer = setTimeout(() => child.kill("SIGKILL"), 25_000);
    shutdownTimer.unref();
  });
}
child.once("error", () => stop("unable to launch the production server."));
child.once("exit", (code, signal) => {
  if (shutdownTimer) clearTimeout(shutdownTimer);
  // Next may use the conventional 128+signal status during a requested stop.
  // Normalize those expected exits, while preserving forced-kill failures.
  const expectedStop =
    shuttingDown &&
    (code === 0 ||
      code === 143 ||
      code === 130 ||
      signal === "SIGTERM" ||
      signal === "SIGINT");
  process.exit(expectedStop ? 0 : signal === "SIGKILL" ? 137 : (code ?? 1));
});
