import { copyFile, cp, readdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve('cardiac-simulator/dist');
const target = resolve('public/cardiac-simulator');
const assets = resolve(target, 'assets');
const nextAssets = new Set(await readdir(resolve(source, 'assets')));

// Keep the existing Duke Heart 4D dataset and logo in public/.
await cp(resolve(source, 'assets'), assets, { recursive: true });
await copyFile(resolve(source, 'index.html'), resolve(target, 'index.html'));
for (const entry of await readdir(assets, { withFileTypes: true })) {
  if (entry.isFile() && !nextAssets.has(entry.name)) {
    await unlink(resolve(assets, entry.name));
  }
}
console.log('Simulador cardíaco actualizado en public/cardiac-simulator.');
