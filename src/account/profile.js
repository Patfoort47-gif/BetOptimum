import { modelComparison, comparisonCard } from '../history/model-comparison.js';
import { shareVisualCard } from '../sharing/visual-card.js';
import { decimal } from '../core/number-format.js';
import { PROFILE_FRAMES } from './profile-appearance.js';
// Page profil (BET-50) : en-tête, onglets, carte joueur partageable, radar, saisons, trophées, compte et confidentialité. Chargée à la demande par app.js.
// Les chiffres de la carte viennent de formules pures de model.js (cardAttributes, cardOverall) ; les données de la vue serveur public_player_card.
import { avatarMarkup } from '../avatar/avatar-view.js';
import { sanitizeAvatar } from '../avatar/avatar-config.js';
import { profileHistory } from './profile-history.js';
import { seasonLabel } from '../club/league.js';
import {
  CELEBRATION_PENDING_KEY,
  celebrationColors,
  equippedOf,
  soundEnabled
} from '../club/celebration-model.js';
const NS = 'http://www.w3.org/2000/svg';
const TABS = [
  ['overview', 'Aperçu'],
  ['badges', 'Trophées'],
  ['bets', 'Mes paris'],
  ['avatar', 'Apparence', true],
  ['notifications', 'Mes alertes', true],
  ['account', 'Compte et confidentialité', true]
];
const DIVISION_COLORS = [
  '#8a6d4b',
  '#b87333',
  '#9aa5b1',
  '#d4a017',
  '#2fa4a4',
  '#7a4dd8',
  '#C8F03C'
];
// Personnalisation de la carte (BET-163) : fond, police du numéro et effet brillant équipés, publics par la vue public_equipped (V39). Mêmes choix dans l'image partagée.
const CARD_LOOK = [
  ['card-bg', 'cardbg'],
  ['card-font', 'cardfont'],
  ['card-shine', 'cardshine']
];
const cardAsset = (equipped, slot) =>
  /^[a-z]{1,20}$/.test(equipped?.[slot]?.asset ?? '') ? equipped[slot].asset : null;
const cardLook = (equipped) =>
  CARD_LOOK.map(([slot, prefix]) =>
    cardAsset(equipped, slot) ? ` ${prefix}-${cardAsset(equipped, slot)}` : ''
  ).join('');
const CARD_FONTS = {
  classic: 'Georgia, "Times New Roman", serif',
  stencil: '"Stencil", "Arial Black", Impact, sans-serif',
  retro: '"Courier New", Courier, monospace'
};
function paintCardBackground(ctx, asset, accent) {
  const fill = (stops, x1 = 0, y1 = 0, x2 = 600, y2 = 800) => {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    stops.forEach(([at, c]) => g.addColorStop(at, c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 600, 800);
  };
  if (asset === 'pitch') {
    fill([
      [0, '#1f6b35'],
      [1, '#0b2a16']
    ]);
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (let y = 0; y < 800; y += 80) ctx.fillRect(0, y, 600, 40);
    return;
  }
  if (asset === 'night') {
    fill([
      [0, '#1b2350'],
      [1, '#05070f']
    ]);
    ctx.fillStyle = 'rgba(244,247,242,.8)';
    for (let i = 0; i < 70; i++) {
      const x = (i * 137) % 600,
        y = (i * 241) % 800;
      ctx.fillRect(x, y, i % 3 ? 2 : 3, i % 3 ? 2 : 3);
    }
    return;
  }
  if (asset === 'carbon') {
    fill([
      [0, '#2a2d31'],
      [1, '#0d0e10']
    ]);
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    ctx.lineWidth = 6;
    for (let x = -800; x < 600; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 800, 800);
      ctx.stroke();
    }
    return;
  }
  if (asset === 'aurora') {
    fill(
      [
        [0, '#0f3d4a'],
        [0.45, '#1f8a70'],
        [0.75, '#5b2a86'],
        [1, '#0A0C0B']
      ],
      0,
      0,
      0,
      800
    );
    return;
  }
  fill([
    [0, accent],
    [1, '#0A0C0B']
  ]);
}
function paintCardShine(ctx, asset) {
  if (!['gloss', 'holo'].includes(asset)) return;
  const g = ctx.createLinearGradient(80, 40, 520, 770);
  if (asset === 'gloss') {
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.42, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,.22)');
    g.addColorStop(0.58, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
  } else
    ['#ff5ec4', '#5ee7ff', '#c8f03c', '#ffd25e', '#a46bff'].forEach((c, i, all) =>
      g.addColorStop(i / (all.length - 1), `${c}33`)
    );
  ctx.fillStyle = g;
  ctx.fill();
}

