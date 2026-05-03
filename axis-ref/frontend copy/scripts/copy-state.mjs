import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "../../data");
const publicDir = resolve(__dirname, "../public");

mkdirSync(publicDir, { recursive: true });

const targets = [
  { src: resolve(dataDir, "state.json"), dst: resolve(publicDir, "state.json"), required: true },
  { src: resolve(dataDir, "intel.json"), dst: resolve(publicDir, "intel.json"), required: false },
];

let missingRequired = false;
for (const { src, dst, required } of targets) {
  if (!existsSync(src)) {
    const msg =
      `[copy-state] ${src} does not exist. Run the backend exporter first:\n` +
      `  cd backend && python -m axis export --scenario eastern_europe --out ../data/state.json`;
    if (required) {
      missingRequired = true;
      console.warn(msg);
    } else {
      console.warn(`[copy-state] (optional) ${src} not found - frontend will run without it.`);
    }
    continue;
  }
  copyFileSync(src, dst);
  console.log(`[copy-state] ${src} -> ${dst}`);
}

if (missingRequired) process.exit(0);
