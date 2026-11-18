/** Stateless deployment probes. Never creates accounts, sends setup tokens, or authenticates. */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

class VerificationError extends Error {}
const MAX_BODY = 2 * 1024 * 1024;
function requireCheck(condition, message) {
  if (!condition) throw new VerificationError(message);
}
function parseOrigin(value, allowLocal) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new VerificationError("Provide a valid deployment origin.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  requireCheck(
    !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/",
    "Provide only the application origin, without credentials, paths, queries or fragments.",
  );
  requireCheck(
    url.protocol === "https:" ||
      (allowLocal && local && url.protocol === "http:"),
    "HTTPS is required; plain HTTP is allowed only for an explicit localhost check.",
  );
  return { origin: url.origin, local };
}
async function bodyBytes(response) {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks = [];
  let length = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    length += next.value.byteLength;
    if (length > MAX_BODY) {
      await reader.cancel();
      throw new VerificationError(
        "A probe response exceeded its safe size limit.",
      );
    }
    chunks.push(Buffer.from(next.value));
  }
  return Buffer.concat(chunks, length);
}
function securityHeaders(response, label) {
  requireCheck(
    response.headers.get("x-content-type-options")?.toLowerCase() === "nosniff",
    `${label}: nosniff header is missing.`,
  );
  requireCheck(
    response.headers.get("x-frame-options")?.toUpperCase() === "DENY",
    `${label}: frame protection is missing.`,
  );
  requireCheck(
    response.headers.get("referrer-policy") ===
      "strict-origin-when-cross-origin",
    `${label}: the expected referrer policy is missing.`,
  );
  const permissions = response.headers.get("permissions-policy") || "";
  requireCheck(
    permissions.includes("camera=()") &&
      permissions.includes("geolocation=()") &&
      permissions.includes("microphone=(self)"),
    `${label}: device permissions policy is missing.`,
  );
  requireCheck(
    !response.headers.has("x-powered-by"),
    `${label}: the framework identification header should be disabled.`,
  );
}
export async function verifyDeployment(value, options = {}) {
  const { origin, local } = parseOrigin(value, !!options.allowLocal);
  requireCheck(
    !options.allowOpenRegistration || (options.allowLocal && local),
    "Open registration is permitted only in an explicit local-development check.",
  );
  const passed = [];
  const timeoutMs = options.timeoutMs ?? 15000;
  async function probe(path, init = {}) {
    const url = new URL(path, origin);
    requireCheck(
      url.origin === origin && !url.search && !url.hash,
      "A probe cannot request another origin or a URL containing query data.",
    );
    let response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        credentials: "omit",
        ...init,
        headers: {
          "Cache-Control": "no-cache",
          "User-Agent": "MQW-Deployment-Verification/1.0",
          ...init.headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new VerificationError(
        `${path}: the deployment did not respond within the allowed time.`,
      );
    }
    const bytes = await bodyBytes(response);
    return {
      response,
      bytes,
      text: () => bytes.toString("utf8"),
      json: () => {
        try {
          return JSON.parse(bytes.toString("utf8"));
        } catch {
          throw new VerificationError(
            `${path}: expected JSON was not returned.`,
          );
        }
      },
    };
  }
  function pass(label) {
    passed.push(label);
  }
  function noStore(response, label) {
    requireCheck(
      /(?:^|[,\s])no-store(?:[,\s]|$)/i.test(
        response.headers.get("cache-control") || "",
      ),
      `${label}: private API caching must be disabled.`,
    );
  }
  const health = await probe("/api/health");
  requireCheck(
    health.response.status === 200 && health.json().data?.status === "ok",
    "Health: application/database readiness failed.",
  );
  securityHeaders(health.response, "Health");
  noStore(health.response, "Health");
  pass("database readiness and response security headers");
  const auth = await probe("/api/auth");
  const identity = auth.json();
  requireCheck(
    auth.response.status === 200 && identity.data?.user === null,
    "Auth: a stateless request must remain unauthenticated.",
  );
  const registration = identity.data?.capabilities?.registration;
  requireCheck(
    [
      "invite",
      "closed",
      ...(options.allowOpenRegistration ? ["open"] : []),
    ].includes(registration),
    "Auth: public registration must require an owner invitation or be closed.",
  );
  noStore(auth.response, "Auth");
  securityHeaders(auth.response, "Auth");
  pass(`anonymous identity and ${registration} registration`);
  const state = await probe("/api/state");
  requireCheck(
    state.response.status === 401 &&
      typeof state.json().error === "string" &&
      !state.json().data,
    "Private state: an anonymous request was not denied cleanly.",
  );
  noStore(state.response, "Private state");
  pass("anonymous private-data access denied");
  const signIn = await probe("/sign-in");
  requireCheck(
    signIn.response.status === 200 &&
      /text\/html/i.test(signIn.response.headers.get("content-type") || ""),
    "Sign-in: the public page is unavailable.",
  );
  requireCheck(
    /<html[^>]*\blang=["']ar["']/i.test(signIn.text()) &&
      /<html[^>]*\bdir=["']rtl["']/i.test(signIn.text()) &&
      /MQW/.test(signIn.text()),
    "Sign-in: Arabic RTL application HTML was not found.",
  );
  securityHeaders(signIn.response, "Sign-in");
  pass("Arabic RTL sign-in page");
  for (const path of [
    "/today",
    "/learn",
    "/palace",
    "/space",
    "/progress",
    "/settings",
    "/reviews",
    "/study",
  ]) {
    const page = await probe(path);
    // Next.js may have started streaming the document before an async auth
    // redirect resolves. In that case it deliberately returns 200 with a
    // framework redirect instruction; the private API is checked separately.
    const streamedRedirect =
      page.response.status === 200 &&
      /NEXT_REDIRECT;replace;\/sign-in;30[37];/.test(page.text()) &&
      /no-store/i.test(page.response.headers.get("cache-control") || "");
    if (streamedRedirect) {
      pass(`${path} routes anonymous visitors to sign-in (streamed redirect)`);
      continue;
    }
    requireCheck(
      [301, 302, 303, 307, 308].includes(page.response.status),
      `${path}: a private page did not redirect an anonymous visitor.`,
    );
    const location = page.response.headers.get("location");
    requireCheck(!!location, `${path}: the sign-in redirect is missing.`);
    const destination = new URL(location, origin);
    requireCheck(
      destination.origin === origin && destination.pathname === "/sign-in",
      `${path}: private navigation redirected outside the expected sign-in page.`,
    );
    pass(`${path} protects anonymous navigation`);
  }
  const manifestResult = await probe("/manifest.webmanifest");
  requireCheck(
    manifestResult.response.status === 200 &&
      /(?:manifest\+json|application\/json)/i.test(
        manifestResult.response.headers.get("content-type") || "",
      ),
    "PWA manifest is unavailable or has the wrong media type.",
  );
  const manifest = manifestResult.json();
  requireCheck(
    manifest.dir === "rtl" &&
      manifest.lang === "ar" &&
      manifest.display === "standalone" &&
      manifest.start_url === "/today",
    "PWA manifest does not describe the expected Arabic application.",
  );
  requireCheck(Array.isArray(manifest.icons), "PWA manifest has no icons.");
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(
      (item) => item.sizes === `${size}x${size}` && item.type === "image/png",
    );
    requireCheck(
      !!icon && typeof icon.src === "string",
      `PWA: the ${size}px icon is missing.`,
    );
    const image = await probe(icon.src);
    requireCheck(
      image.response.status === 200 &&
        /image\/png/i.test(image.response.headers.get("content-type") || ""),
      `PWA: the ${size}px PNG icon is unavailable.`,
    );
    requireCheck(
      image.bytes.length >= 24 &&
        image.bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
        image.bytes.readUInt32BE(16) === size &&
        image.bytes.readUInt32BE(20) === size,
      `PWA: the ${size}px icon bytes or dimensions are invalid.`,
    );
    pass(`${size}px PWA icon`);
  }
  pass("Arabic standalone PWA manifest");
  for (const [path, type] of [
    ["/apple-touch-icon.png", /image\/png/i],
    ["/icon.svg", /image\/svg\+xml/i],
    ["/sw.js", /(?:java|ecma)script/i],
  ]) {
    const asset = await probe(path);
    requireCheck(
      asset.response.status === 200 &&
        type.test(asset.response.headers.get("content-type") || "") &&
        asset.bytes.length > 0,
      `${path}: the static application asset is unavailable.`,
    );
    pass(`${path} is served`);
  }
  const scripts = [
    ...signIn.text().matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi),
  ].map((match) => match[1].replaceAll("&amp;", "&"));
  const styles = [
    ...signIn.text().matchAll(/<link\b[^>]*\bhref=["']([^"']+\.css)["']/gi),
  ].map((match) => match[1]);
  const js = scripts.find((path) => path.includes("/_next/static/"));
  const css = styles.find((path) => path.includes("/_next/static/"));
  requireCheck(
    !!js && !!css,
    "The application HTML did not include its compiled JavaScript and stylesheet.",
  );
  for (const [path, type] of [
    [js, /(?:java|ecma)script/i],
    [css, /text\/css/i],
  ]) {
    const asset = await probe(path);
    requireCheck(
      asset.response.status === 200 &&
        type.test(asset.response.headers.get("content-type") || ""),
      "A compiled browser asset is missing.",
    );
  }
  pass("compiled JavaScript and CSS assets");
  const deniedMutation = await probe("/api/learning", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: "{}",
  });
  requireCheck(
    deniedMutation.response.status === 401 &&
      typeof deniedMutation.json().error === "string",
    "Anonymous mutation: expected an authentication denial, not a server/configuration error.",
  );
  pass("same-origin unauthenticated mutation denied");
  const crossOrigin = await probe("/api/learning", {
    method: "POST",
    headers: {
      Origin: "https://mqw-verification-cross-origin.invalid",
      "Content-Type": "application/json",
      "Sec-Fetch-Site": "cross-site",
    },
    body: "{}",
  });
  requireCheck(
    crossOrigin.response.status === 403 &&
      typeof crossOrigin.json().error === "string",
    "Cross-origin mutation: the origin guard did not deny the request.",
  );
  pass("cross-origin mutation denied");
  return {
    passed,
    registration,
    hstsReported: !!signIn.response.headers.get("strict-transport-security"),
    limitations: [
      "No account was created and no setup token or owner credentials were used.",
      "Authenticated learning, palace, audio, export and owner cookie behavior require an owner session; this script does not verify them.",
      "Persistence across cloud restarts, mounted-disk identity and backup scheduling require separate operational verification.",
      "HTTP asset checks do not replace browser hydration, accessibility or physical iPhone/PWA tests.",
    ],
  };
}
async function main() {
  const args = process.argv.slice(2);
  const allowLocal = args.includes("--allow-local");
  const allowOpenRegistration = args.includes("--allow-open-registration");
  const values = args.filter(
    (value) => !["--allow-local", "--allow-open-registration"].includes(value),
  );
  requireCheck(
    values.length === 1,
    "Usage: node scripts/verify-deployment.mjs HTTPS_ORIGIN [--allow-local --allow-open-registration]",
  );
  const result = await verifyDeployment(values[0], {
    allowLocal,
    allowOpenRegistration,
  });
  for (const label of result.passed) console.log(`PASS ${label}`);
  console.log(`MQW deployment checks passed: ${result.passed.length}.`);
  for (const limitation of result.limitations)
    console.log(`LIMIT ${limitation}`);
  if (!allowLocal)
    console.log(
      `INFO HTTPS transport security header ${result.hstsReported ? "reported" : "not reported"}.`,
    );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      error instanceof VerificationError
        ? error.message
        : "MQW deployment verification could not finish.",
    );
    process.exitCode = 1;
  });
}
