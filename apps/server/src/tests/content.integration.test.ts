import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Test } from "@nestjs/testing";
import { createClient } from "@supabase/supabase-js";
import { AppModule } from "../app.module";
import { mapPackSchema } from "@life-abroad/shared";
import { DatabaseService } from "../infrastructure/database/database.service";

async function sourceFiles(directory: string): Promise<Record<string, string>> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return [];
      throw error;
    },
  );
  const files: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.isDirectory()) {
      for (const [name, hash] of Object.entries(
        await sourceFiles(join(directory, entry.name)),
      ))
        files[join(entry.name, name)] = hash;
    } else if (entry.isFile())
      files[entry.name] = createHash("sha256")
        .update(await readFile(join(directory, entry.name)))
        .digest("hex");
  }
  return files;
}

test("T14 generated files remain in the local asset folder after upload, and immutable retries resolve through metadata", async () => {
  const target = new URL(process.env.SUPABASE_URL ?? "");
  assert.ok(["127.0.0.1", "localhost"].includes(target.hostname));
  assert.equal(target.port, "54321");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(key, "Local service key is required");
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix("api/v1");
  const database = module.get(DatabaseService);
  let existingPaths = new Set<string>();
  const storage = createClient(target.toString(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from("game-assets");
  try {
    await app.listen(0, "127.0.0.1");
    const base = `${await app.getUrl()}/api/v1`;
    existingPaths = new Set((await database.query<{ path: string }>(
      "SELECT path FROM assets WHERE map_id=$1", ["loc_town_street"],
    )).rows.map(row => row.path));
    const generated = spawnSync(process.execPath, [resolve("../../scripts/save-map-assets.mjs"), "loc_town_street"], { encoding: "utf8" });
    assert.equal(generated.status, 0, generated.stderr);
    // Spawn asynchronously: the API in this test process must keep servicing requests.
    const { spawn } = await import("node:child_process");
    const invoke = () =>
      new Promise<string>((resolveRun, reject) => {
        const child = spawn(
          process.execPath,
          [
            resolve("../../scripts/upload-map-assets.mjs"),
            "--target",
            "local",
            "loc_town_street",
          ],
          {
            env: { ...process.env, CONTENT_API_URL: base },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let output = "";
        let errorOutput = "";
        child.stdout.on("data", (data: Buffer) => {
          output += data.toString();
        });
        child.stderr.on("data", (data: Buffer) => {
          errorOutput += data.toString();
        });
        child.on("error", reject);
        child.on("exit", (code) =>
          code === 0
            ? resolveRun(output)
            : reject(new Error(`Upload script exited ${code}: ${errorOutput.replaceAll(key, "[redacted]").trim()}`)),
        );
      });
    const assetDirectory = resolve("../../local-assets/maps/loc_town_street");
    const sourceBefore = await sourceFiles(join(assetDirectory, "source"));
    const first = JSON.parse(await invoke()) as { uploadCount: number; assets: Array<{ key: string; npcId?: string; sha256: string }> };
    const second = JSON.parse(await invoke()) as { uploadCount: number; assets: Array<{ action: string }> };
    assert.ok(first.uploadCount > 0);
    assert.equal(second.uploadCount, 0, "Identical retries must skip immutable assets");
    assert.ok(second.assets.every(asset => asset.action === "skip"));
    const entries = await readdir(assetDirectory, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
    for (const file of ["animations.json", "background.png", "player.png"])
      assert.ok(files.includes(file));
    assert.deepEqual(
      await sourceFiles(join(assetDirectory, "source")),
      sourceBefore,
      "Uploads must preserve source artwork",
    );
    const response = await fetch(`${base}/content/maps/loc_town_street`);
    assert.equal(response.status, 200);
    const pack = mapPackSchema.parse(await response.json());
    for (const uploaded of first.assets) {
      assert.ok(pack.assets.some((asset) => asset.key === uploaded.key
        && asset.npcId === (uploaded.npcId ?? null) && asset.sha256 === uploaded.sha256));
    }
    for (const asset of pack.assets) {
      assert.ok(asset.url.includes("/storage/v1/object/public/game-assets/"));
      const file = await fetch(asset.url);
      assert.equal(file.status, 200);
      assert.match(file.headers.get("cache-control") ?? "", /max-age=31536000/);
      assert.equal((await file.arrayBuffer()).byteLength, asset.bytes);
    }
    // Client roles cannot enumerate metadata through direct database access.
    const permission = spawnSync(
      process.execPath,
      [
        "-e",
        `const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); (async()=>{try{await p.query('BEGIN');await p.query('SET LOCAL ROLE authenticated');await p.query('SELECT * FROM assets');process.exitCode=1;}catch(e){if(e.code!=='42501')process.exitCode=1;}finally{await p.query('ROLLBACK');await p.end();}})();`,
      ],
      { env: process.env },
    );
    assert.equal(permission.status, 0);
  } finally {
    const uploaded = (await database.query<{ path: string }>(
      "SELECT path FROM assets WHERE map_id=$1", ["loc_town_street"],
    )).rows.filter(row => !existingPaths.has(row.path));
    if (uploaded.length) {
      await storage.remove(uploaded.map((row) => row.path));
      await database.query("DELETE FROM assets WHERE path = ANY($1::text[])", [uploaded.map(row => row.path)]);
    }
    await app.close();
  }
});
