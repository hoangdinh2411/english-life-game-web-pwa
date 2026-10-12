// Explicitly scoped cleanup of the six inventoried local v1 SVG placeholders.
// Upload and visually verify the replacement packs before running this script.
import "../apps/server/scripts/load-env.mjs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(
  new URL("../apps/server/package.json", import.meta.url),
);
const { createClient } = require("@supabase/supabase-js");
const { Pool } = require("pg");

const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
const storageUrl = new URL(process.env.SUPABASE_URL ?? "");
if (
  databaseUrl.hostname !== "127.0.0.1" ||
  databaseUrl.port !== "54321" ||
  storageUrl.hostname !== "127.0.0.1" ||
  storageUrl.port !== "54321"
)
  throw new Error(
    "Cleanup is restricted to the existing local Supabase instance",
  );
const pool = new Pool({ connectionString: databaseUrl.toString() });
const bucket = createClient(
  storageUrl.toString(),
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
).storage.from("game-assets");
const oldHashes = {
  loc_cafe: "c053cdde8f4345e8f6fcdc0cf036d37fffb950741958577c580053c19c75ead2",
  loc_clothes:
    "11d6357cb12b76fd18c95bfff371f13cc4b5278747bb736857c46a307c50e214",
  loc_town_street:
    "5b5af8750ee5ee47e07b901e3ee309ec4c32cd0098dd15c29387efb5aa553a15",
};
const playerHash =
  "ed4b53f8a561d0101bcffab46f0a0680c8e8f8362dcd3907cd5385263edad85f";
const paths = Object.entries(oldHashes).flatMap(([map, hash]) => [
  `${map}/map/background/v1-${hash}.svg`,
  `${map}/map/player/v1-${playerHash}.svg`,
]);
const sources = {
  loc_cafe: "location_cafe_interior.png",
  loc_clothes: "location_clothes_interior.png",
  loc_town_street: "location_maplewood_street.png",
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
try {
  // Verify downloaded replacements against the original authored PNG bytes.
  for (const [map, background] of Object.entries(sources)) {
    for (const [key, source] of [
      ["background", `locations/${background}`],
      ["player", "runtime/player.png"],
    ]) {
      const latest = await pool.query(
        "SELECT path FROM assets WHERE map_id=$1 AND npc_id IS NULL AND key=$2 ORDER BY version DESC LIMIT 1",
        [map, key],
      );
      const path = latest.rows[0]?.path;
      if (!path?.endsWith(".png"))
        throw new Error(`Replacement PNG missing for ${map}/${key}`);
      const downloaded = await bucket.download(path);
      if (downloaded.error || !downloaded.data)
        throw new Error("Replacement download failed");
      const original = await readFile(
        new URL(`../apps/game/assets/${source}`, import.meta.url),
      );
      if (
        digest(Buffer.from(await downloaded.data.arrayBuffer())) !==
        digest(original)
      )
        throw new Error("Replacement differs from authored artwork");
    }
  }
  // Keep a recoverable local copy of the exact objects being removed.
  for (const path of paths) {
    const row = await pool.query("SELECT 1 FROM assets WHERE path=$1", [path]);
    if (!row.rowCount) continue;
    const downloaded = await bucket.download(path);
    if (downloaded.error || !downloaded.data)
      throw new Error("Placeholder backup failed");
    const bytes = Buffer.from(await downloaded.data.arrayBuffer());
    const expected = path.match(/v1-([a-f0-9]{64})\.svg$/)?.[1];
    if (digest(bytes) !== expected)
      throw new Error("Placeholder content differs from inventory");
    const [map, , key] = path.split("/");
    const directory = new URL(
      `../local-assets/maps/${map}/source/legacy-placeholders/`,
      import.meta.url,
    );
    await mkdir(directory, { recursive: true });
    await writeFile(fileURLToPath(new URL(`${key}-v1.svg`, directory)), bytes);
  }
  const result = await bucket.remove(paths);
  if (result.error) throw new Error("Placeholder removal failed");
  await pool.query("DELETE FROM assets WHERE path=ANY($1::text[])", [paths]);
  const remaining = await pool.query(
    "SELECT name FROM storage.objects WHERE bucket_id=$1 AND name=ANY($2::text[])",
    ["game-assets", paths],
  );
  if (remaining.rowCount) throw new Error("Some placeholder objects remain");
  console.log(
    "Removed six exact SVG placeholders from local Storage and their asset metadata; original copies retained locally.",
  );
} finally {
  await pool.end();
}
