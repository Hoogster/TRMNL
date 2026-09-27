// Rasterizes the hand-authored plugin SVGs to 512x512 PNGs for the TRMNL private-plugin
// icon upload field. Run from backend/ so it resolves the installed `sharp` dependency:
//   node scripts/generate-icons.js
const path = require("path");
const sharp = require("sharp");

const ICONS = [
  ["../../trmnl-plugins/weather/icon.svg", "../../trmnl-plugins/weather/icon-512.png"],
  ["../../trmnl-plugins/todo/icon.svg", "../../trmnl-plugins/todo/icon-512.png"],
  ["../../trmnl-plugins/menu/icon.svg", "../../trmnl-plugins/menu/icon-512.png"],
];

async function main() {
  for (const [src, dest] of ICONS) {
    const srcPath = path.join(__dirname, src);
    const destPath = path.join(__dirname, dest);
    await sharp(srcPath).resize(512, 512).png().toFile(destPath);
    console.log(`wrote ${dest}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
