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
const smallLogo = await readFile(path.join(brandDirectory, "logo-small.svg"));
const illustration = await readFile(
  path.join(brandDirectory, "errand-empty-master.png"),
);

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const selectedModule = process.argv[2];

async function trimTransparentCanvas(source) {
  const metadata = await sharp(source).metadata();
  const mask = await sharp(source)
    .extractChannel("alpha")
    .threshold(64)
    .png()
    .toBuffer();
  const { info } = await sharp(mask)
    .trim({ background: "#000000" })
    .png()
    .toBuffer({ resolveWithObject: true });
  const padding = Math.round(Math.max(info.width, info.height) * 0.025);
  const left = Math.max(0, -info.trimOffsetLeft - padding);
  const top = Math.max(0, -info.trimOffsetTop - padding);
  const right = Math.min(
    metadata.width,
    -info.trimOffsetLeft + info.width + padding,
  );
  const bottom = Math.min(
    metadata.height,
    -info.trimOffsetTop + info.height + padding,
  );
  return sharp(source)
    .extract({ left, top, width: right - left, height: bottom - top })
    .png()
    .toBuffer();
}

const compactLogo = await trimTransparentCanvas(logo);
const icon = await sharp(compactLogo)
  .resize(512, 512, { fit: "contain", background: transparent })
  .png()
  .toBuffer();
const appleIcon = await sharp(compactLogo)
  .resize(180, 180, { fit: "contain", background: "#f6f3ef" })
  .flatten({ background: "#f6f3ef" })
  .png()
  .toBuffer();
const sizes = [16, 32, 48, 64];
const frames = await Promise.all(
  sizes.map((size) => sharp(smallLogo).resize(size, size).png().toBuffer()),
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

for (const app of selectedModule ? [] : ["mobile", "desktop"]) {
  const directory = path.join(root, "apps", app, "app");
  await writeFile(path.join(directory, "favicon.ico"), favicon);
  await writeFile(path.join(directory, "icon.png"), icon);
  await writeFile(path.join(directory, "icon.svg"), smallLogo);
  await writeFile(path.join(directory, "apple-icon.png"), appleIcon);
}

const publicDirectory = path.join(root, "apps/mobile/public/brand");
await mkdir(publicDirectory, { recursive: true });
if (!selectedModule) {
  await sharp(logo)
    .resize(512, 512)
    .webp({ lossless: true })
    .toFile(path.join(publicDirectory, "logo.webp"));
  await sharp(illustration)
    .resize(384, 384)
    .webp({ quality: 82, alphaQuality: 100 })
    .toFile(path.join(publicDirectory, "errand-empty.webp"));
}

const moduleNames = [
  "errand",
  "template",
  "transaction-agreement",
  "feishu-required",
  "login",
  "manual",
  "scan",
  "address",
  "collection",
  "wallet",
  "help",
  "orders",
  "store",
  "spot-empty",
  "search-empty",
  "cart-empty",
  "load-error",
  "barcode-empty",
  "face",
  "face-empty",
  "face-active",
  "face-inactive",
  "pocket",
  "camera",
  "photo-album",
];

if (selectedModule && !moduleNames.includes(selectedModule)) {
  throw new Error(`Unknown brand module: ${selectedModule}`);
}

for (const name of selectedModule ? [selectedModule] : moduleNames) {
  const source = await readFile(
    path.join(brandDirectory, `${name}-master.png`),
  );
  await sharp(source)
    .resize(384, 384)
    .webp({ lossless: true })
    .toFile(path.join(publicDirectory, `${name}.webp`));
  const compactSource = await trimTransparentCanvas(source);
  await sharp(compactSource)
    .resize(256, 256, { fit: "contain", background: transparent })
    .webp({ lossless: true })
    .toFile(path.join(publicDirectory, `${name}-compact.webp`));
  const desktopDirectory = path.join(root, "apps/desktop/public/brand");
  await mkdir(desktopDirectory, { recursive: true });
  for (const suffix of ["", "-compact"]) {
    await writeFile(
      path.join(desktopDirectory, `${name}${suffix}.webp`),
      await readFile(path.join(publicDirectory, `${name}${suffix}.webp`)),
    );
  }
}

console.log(
  selectedModule
    ? `Exported brand module: ${selectedModule}.`
    : "Exported app icons and brand assets.",
);