export function initProfilePage(deps) {
  const {
    html,
    money,
    divisionBadge,
    levelInfo,
    avatarConfig,
    safeLogo,
    BADGES,
    echelonName,
    chevrons,
    divisionIndex,
    model,
    accountApi,
    getState,
    toast,
    openAvatar,
    openJoin,
    navigate,
    onLoggedOut
  } = deps;
  const { cardAttributes, cardOverall, cardProvisional, cardRadarAttributes, CARD_ATTRIBUTES } =
    model;
  const root = document.querySelector('#profile-page');
  let connections = null,
    connectionsRequest = 0;
  let data = null,
    tab = 'overview',
    compare = null,
    target = null,
    token = 0,
    hero = null,
    studio = null,
    notifications = null,
    mountToken = 0;

  const dateLabel = (value) =>
    value
      ? new Date(value).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      : '';
  const color = (echelon) =>
    echelon == null ? '#6b7280' : DIVISION_COLORS[divisionIndex(echelon)];
  const clubCrest = (profile) =>
    profile.heart_club_id && /^\d{1,8}$/.test(profile.heart_club_id)
      ? safeLogo(`https://a.espncdn.com/i/teamlogos/soccer/500/${profile.heart_club_id}.png`)
      : null;

  // Une seule série, issue des mêmes formules que la carte ; axes absents explicités.
  function radar(raw, nickname) {
    const values = cardRadarAttributes(raw),
      size = 320,
      center = 160,
      radius = 112;
    const point = (index, value) => {
      const angle = -Math.PI / 2 + (index * Math.PI) / 3;
      return [
        center + (Math.cos(angle) * radius * value) / 99,
        center + (Math.sin(angle) * radius * value) / 99
      ];
    };
    const rings = [33, 66, 99]
      .map(
        (value) =>
          `<polygon points="${CARD_ATTRIBUTES.map((_, i) => point(i, value).join(',')).join(' ')}" fill="none" stroke="var(--line-strong)"/>`
      )
      .join('');
    const axes = CARD_ATTRIBUTES.map((name, i) => {
      const [x, y] = point(i, 99),
        [lx, ly] = point(i, 120);
      return `<line x1="160" y1="160" x2="${x}" y2="${y}" stroke="var(--line)"/><text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="var(--muted)">${name}</text>`;
    }).join('');
    const complete = CARD_ATTRIBUTES.every((key) => values[key] != null);
    const shape = complete
      ? `<polygon data-radar-series points="${CARD_ATTRIBUTES.map((name, i) => point(i, values[name]).join(',')).join(' ')}" fill="var(--accent)" fill-opacity=".22" stroke="var(--accent-text)" stroke-width="2.5"/>`
      : CARD_ATTRIBUTES.map((name, i) => {
          if (values[name] == null) return '';
          const [x, y] = point(i, values[name]);
          return `<circle cx="${x}" cy="${y}" r="4" fill="var(--accent-text)"/>`;
        }).join('');
    const formulas = [
      'Part des paris gagnés : 20 % → 20, 70 % → 99.',
      'ROI des mises : -30 % → 20, +40 % → 99. Remboursements exclus.',
      'Jours actifs sur 30 jours : 0 → 20, 20 → 99.',
      'Cote moyenne hors systèmes : 1,3 → 20, 4 → 99.',
      'Tickets sur 30 jours : échelle logarithmique de 0 → 20 à 100 → 99.',
      'Mise moyenne / capital initial : 20 % → 20, 2 % → 99.'
    ];
    return `<h3 class="radar-title">Profil de pronostiqueur</h3><p class="radar-subtitle">${html(nickname)} · résultats certifiés · notes sur 99${cardProvisional(raw) ? ' · provisoires (moins de 10 paris réglés)' : ''}</p>${complete ? '' : '<p class="muted">Données incomplètes : seuls les axes connus sont affichés, sans courbe estimée.</p>'}<svg class="radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="${html(CARD_ATTRIBUTES.map((key) => key + ' : ' + (values[key] ?? 'indisponible')).join(', '))}">${rings}${axes}${shape}</svg><dl class="radar-attributes">${CARD_ATTRIBUTES.map((name, i) => `<div><dt>${['Précision', 'Rendement', 'Régularité', 'Audace', 'Volume', 'Discipline'][i]} <small>${name}</small></dt><dd>${values[name] ?? 'N/D'}${values[name] == null ? '' : '<small>/99</small>'}</dd></div>`).join('')}</dl><details><summary>Comprendre les calculs</summary><p>Notes bornées entre 20 et 99, interpolation linéaire sauf Volume. N/D : donnée indisponible.</p><ul>${formulas.map((formula, i) => `<li><b>${CARD_ATTRIBUTES[i]}</b> : ${formula}</li>`).join('')}</ul></details>`;
  }
  function attributesOf(raw) {
    return cardAttributes(raw);
  }
  function cardHtml(info) {
    const attributes = attributesOf(info.raw),
      overall = cardOverall(attributes),
      provisional = cardProvisional(info.raw),
      level = levelInfo(info.xp);
    return `<div class="player-card${info.equipped?.frame ? ` frame-${html(info.equipped.frame.asset)}` : ''}${cardLook(info.equipped)}" style="--card:${color(info.echelon)}" id="player-card"><div class="card-top"><b class="card-overall">${overall}</b><span>${info.echelon == null ? 'Placement' : html(echelonName(info.echelon))}<em>${info.echelon == null ? '' : chevrons(info.echelon)}</em></span></div><strong class="card-name">${html(info.profile.nickname)}</strong><small>Niv. ${level.level} · ${level.title}${provisional ? ' · provisoire' : ''}</small><div class="card-attrs">${CARD_ATTRIBUTES.map((name) => `<span><b>${attributes[name]}</b>${name}</span>`).join('')}</div></div>`;
  }
  // Partage de la carte en image : canvas vers PNG, partage natif sur téléphone, sinon téléchargement.
  async function shareCard(info) {
    const attributes = attributesOf(info.raw),
      overall = cardOverall(attributes),
      level = levelInfo(info.xp),
      canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d'),
      accent = color(info.echelon);
    paintCardBackground(ctx, cardAsset(info.equipped, 'card-bg'), accent);
    const shield = () => {
      ctx.beginPath();
      ctx.moveTo(300, 40);
      ctx.lineTo(560, 110);
      ctx.lineTo(560, 520);
      ctx.quadraticCurveTo(560, 700, 300, 770);
      ctx.quadraticCurveTo(40, 700, 40, 520);
      ctx.lineTo(40, 110);
      ctx.closePath();
    };
    ctx.fillStyle = 'rgba(10,12,11,.78)';
    shield();
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = '#F4F7F2';
    ctx.textAlign = 'center';
    ctx.font = `800 120px ${CARD_FONTS[cardAsset(info.equipped, 'card-font')] ?? '"Barlow Condensed", Impact, sans-serif'}`;
    ctx.fillText(String(overall), 300, 220);
    ctx.font = '700 28px Inter, sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText(
      info.echelon == null
        ? 'Saison de placement'
        : `${echelonName(info.echelon)} ${chevrons(info.echelon)}`,
      300,
      270
    );
    ctx.fillStyle = '#F4F7F2';
    ctx.font = '800 54px "Barlow Condensed", Impact, sans-serif';
    ctx.fillText(info.profile.nickname.toUpperCase(), 300, 345, 440);
    ctx.font = '600 22px Inter, sans-serif';
    ctx.fillStyle = '#C9D3C6';
    ctx.fillText(
      `Niveau ${level.level} · ${level.title}${cardProvisional(info.raw) ? ' · provisoire' : ''}`,
      300,
      385
    );
    CARD_ATTRIBUTES.forEach((name, index) => {
      const x = 130 + (index % 3) * 170,
        y = 470 + Math.floor(index / 3) * 110;
      ctx.fillStyle = '#F4F7F2';
      ctx.font = '800 56px "Barlow Condensed", Impact, sans-serif';
      ctx.fillText(String(attributes[name]), x, y);
      ctx.fillStyle = '#9FB09A';
      ctx.font = '700 20px Inter, sans-serif';
      ctx.fillText(name, x, y + 30);
    });
    ctx.fillStyle = '#9FB09A';
    ctx.font = '500 16px Inter, sans-serif';
    ctx.fillText('BetOptimum · paris virtuels · 18+', 300, 740);
    shield();
    paintCardShine(ctx, cardAsset(info.equipped, 'card-shine'));
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      toast('Impossible de générer l’image de la carte');
      return;
    }
    const file = new File([blob], `carte-${info.profile.nickname}.png`, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Ma carte BetOptimum' });
        return;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    toast('Carte téléchargée');
  }

  // Comparaison : bilan saison par saison des deux joueurs côte à côte.
  function seasonsCompare(info) {
    const months = [...new Set([...info.seasons, ...info.own.seasons].map((row) => row.season))]
        .sort()
        .reverse(),
      cell = (row) =>
        row ? `${html(echelonName(row.to_echelon))} · ${decimal(Number(row.points), 1)} pts` : '-';
    return `<h3>Bilan saison par saison</h3><div class="compare-table"><div class="compare-row compare-head"><span>Saison</span><b>${html(info.profile.nickname)}</b><b>Vous</b></div>${months.map((month) => `<div class="compare-row"><span>${seasonLabel(month)}</span><b>${cell(info.seasons.find((row) => row.season === month))}</b><b>${cell(info.own.seasons.find((row) => row.season === month))}</b></div>`).join('') || '<p class="empty">Aucune saison terminée.</p>'}</div>`;
  }
  function comparisonMarkup(info) {
    if (!info.self) return '';
    const state = getState(),
      r = modelComparison(state.history, state.predictionHistory),
      card = comparisonCard(r);
    return `<section class="settings-card model-comparison"><h3>Toi contre le modèle</h3><p>${card ? card.lines.slice(0, 3).map(html).join(' · ') : 'Pas encore de paire comparable.'}</p><p>Comparaison privée, semaine en cours : une unité par même match de chaque côté, dernier pari simple certifié. Combinés, anciens paris, annulations et pronostics sans cote réelle exclus. Les montants réellement misés ne servent pas à ce calcul.</p>${card ? '<button class="button secondary" data-share-model>Partager ces pourcentages en image</button><small>Uniquement les pourcentages et le nombre de matchs ; aucune identité, mise ni bankroll. Sans partage natif, le PNG est téléchargé.</small>' : ''}</section>`;
  }
  function overview(info) {
    const standing = info.standing,
      state = getState();
    const key = (label, value) =>
      `<div class="key-number"><small>${label}</small><strong>${value}</strong></div>`;
    const personal = info.self ? profileHistory(state.history.filter((b) => b.legacy)) : null;
    if (personal && info.historySummary) {
      const s = info.historySummary;
      for (const key of ['total', 'settled', 'wins', 'pending', 'void', 'staked', 'returned'])
        personal[key] += Number(s[key]);
      personal.profit = personal.returned - personal.staked;
      personal.roi = personal.staked ? (personal.profit / personal.staked) * 100 : null;
      personal.winrate = personal.settled ? (personal.wins / personal.settled) * 100 : null;
      personal.form = s.form || personal.form;
    }
    const form = personal ? personal.form : (standing?.form ?? '');
    const historySummary = personal
      ? `<section class="settings-card"><h3>Tout votre historique</h3><p class="muted">Paris certifiés et ${personal.legacy} ancien${personal.legacy > 1 ? 's' : ''} pari${personal.legacy > 1 ? 's' : ''}. Ce bilan personnel reste privé ; la carte publique et les ligues utilisent les résultats certifiés.</p><div class="key-numbers">${key('Paris réglés', personal.settled)}${key('Paris gagnés', personal.wins)}${key('Réussite', personal.winrate == null ? '-' : decimal(personal.winrate, 1) + ' %')}${key('ROI historique', personal.roi == null ? '-' : decimal(personal.roi, 1) + ' %')}</div><p class="muted">${personal.pending} en attente · ${personal.void} remboursé${personal.void > 1 ? 's' : ''} (exclus du ROI et du taux de réussite)</p></section>`
      : '';
    const stats = info.profile.period_stats?.season ?? { bets: 0, wins: 0, roi: 0 };
    const recent = info.badges
      .slice(0, 4)
      .map((item) => BADGES.find((badge) => badge.id === item.badge))
      .filter(Boolean);
    const trophies = `<section class="overview-trophies settings-card"><div class="settings-row"><h3>Trophées récents</h3><button class="button secondary" data-tab="badges">Tout voir</button></div><div class="badge-grid">${recent.length ? recent.map((badge) => `<div class="badge earned"><b>${html(badge.name)}</b><small>${html(badge.hint)}</small></div>`).join('') : '<p class="empty">Aucun trophée pour le moment.</p>'}</div></section>`;
    return `<div class="overview-grid has-hero"><div class="avatar-hero" data-hero data-hero-id="${html(info.profile.user_id)}"><span class="hero-fallback">${avatarMarkup(info.profile, { cls: 'avatar-3d', kind: 'full', userId: info.profile.user_id, label: `Avatar de ${info.profile.nickname}` })}</span><div class="hero-actions"><button class="button secondary" data-hero-celebrate>Célébrer</button>${info.self ? '<button class="button secondary" data-tab="avatar">Personnaliser</button>' : ''}</div></div><div class="overview-card">${cardHtml(info)}<div class="card-actions">${info.self ? '<button class="button secondary" data-share-card>Partager ma carte</button>' : getState().profile ? '<button class="button secondary" data-compare>' + (compare ? 'Masquer la comparaison' : 'Comparer avec moi') + '</button>' : ''}</div></div><div class="overview-side">${trophies}<div class="key-numbers">${key('Rang du groupe', standing?.confirmed === false ? 'Provisoire' : standing ? `${standing.rank}e` : '-')}${key('Points de ligue', standing ? decimal(Number(standing.points), 1) : '-')}${key('Paris réglés (saison)', Number(stats.bets) || 0)}${key('ROI (saison)', `${Number(stats.roi) >= 0 ? '+' : ''}${decimal(Number(stats.roi || 0), 1)} %`)}</div><div class="form-line"><small>Forme sur les ${info.self ? 10 : 5} derniers pronos</small><span>${
      form
        ? form
            .split('')
            .map(
              (letter) =>
                `<i class="fd ${letter === 'V' ? 'V' : letter === 'N' ? 'N' : 'D'}">${letter}</i>`
            )
            .join('')
        : '<em>Pas encore de pronos réglés</em>'
    }</span></div>${info.self && deps.race?.() ? `<p class="league-race">${deps.race()}</p>` : ''}<div class="radar-box">${radar(info.raw, info.profile.nickname)}</div></div></div>${historySummary}${comparisonMarkup(info)}${compare && info.own?.seasons ? seasonsCompare(info) : ''}`;
  }
  function seasons(info) {
    const rows = info.seasons.slice().reverse();
    return rows.length
      ? `<ol class="season-line">${rows
          .map((row) => {
            const move =
              row.to_echelon > (row.from_echelon ?? -1) && row.outcome === 'PROMU'
                ? 'up'
                : row.outcome === 'RELEGUE'
                  ? 'down'
                  : 'same';
            return `<li class="${move}"><small>${seasonLabel(row.season)}</small><span>${divisionBadge(row.from_echelon)}<i aria-hidden="true">→</i>${divisionBadge(row.to_echelon)}</span><em>${row.group_rank ? `${row.group_rank}e sur ${row.group_size} · ` : ''}${decimal(Number(row.points), 1)} pts · ${{ PROMU: 'Promu', RELEGUE: 'Relégué', MAINTENU: 'Maintenu', PLACE: 'Placé', INACTIF: 'Inactif' }[row.outcome] ?? ''}</em></li>`;
          })
          .join('')}</ol>`
      : '<p class="empty">Aucune saison terminée pour le moment : la première clôture a lieu à la fin de la saison de football.</p>';
  }
  function badges(info) {
    const earned = new Map(info.badges.map((item) => [item.badge, item.earned_at]));
    return `<div class="badge-grid">${BADGES.map((badge) => `<div class="badge${earned.has(badge.id) ? ' earned' : ''}"><b>${html(badge.name)}</b><small>${html(badge.hint)}</small><em>${earned.has(badge.id) ? `Obtenu le ${dateLabel(earned.get(badge.id))}` : `+${badge.xp} XP`}</em></div>`).join('')}</div>`;
  }
  function bets(info) {
    if (info.self)
      return `<p class="muted">Votre historique complet est dans l’onglet « Mes paris ». Les autres joueurs ne voient le détail que si vous l’autorisez dans « Compte et confidentialité ».</p><button class="button secondary" data-open-bets>Ouvrir mes paris</button>`;
    if (!info.profile.show_bets || !info.bets)
      return '<p class="empty">Ce joueur a choisi de masquer le détail de ses paris.</p>';
    return info.bets.length
      ? `<div class="public-bets">${info.bets.map((bet) => `<div class="public-bet ${bet.status}"><small>${dateLabel(bet.placed_at)} · ${bet.bet_type === 'multiple' ? 'Système' : bet.selections.length > 1 ? `Combiné ${bet.selections.length} sélections` : 'Simple'} · cote ${decimal(Number(bet.odds), 2)}</small>${bet.selections.map((item) => `<span>${html(item.match)} · <b>${html(item.label)}</b></span>`).join('')}<em class="status ${bet.status}">${{ won: 'Gagné', lost: 'Perdu', void: 'Remboursé', pending: 'En attente' }[bet.status]}</em>${bet.status === 'pending' && bet.bet_type !== 'multiple' ? `<button type="button" class="button secondary" data-copy-bet="${html(bet.id)}">Copier le pari</button>` : ''}</div>`).join('')}</div>`
      : '<p class="empty">Aucun pari à afficher.</p>';
  }
  function account(info) {
    const profile = info.profile,
      state = getState();
    return `<div class="account-settings"><header class="account-intro"><span class="account-eyebrow">ESPACE PERSONNEL</span><h3>Votre compte.<br>Vos règles du jeu.</h3><p>Une identité qui vous ressemble, une visibilité que vous maîtrisez.</p><div class="account-status"><span>✓ Mises et bankroll toujours privées</span><span>✓ Données exportables à tout moment</span></div></header><section class="account-group" aria-labelledby="account-identity"><div class="account-group-title"><span>01</span><div><h3 id="account-identity">Identité et sécurité</h3><p>Les clés de votre espace BetOptimum.</p></div></div><form data-form="nickname" class="settings-card"><h3>Pseudo</h3><p class="muted">Modifiable une fois par mois. Votre pseudo est unique.</p><div class="settings-row"><input name="nickname" value="${html(profile.nickname)}" minlength="3" maxlength="24" pattern="[A-Za-zÀ-ÿ0-9_. -]{3,24}" required aria-label="Pseudo"><button class="button secondary">Changer</button></div></form>
<form data-form="email" class="settings-card"><h3>Adresse email</h3><p class="muted">Un lien de confirmation est envoyé à la nouvelle adresse.</p><div class="settings-row"><input name="email" type="email" placeholder="nouvelle@adresse.fr" required autocomplete="email" aria-label="Nouvelle adresse email"><button class="button secondary">Modifier</button></div></form>
<form data-form="password" class="settings-card"><h3>Mot de passe</h3><div class="settings-row"><input name="password" type="password" minlength="8" placeholder="Nouveau mot de passe (8 caractères)" required autocomplete="new-password" aria-label="Nouveau mot de passe"><button class="button secondary">Modifier</button></div></form>
</section><section class="account-group" aria-labelledby="account-visibility"><div class="account-group-title"><span>02</span><div><h3 id="account-visibility">Votre visibilité au Club</h3><p>Choisissez ce que les autres joueurs peuvent découvrir.</p></div></div><div class="settings-card"><h3>Confidentialité</h3><label class="switch-line"><input type="checkbox" data-setting="is_public" ${profile.is_public ? 'checked' : ''}><span><b>Profil public</b><small>Les autres joueurs voient votre profil, votre carte et vos trophées. Votre pseudo et vos résultats restent visibles dans les classements.</small></span></label><label class="switch-line"><input type="checkbox" data-setting="show_bets" ${profile.show_bets ? 'checked' : ''}><span><b>Détail de mes paris visible</b><small>Sélections, cotes et résultats, jamais les mises ni la bankroll.</small></span></label></div>
</section><section class="account-group" aria-labelledby="account-data"><div class="account-group-title"><span>03</span><div><h3 id="account-data">Préférences et données</h3><p>Gardez la main sur vos communications et votre historique.</p></div></div><section class="settings-card" data-newsletter><h3>Newsletter BetOptimum</h3><p>Chargement de votre inscription…</p></section><div class="settings-card"><h3>Mes données</h3><p class="muted">Téléchargez toutes vos données (profil, paris, ligues et XP) au format JSON.</p><button class="button secondary" data-export>Exporter mes données</button></div>
</section><section class="account-group account-danger" aria-labelledby="account-danger"><div class="account-group-title"><span>!</span><div><h3 id="account-danger">Zone sensible</h3><p>La suppression du compte est irréversible.</p></div></div><form data-form="delete" class="settings-card danger"><h3>Supprimer mon compte</h3><p class="muted">Définitif : votre profil, vos paris, vos classements, votre XP sont effacés. Saisissez votre pseudo <b>${html(profile.nickname)}</b> pour confirmer.</p><div class="settings-row"><input name="confirm" placeholder="Votre pseudo" required aria-label="Confirmation par le pseudo" autocomplete="off"><button class="button danger">Supprimer définitivement</button></div></form></section><p class="settings-feedback" role="status" aria-live="polite"></p></div>`;
  }
  function avatarTab(info) {
    return `<section class="settings-card"><h3>Cadre de profil</h3><form data-profile-frame><div class="profile-frame-preview"><h4>Aperçu</h4><div data-frame-preview role="status" aria-live="polite">${avatarMarkup(info.profile, { cls: 'avatar-3d', label: 'Aperçu du cadre de profil' })}</div><small>Le même cadre dans les classements et le Hall of Fame.</small></div><label>Cadre<select name="frame">${PROFILE_FRAMES.map(([id, label]) => `<option value="${id}"${info.profile.profile_frame === id ? ' selected' : ''}>${label}</option>`).join('')}</select></label><button class="button secondary">Enregistrer le cadre</button></form><p>Vos badges gagnés sont affichés dans l’onglet Trophées.</p></section><div class="avatar-studio-slot" data-studio></div>`;
  }

  // Avatar 3D : scène de l'en-tête de l'aperçu (Three.js chargé à la demande) et studio de l'onglet Avatar ; une seule scène à la fois, libérée au changement d'onglet.
  function cleanup() {
    mountToken++;
    hero?.dispose();
    hero = null;
    studio?.destroy();
    studio = null;
    notifications?.destroy();
    notifications = null;
  }
  async function mountHero(info) {
    const host = root.querySelector('[data-hero]'),
      mine = mountToken;
    if (!host) return;
    try {
      const { webglSupported, createStage } = await import('../avatar/avatar.js');
      if (!webglSupported() || mine !== mountToken) return;
      const stage = await createStage(host, {
        look: info.profile.avatar_config,
        view: 'full',
        label: `Avatar 3D de ${info.profile.nickname}`
      });
      if (mine !== mountToken || !host.isConnected) {
        stage.dispose();
        return;
      }
      hero = stage;
      host.querySelector('.hero-fallback')?.remove();
      host.classList.add('live');
      if (info.self) {
        const key = `${CELEBRATION_PENDING_KEY}:${info.profile.user_id}`;
        let pending = false;
        try {
          pending = localStorage.getItem(key) === '1';
          localStorage.removeItem(key);
        } catch {
          /* stockage indisponible */
        }
        if (pending && !matchMedia('(prefers-reduced-motion: reduce)').matches) celebrateHero(info);
      }
    } catch (error) {
      console.warn('Avatar 3D indisponible', error?.message);
    }
  }
  // Célébration 3D équipée, avec l'effet de victoire et, si le joueur l'a activé, le son équipé (objets privés : seulement sur son propre profil).
  async function celebrateHero(info) {
    hero?.celebrate();
  }

  async function mountStudioTab(info) {
    const host = root.querySelector('[data-studio]'),
      mine = mountToken;
    if (!host) return;
    const { mountStudio } = await import('../avatar/avatar-studio.js');
    if (mine !== mountToken) return;
    const state = getState(),
      initial = sanitizeAvatar(
        info.profile.avatar_config ?? state.profile?.avatar2 ?? state.profile
      );
    const handle = await mountStudio(host, {
      html,
      toast,
      initial,
      authenticated: Boolean(info.self),
      userId: info.profile.user_id,
      freeOnly: true,
      tabs: ['face', 'hair', 'kit'],
      loadContext: async () => ({ inventory: [], unlocks: [] }),
      openJoin,
      save: async (config, blobs) => {
        const saved = await accountApi.saveAvatar(config, blobs);
        data.profile.avatar_config = saved;
        const slot = root.querySelector('.profile-id')?.firstElementChild;
        if (slot)
          slot.outerHTML = avatarMarkup(data.profile, {
            cls: 'avatar-3d',
            userId: data.profile.user_id
          });
        deps.onAvatarSaved?.(saved);
        return saved;
      }
    });
    if (mine !== mountToken) {
      handle.destroy();
      return;
    }
    studio = handle;
  }

  function connectionPanel() {
    if (!connections) return '';
    const title = connections.kind === 'followers' ? 'Abonnés' : 'Abonnements';
    return `<section class="connections-panel settings-card" aria-label="${title}" aria-live="polite"><p class="muted">Les profils privés sont masqués dans les listes.</p><div class="settings-row"><h3>${title}</h3><button class="button secondary" data-close-connections>Fermer la liste</button></div>${connections.loading ? '<p>Chargement…</p>' : connections.error ? '<p>Impossible de charger la liste.</p><button class="button secondary" data-connections="' + connections.kind + '">Réessayer</button>' : `<ul>${connections.rows.map((person) => `<li><a href="#joueur-${encodeURIComponent(person.nickname)}">${html(person.nickname)}</a></li>`).join('')}</ul>${connections.rows.length ? '' : '<p class="empty">' + (connections.kind === 'followers' ? 'Aucun abonné pour le moment.' : 'Aucun abonnement pour le moment.') + '</p>'}${connections.more ? '<button class="button secondary" data-more-connections>Voir la suite</button>' : ''}`}</section>`;
  }
  async function loadConnections(kind, more = false) {
    const mine = ++connectionsRequest,
      current = data;
    const previous = more ? connections.rows : [];
    connections = { kind, rows: previous, loading: true };
    render();
    try {
      const result = await accountApi.community.connections(
        current.profile.user_id,
        kind,
        previous.length
      );
      if (mine !== connectionsRequest || current !== data) return;
      connections = { kind, rows: [...previous, ...result.rows], more: result.more };
    } catch {
      if (mine !== connectionsRequest || current !== data) return;
      connections = { kind, rows: [], error: true };
    }
    render();
    root.querySelector('[data-close-connections]')?.focus();
  }
  function render() {
    cleanup();
    if (!data) {
      root.innerHTML = '<p class="empty">Chargement du profil…</p>';
      return;
    }
    if (data.failed) {
      root.innerHTML = `<p class="empty">${html(data.failed)}</p><button class="button secondary" data-reload-profile>Réessayer</button>`;
      return;
    }
    if (data.missing) {
      root.innerHTML =
        '<p class="empty">Ce joueur n’existe pas.</p><button class="button secondary" data-back-home>Retour</button>';
      return;
    }
    if (data.private) {
      root.innerHTML = `<div class="profile-private"><h2>${html(data.profile.nickname)}</h2><p class="empty">Ce profil est privé.</p><button class="button secondary" data-back-home>Retour à la communauté</button></div>`;
      return;
    }
    const info = data,
      level = levelInfo(info.xp),
      crest = clubCrest(info.profile),
      visibleTabs = TABS.filter(
        ([id, , own]) => (!own || info.self) && (id !== 'bets' || !info.self)
      );
    if (!visibleTabs.some(([id]) => id === tab)) tab = 'overview';
    const body = {
      overview,
      seasons,
      badges,
      bets,
      avatar: avatarTab,
      notifications: () => '<div data-notifications></div>',
      account
    }[tab](info);
    root.innerHTML = `<header class="profile-header" style="--banner:${color(info.echelon)}"><div class="profile-banner"></div><div class="profile-id">${avatarMarkup(info.profile, { cls: 'avatar-3d', userId: info.profile.user_id })}<div class="profile-title"><h2>${html(info.profile.nickname)}</h2>${info.equipped?.title ? `<small class="profile-subtitle">${html(info.equipped.title.asset ?? info.equipped.title.name)}</small>` : ''}<div class="profile-badges">${divisionBadge(info.echelon)}<span class="level-chip">${level.level}</span><b>${level.title}</b>${crest ? `<img class="profile-crest" src="${crest}" alt="${html(info.profile.heart_club_name ?? 'Club de cœur')}" width="26" height="26">` : ''}</div><small>Membre depuis le ${dateLabel(info.profile.joined_at)}</small><div class="profile-connections">${['followers', 'following'].map((kind) => `<button class="button secondary" data-connections="${kind}"><b>${info.connections?.[kind] ?? '?'}</b> ${kind === 'followers' ? 'Abonné' : 'Abonnement'}${info.connections?.[kind] === 1 ? '' : 's'}</button>`).join('')}</div></div><div class="profile-actions">${info.self ? '<button class="button secondary" data-share-card>Partager ma carte</button><button class="button secondary" data-tab="account">Modifier le profil</button>' : (deps.extraActions?.(info) ?? '')}</div></div></header><div class="profile-tabs" role="tablist">${visibleTabs.map(([id, label]) => `<button role="tab" id="ptab-${id}" aria-selected="${tab === id}" data-tab="${id}">${label}</button>`).join('')}</div>${connectionPanel()}<div class="profile-body" role="tabpanel">${body}</div>`;
    if (tab === 'notifications' && info.self) {
      const mine = mountToken;
      import('../notifications/notification-page.js?v=bet310')
        .then(async ({ mountNotifications }) => {
          if (mine !== mountToken) return;
          const handle = await mountNotifications(root.querySelector('[data-notifications]'), {
            api: accountApi.notifications,
            html,
            toast,
            getState
          });
          if (mine !== mountToken) handle.destroy();
          else notifications = handle;
        })
        .catch(() => {
          if (mine === mountToken)
            root.querySelector('[data-notifications]').textContent =
              'Les alertes sont indisponibles.';
        });
    }
    if (tab === 'account' && info.self) {
      const mine = mountToken;
      import('./newsletter.js')
        .then(({ mountNewsletter }) => {
          if (mine === mountToken)
            return mountNewsletter(root.querySelector('[data-newsletter]'), {
              api: accountApi.newsletter,
              html,
              toast
            });
        })
        .catch(() => {
          if (mine === mountToken)
            root.querySelector('[data-newsletter]').textContent =
              'La newsletter est momentanément indisponible.';
        });
    }
    if (tab === 'overview') mountHero(info);
    else if (tab === 'avatar' && info.self) mountStudioTab(info);
  }

  async function show(next) {
    connections = null;
    connectionsRequest++;
    target = next;
    const mine = ++token;
    tab = next.tab ?? 'overview';
    compare = null;
    data = null;
    render();
    try {
      const result = await accountApi.loadPlayer(
        next.self ? { self: true } : { nickname: next.nickname }
      );
      if (mine !== token) return;
      data = result ?? { missing: true };
      const loaded = data;
      if (data.profile && !data.private && !data.missing && !data.self && getState().profile) {
        try {
          const own = await accountApi.loadPlayer({ self: true });
          if (mine !== token) return;
          compare = null;
          loaded.own = own;
        } catch {
          /* comparaison indisponible */
        }
      }
      if (data.profile && !data.private && !data.missing) {
        const current = data;
        try {
          const counts = await accountApi.community.connections(data.profile.user_id);
          if (mine !== token) return;
          current.connections = counts;
        } catch {
          /* Compteurs indisponibles : ne pas afficher un faux zéro. */
        }
      }
      if (mine !== token) return;
    } catch (error) {
      if (mine === token)
        data = {
          failed:
            error?.code === 'SCHEMA'
              ? error.message
              : 'Le profil n’a pas pu être chargé. Vérifiez votre connexion puis réessayez.'
        };
      console.warn('Profil indisponible', error?.message);
    }
    if (mine === token) render();
  }

  root.addEventListener('change', (event) => {
    if (!event.target.matches('[data-profile-frame] select[name="frame"]')) return;
    const preview = root.querySelector('[data-frame-preview]');
    if (preview)
      preview.innerHTML = avatarMarkup(
        { ...data.profile, profile_frame: event.target.value },
        { cls: 'avatar-3d', label: 'Aperçu du cadre de profil' }
      );
  });
  root.addEventListener('submit', async (event) => {
    if (!event.target.matches('[data-profile-frame]')) return;
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    try {
      const frame = new FormData(event.target).get('frame');
      await accountApi.setProfileFrame(frame);
      data.profile.profile_frame = frame;
      render();
      toast('Cadre enregistré');
    } catch (error) {
      toast(error.message);
      button.disabled = false;
    }
  });
  root.addEventListener('click', async (event) => {
    const connectionButton = event.target.closest('[data-connections]');
    if (connectionButton) {
      loadConnections(connectionButton.dataset.connections);
      return;
    }
    if (event.target.closest('[data-more-connections]')) {
      loadConnections(connections.kind, true);
      return;
    }
    if (event.target.closest('[data-close-connections]')) {
      const kind = connections.kind;
      connections = null;
      connectionsRequest++;
      render();
      root.querySelector(`[data-connections="${kind}"]`)?.focus();
      return;
    }
    if (event.target.closest('[data-reload-profile]')) {
      show(target);
      return;
    }
    const copyButton = event.target.closest('[data-copy-bet]');
    if (copyButton) {
      const bet = data?.bets?.find((b) => b.id === copyButton.dataset.copyBet);
      if (bet) deps.copyBet?.(bet, data.profile.nickname);
      return;
    }
    const tabButton = event.target.closest('[data-tab]');
    if (tabButton) {
      tab = tabButton.dataset.tab;
      render();
      root.querySelector(`#ptab-${tab}`)?.focus();
      return;
    }
    if (event.target.closest('[data-share-model]')) {
      if (!data?.self) return;
      const state = getState(),
        payload = comparisonCard(modelComparison(state.history, state.predictionHistory));
      if (!payload) return;
      try {
        const result = await shareVisualCard(payload, location.origin + location.pathname);
        if (result === 'downloaded') toast('Image téléchargée pour votre message.');
      } catch {
        toast('Le partage a échoué. Réessayez.');
      }
      return;
    }
    if (event.target.closest('[data-share-card]')) {
      shareCard(data);
      return;
    }
    if (event.target.closest('[data-compare]')) {
      compare = compare ? null : data.own?.raw ? { raw: data.own.raw } : null;
      if (!compare && !data.own) toast('Connectez-vous pour comparer');
      render();
      return;
    }
    if (event.target.closest('[data-open-avatar]')) {
      openAvatar();
      return;
    }
    if (event.target.closest('[data-hero-celebrate]')) {
      if (hero) celebrateHero(data);
      else toast('Le rendu 3D n’est pas disponible sur cet appareil');
      return;
    }
    if (event.target.closest('[data-open-bets]')) {
      navigate('bankroll');
      return;
    }
    if (event.target.closest('[data-back-home]')) {
      navigate('community');
      return;
    }
    if (event.target.closest('[data-export]')) {
      try {
        const blob = new Blob([JSON.stringify(await accountApi.exportData(), null, 2)], {
            type: 'application/json'
          }),
          link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `betoptimum-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 2000);
        toast('Export téléchargé');
      } catch (error) {
        toast(error.message);
      }
      return;
    }
    deps.onClick?.(event, { data, show: () => show(target) });
  });
  function settingsFeedback(message, failed = false) {
    const host = root.querySelector('.settings-feedback');
    if (host) {
      host.textContent = message;
      host.classList.toggle('failed', failed);
    }
    toast(message);
  }
  root.addEventListener('change', async (event) => {
    const pref = event.target.closest('[data-pref]');
    if (pref) {
      deps.setPreference?.(pref.dataset.pref, pref.checked);
      settingsFeedback(pref.checked ? 'Son des célébrations activé' : 'Son des célébrations coupé');
      return;
    }
    const setting = event.target.closest('[data-setting]');
    if (!setting) return;
    const current = data,
      checked = setting.checked;
    setting.disabled = true;
    try {
      await accountApi.updateSettings({ [setting.dataset.setting]: checked });
      current.profile[setting.dataset.setting] = checked;
      if (current === data) settingsFeedback('Préférence enregistrée');
    } catch (error) {
      setting.checked = !checked;
      if (current === data) settingsFeedback(error.message, true);
    } finally {
      setting.disabled = false;
    }
  });
  root.addEventListener('submit', async (event) => {
    if (!event.target.closest('[data-form]')) return;
    event.preventDefault();
    const form = event.target.closest('[data-form]'),
      values = Object.fromEntries(new FormData(form)),
      kind = form.dataset.form,
      button = form.querySelector('button');
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    try {
      if (kind === 'nickname') {
        const nickname = await accountApi.changeNickname(String(values.nickname).trim());
        getState().profile.nickname = nickname;
        data.profile.nickname = nickname;
        deps.onNickname?.(nickname);
        render();
        settingsFeedback('Pseudo modifié');
      } else if (kind === 'email') {
        await accountApi.updateEmail(String(values.email).trim());
        form.reset();
        settingsFeedback('Lien de confirmation envoyé à la nouvelle adresse');
      } else if (kind === 'password') {
        await accountApi.auth.updatePassword(String(values.password));
        form.reset();
        settingsFeedback('Mot de passe modifié');
      } else if (kind === 'delete') {
        await accountApi.deleteAccount(String(values.confirm));
        toast('Votre compte a été supprimé');
        onLoggedOut();
      }
    } catch (error) {
      settingsFeedback(error.message, true);
    }
    button.disabled = false;
    form.removeAttribute('aria-busy');
  });
  return { show, refresh: () => target && show(target), stop: cleanup };
}
