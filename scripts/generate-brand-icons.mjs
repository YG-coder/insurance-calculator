// The SVG is the single source for the header and generated browser/device icons.
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const source = new URL("../public/brand-shield.svg", import.meta.url);
for (const [file, size] of [["icon.png", 512], ["apple-icon.png", 180]]) {
  await sharp(source.pathname).resize(size, size).png().toFile(new URL(`../src/app/${file}`, import.meta.url).pathname);
}
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(size => sharp(source.pathname).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, i) => {
  const entry = 6 + i * 16;
  header[entry] = sizes[i];
  header[entry + 1] = sizes[i];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile(new URL("../src/app/favicon.ico", import.meta.url), Buffer.concat([header, ...images]));
