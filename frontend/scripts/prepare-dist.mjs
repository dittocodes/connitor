import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'out');
const distDir = path.join(root, 'dist');

if (!fs.existsSync(outDir)) {
  console.error('Build output folder "out" not found. Did "next build" succeed?');
  process.exit(1);
}

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

fs.cpSync(outDir, distDir, { recursive: true });
fs.rmSync(outDir, { recursive: true, force: true });

console.log('Amplify-ready static export created at ./dist');
