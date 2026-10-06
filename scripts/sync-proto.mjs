import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const backend = resolve(process.argv[2] ?? "../backend");
const lock = await readFile(resolve(backend, "buf.lock"));
await mkdir("proto", { recursive: true });
await cp(resolve(backend, "proto"), "proto", { recursive: true });
await writeFile("buf.lock", lock);
console.log("Protocol source snapshot synced; run pnpm proto:generate.");
