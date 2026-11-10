import { writeFile } from 'node:fs/promises';

const url = process.env.SUPABASE_URL ?? '';
const key = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? '';

if (process.argv.includes('--required') && (!url || !key)) {
  console.error(
    'Configuration Supabase manquante. Ajoutez SUPABASE_URL et SUPABASE_ANON_KEY (ou SUPABASE_PUBLISHABLE_KEY) dans les Variables ou Secrets GitHub Actions.'
  );
  process.exit(1);
}

if (url && !/^https:\/\/.+\.supabase\.co\/?$/.test(url)) {
  console.error('SUPABASE_URL doit être une URL de projet https://…supabase.co.');
  process.exit(1);
}

if (key && key.length <= 20) {
  console.error(
    'La clé publique Supabase semble incomplète. Copiez la clé anon ou publishable complète.'
  );
  process.exit(1);
}

await writeFile(
  'src/account/supabase-config.js',
  `export const SUPABASE_URL = ${JSON.stringify(url)};\nexport const SUPABASE_ANON_KEY = ${JSON.stringify(key)};\n`
);
console.log(
  url && key ? 'Configuration Supabase injectée.' : 'Supabase non configuré : mode local conservé.'
);
