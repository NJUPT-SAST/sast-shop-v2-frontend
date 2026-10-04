import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const mobileRequire = createRequire(
  path.join(root, "apps/mobile/package.json"),
);
const nextRequire = createRequire(mobileRequire.resolve("next/package.json"));
const sharp = nextRequire("sharp");
const brandDirectory = path.join(root, "design/brand");
const logo = await readFile(path.join(brandDirectory, "logo-master.png"));
const illustration = await readFile(
  path.join(brandDirectory, "errand-empty-master.png"),
);

const icon = await sharp(logo).resize(64, 64).png().toBuffer();
const appleIcon = await sharp(logo)
  .resize(180, 180)
  .flatten({ background: "#f6f3ef" })
  .png()
  .toBuffer();
const sizes = [16, 32, 48, 64];
const frames = await Promise.all(
  sizes.map((size) => sharp(logo).resize(size, size).png().toBuffer()),
);
const directory = Buffer.alloc(6 + 16 * frames.length);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(frames.length, 4);
let offset = directory.length;
for (const [index, frame] of frames.entries()) {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index];
  directory[entry + 1] = sizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frame.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
}
const favicon = Buffer.concat([directory, ...frames]);

for (const app of ["mobile", "desktop"]) {
  const directory = path.join(root, "apps", app, "app");
  await writeFile(path.join(directory, "favicon.ico"), favicon);
  await writeFile(path.join(directory, "icon.png"), icon);
  await writeFile(path.join(directory, "apple-icon.png"), appleIcon);
}

const publicDirectory = path.join(root, "apps/mobile/public/brand");
await mkdir(publicDirectory, { recursive: true });
await sharp(logo)
  .resize(512, 512)
  .webp({ quality: 86, alphaQuality: 100 })
  .toFile(path.join(publicDirectory, "logo.webp"));
await sharp(illustration)
  .resize(384, 384)
  .webp({ quality: 82, alphaQuality: 100 })
  .toFile(path.join(publicDirectory, "errand-empty.webp"));

const moduleNames = [
  "errand",
  "template",
  "manual",
  "scan",
  "address",
  "collection",
  "wallet",
  "help",
  "orders",
  "store",
];

for (const name of moduleNames) {
  await sharp(path.join(brandDirectory, `${name}-master.png`))
    .resize(256, 256)
    .webp({ quality: 86, alphaQuality: 100 })
    .toFile(path.join(publicDirectory, `${name}.webp`));
}

console.log("Exported app icons and mobile brand assets.");
