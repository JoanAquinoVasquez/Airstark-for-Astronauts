import { cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve('GD-con-Simulacion/frontend/dist');
const target = resolve('public/cardiac-simulator');

if (!existsSync(source)) {
  console.error('❌ Error: Primero compila el frontend de GD-con-Simulacion.');
  process.exit(1);
}

try {
  await rm(target, { recursive: true, force: true });
  await cp(source, target, { recursive: true });
  console.log('✅ Simulador cardíaco sincronizado con éxito en public/cardiac-simulator/');
} catch (error) {
  console.error('Error al sincronizar:', error.message);
  process.exit(1);
}
