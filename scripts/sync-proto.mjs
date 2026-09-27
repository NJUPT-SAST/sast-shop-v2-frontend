import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Keep the application build independent of unpublished remote BSR changes.
// Run from the frontend repository: node scripts/sync-proto.mjs [backend-dir]
const backend = resolve(process.argv[2] ?? "../sast-shop-v2");
await readFile(resolve(backend, "buf.lock"));
await mkdir("proto", { recursive: true });
await cp(resolve(backend, "proto"), "proto", { recursive: true });
await writeFile("buf.lock", await readFile(resolve(backend, "buf.lock")));
console.log("Protocol source snapshot synced; run pnpm proto:generate.");
