import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "public/icons/icon.svg");

async function main() {
  const svg = await readFile(source);
  await sharp(svg).resize(192, 192).png().toFile(path.join(root, "public/icons/icon-192.png"));
  await sharp(svg).resize(512, 512).png().toFile(path.join(root, "public/icons/icon-512.png"));

  // Maskable icon: keep the important 80% inside the safe zone.
  const inner = await sharp(svg).resize(410, 410).png().toBuffer();
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 13, g: 95, b: 76, alpha: 1 },
    },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toFile(path.join(root, "public/icons/maskable-512.png"));

  console.log("Generated PWA icons in public/icons");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
