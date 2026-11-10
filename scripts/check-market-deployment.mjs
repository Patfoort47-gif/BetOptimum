// BET-170 : vérification en lecture seule avant toute collecte/écriture de l'étape 3.
import { pathToFileURL } from 'node:url';
import { createAdmin } from './supabase-admin.mjs';
export async function checkMarketDeployment(stage, admin, h1Enabled = false) {
  if (![0, 1, 2, 3, 4].includes(stage)) throw new Error('Étape de marchés invalide');
  if (stage < 3 && !h1Enabled) return;
  if (!admin) throw new Error('Étape 3 : Supabase serveur requis ; appliquer V41 avant activation');
  await admin.select('fixtures', 'select=market_valid_until,odds_bookmaker_counts&limit=1');
  const label = await admin.rpc('market_label', {
    k: 'score1_0',
    home_team: 'Alpha',
    away_team: 'Beta'
  });
  if (label !== 'Score exact 1 - 0') throw new Error('Étape 3 : migration V41 requise');
  if (h1Enabled) {
    await admin.select('fixtures', 'select=period_scores&limit=1');
    const label = await admin.rpc('market_label', {
      k: 'h1Home',
      home_team: 'Alpha',
      away_team: 'Beta'
    });
    if (label !== '1re mi-temps : Alpha') throw new Error('H1 : migration V45 requise');
  }
  if (stage >= 4) {
    const composite = await admin.rpc('market_label', {
      k: 'comboHomeBttsYes',
      home_team: 'Alpha',
      away_team: 'Beta'
    });
    if (composite !== 'Alpha + Les deux marquent')
      throw new Error('Étape 4 : migration V44 requise');
  }
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await checkMarketDeployment(
    Number(process.env.PROPLINE_MARKET_STAGE ?? 0),
    createAdmin(),
    process.env.PROPLINE_H1_ENABLED === 'true'
  );
  console.log('Compatibilité des marchés vérifiée.');
}
