import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readEnvFile(path) {
  if (!existsSync(path)) return {};

  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
        return [key, value];
      }),
  );
}

const localCredentials = readEnvFile(resolve(mobileRoot, '../web/.env.local'));
const email = process.env.MAESTRO_E2E_EMAIL || localCredentials.EMAIL_DE_CONNEXION;
const password = process.env.MAESTRO_E2E_PASSWORD || localCredentials.MDP_Compte;

if (!email || !password) {
  console.error(
    'Identifiants absents. Définissez MAESTRO_E2E_EMAIL et MAESTRO_E2E_PASSWORD, ou EMAIL_DE_CONNEXION et MDP_Compte dans apps/web/.env.local.',
  );
  process.exit(1);
}

const lookupCommand = process.platform === 'win32' ? 'where.exe' : 'which';
const maestroLookup = spawnSync(lookupCommand, ['maestro'], { stdio: 'ignore' });

if (maestroLookup.status !== 0) {
  console.error('Maestro CLI est introuvable. Installez-le ou utilisez un runner cloud compatible.');
  process.exit(1);
}

const result = spawnSync('maestro', ['test', '.maestro/flows/authenticated-shell.yaml'], {
  cwd: mobileRoot,
  env: {
    ...process.env,
    MAESTRO_E2E_EMAIL: email,
    MAESTRO_E2E_PASSWORD: password,
  },
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Impossible de lancer Maestro : ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
