import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function printUsage() {
  console.log(
    [
      'Usage:',
      '  npm run changelog:add -- --version 1.0.1 --title "Short title" --note "First change" --note "Second change"',
      '',
      'Options:',
      '  --version   Required. App version label shown in the mobile changelog.',
      '  --title     Required. Short release title.',
      '  --note      Required at least once. Repeat for each changelog bullet.',
      '  --date      Optional ISO date for published_at. Defaults to timezone(\'utc\', now()).',
      '  --slug      Optional custom file slug.',
    ].join('\n')
  );
}

function parseArgs(argv) {
  const args = {
    version: '',
    title: '',
    notes: [],
    date: '',
    slug: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];

    if (token === '--help' || token === '-h') {
      printUsage();
      process.exit(0);
    }

    if (!token.startsWith('--')) {
      continue;
    }

    if (!value || value.startsWith('--')) {
      console.error(`Missing value for ${token}`);
      printUsage();
      process.exit(1);
    }

    switch (token) {
      case '--version':
        args.version = value.trim();
        index += 1;
        break;
      case '--title':
        args.title = value.trim();
        index += 1;
        break;
      case '--note':
        args.notes.push(value.trim());
        index += 1;
        break;
      case '--date':
        args.date = value.trim();
        index += 1;
        break;
      case '--slug':
        args.slug = value.trim();
        index += 1;
        break;
      default:
        console.error(`Unknown option: ${token}`);
        printUsage();
        process.exit(1);
    }
  }

  if (!args.version || !args.title || args.notes.length === 0) {
    console.error('Missing required arguments.');
    printUsage();
    process.exit(1);
  }

  return args;
}

function createTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
  ].join('');
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function escapeSql(value) {
  return value.replace(/'/g, "''");
}

function escapeSqlMultiline(value) {
  return escapeSql(value).replace(/\n/g, '\\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
  const timestamp = createTimestamp();
  const slug = args.slug ? slugify(args.slug) : slugify(args.title);
  const fileName = `${timestamp}_add_app_changelog_${slug || 'entry'}.sql`;
  const filePath = path.join(migrationsDir, fileName);

  const detail = args.notes.map((note) => `- ${note}`).join('\n');
  const publishedAtSql = args.date
    ? `'${escapeSql(args.date)}'::timestamptz`
    : "timezone('utc', now())";

  const sql = [
    'insert into public.app_changelog (version, title, detail, published_at)',
    'values (',
    `  '${escapeSql(args.version)}',`,
    `  '${escapeSql(args.title)}',`,
    `  E'${escapeSqlMultiline(detail)}',`,
    `  ${publishedAtSql}`,
    ')',
    'on conflict (version) do update',
    'set title = excluded.title,',
    '    detail = excluded.detail,',
    '    published_at = excluded.published_at,',
    '    is_published = true;',
    '',
  ].join('\n');

  await mkdir(migrationsDir, { recursive: true });
  await writeFile(filePath, sql, 'utf8');

  console.log(`Created changelog migration: ${path.relative(repoRoot, filePath)}`);
  console.log('Next step: apply the migration on Supabase, then publish your mobile update/build.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
