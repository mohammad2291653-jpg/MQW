import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const owner = process.argv[2]?.trim().toLowerCase();
if (!owner || !/^\S+@\S+\.\S+$/.test(owner)) {
  console.error(
    "Usage: node scripts/prepare-owner-setup.mjs owner@example.com",
  );
  process.exit(1);
}
process.umask(0o077);
const directory = resolve(".mqw-operator");
const target = resolve(directory, "owner-setup.json");
if (existsSync(target)) {
  console.error(
    "Existing setup material preserved. Rotate explicitly rather than overwriting it.",
  );
  process.exit(1);
}
mkdirSync(directory, { recursive: true, mode: 0o700 });
const token = randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(token).digest("hex");
writeFileSync(
  target,
  JSON.stringify(
    { owner, token, hash, createdAt: new Date().toISOString() },
    null,
    2,
  ),
  { mode: 0o600, flag: "wx" },
);
writeFileSync(
  resolve(directory, "render-owner-env.json"),
  JSON.stringify(
    [
      { key: "MQW_OWNER_EMAIL", value: owner },
      { key: "MQW_SETUP_TOKEN_HASH", value: hash },
    ],
    null,
    2,
  ),
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Private owner setup generated in .mqw-operator/; no password or token was printed.",
);
