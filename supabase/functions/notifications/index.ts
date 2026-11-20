import { planDailyPush, dailyPushCurrent } from '../../../src/notifications/notification-daily.js';
import { validatedResultCurrent } from '../../../src/notifications/notification-result.js';
import webPush from 'npm:web-push@3.6.7';
// BET-69 : déployer avec --no-verify-jwt ; chaque route vérifie explicitement son identité.
import { runScheduledReminders } from '../../../src/notifications/notification-scheduler.js';
import {
  NotificationFailure,
  reportNotificationFailure
} from '../../../src/notifications/notification-diagnostics.js';
import { emailSenderStatus } from '../../../src/notifications/email-sender.js';
import { notificationConfig } from '../../../src/notifications/notification-config.js';
import { briefingDataStatus } from '../../../src/notifications/briefing-data.js';
import { planBriefing } from '../../../src/notifications/notification-briefing.js';
import { prepareBriefing } from '../../../src/notifications/notification-briefing-service.js';
import {
  detectFavoriteReminders,
  favoriteReminderCurrent
} from '../../../src/notifications/notification-reminder.js';
import { decodeWorkerMatches } from '../../../src/notifications/notification-worker-codec.js';
import {
  deliver,
  seal,
  unseal,
  validateDestination
} from '../../../src/notifications/notification-delivery.js';
const env = Object.fromEntries(
  [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NOTIFICATION_WORKER_SECRET',
    'NOTIFICATION_SCHEDULER_SECRET',
    'NOTIFICATION_ENCRYPTION_KEY',
    'SITE_URL',
    'SITE_ALLOWED_ORIGINS',
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'VAPID_SUBJECT',
    'RESEND_API_KEY',
    'EMAIL_FROM',
    'EMAIL_REPLY_TO'
  ].map((k) => [k, Deno.env.get(k) ?? ''])
);
let site: URL | null = null;
try {
  const candidate = new URL(env.SITE_URL);
  if (candidate.protocol === 'https:') site = candidate;
} catch {
  /* Diagnostiqué dans le gestionnaire, sans empêcher son démarrage. */
}
const allowedOrigins = new Set(site ? [site.origin] : []);
for (const value of env.SITE_ALLOWED_ORIGINS.split(',')) {
  try {
    const url = new URL(value.trim());
    if (url.protocol === 'https:' && url.href === url.origin + '/') allowedOrigins.add(url.origin);
  } catch {
    // Une entrée absente ou invalide n’autorise aucune origine supplémentaire.
  }
}
const enc = new TextEncoder();
const hash = async (text: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
async function sameSecret(a: string, b: string) {
  return Boolean(b) && (await hash(a)) === (await hash(b));
}
async function db(path: string, method = 'GET', body?: unknown) {
  const resource = path.split('?')[0].replace(/^rpc\//, '');
  if (
    !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.SUPABASE_URL) ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  )
    throw new NotificationFailure('configuration', 'CONFIG_SUPABASE');
  let r: Response;
  try {
    r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation,resolution=merge-duplicates'
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    throw new NotificationFailure('database', 'NETWORK', null, resource);
  }
  if (!r.ok) {
    let code = 'UNEXPECTED';
    try {
      code = (await r.json()).code ?? code;
    } catch {}
    throw new NotificationFailure('database', code, r.status, resource);
  }
  try {
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  } catch {
    throw new NotificationFailure('database', 'INVALID_RESPONSE', r.status, resource);
  }
}
async function endpoint(uid: string, channel: string, target: unknown) {
  if (!validateDestination(channel, target)) throw new Error('DESTINATION');
  if (channel === 'web') {
    await db(`notification_web_preferences?user_id=eq.${uid}`, 'PATCH', {
      enabled: false,
      consent_at: null,
      updated_at: new Date().toISOString()
    });
    await db(
      `notification_deliveries?user_id=eq.${uid}&channel=eq.web&status=eq.pending`,
      'PATCH',
      { status: 'cancelled' }
    );
  }
  await db('notification_endpoints?on_conflict=user_id,channel', 'POST', {
    user_id: uid,
    channel,
    encrypted: await seal(target, env.NOTIFICATION_ENCRYPTION_KEY)
  });
}
async function pageAll(table: string, query: string) {
  const result = [];
  for (let offset = 0; ; offset += 1000) {
    const rows = await db(`${table}?${query}&limit=1000&offset=${offset}`);
    result.push(...rows);
    if (rows.length < 1000) return result;
  }
}
async function worker(
  matches: any[],
  generatedAt: string | null,
  remindersOnly = false,
  briefingReady = false,
  modelHistory: any[] = []
) {
  const briefingStatus = briefingDataStatus(matches, generatedAt);
  const allowBriefing = briefingReady && briefingStatus.ok;
  if (briefingReady && !briefingStatus.ok) console.error(briefingStatus.code);
  const prefs = remindersOnly
      ? []
      : await pageAll('notification_preferences', 'enabled=eq.true&select=*'),
    plans = remindersOnly ? [] : await db('notification_plans?select=*'),
    entitlements = remindersOnly ? [] : await pageAll('notification_entitlements', 'select=*');
  let queued = 0;
  for (const p of prefs) {
    const plan = plans.find(
      (l: any) => l.id === (entitlements.find((e: any) => e.user_id === p.user_id)?.plan ?? 'free')
    );
    if (!plan) continue;
    const briefing = allowBriefing ? planBriefing(matches, p) : null;
    if (
      briefing &&
      (await db('rpc/enqueue_notification_briefing', 'POST', {
        p_user: p.user_id,
        p_event: briefing
      }))
    )
      queued++;
  }
  const web = notificationConfig(env).available.web;
  if (web) {
    const subscribers = await pageAll(
      'notification_web_preferences',
      'enabled=eq.true&select=user_id'
    );
    for (const subscriber of subscribers) {
      const snapshot = await db('rpc/notification_web_snapshot', 'POST', {
        p_user: subscriber.user_id
      });
      if (remindersOnly) {
        const daily = planDailyPush(matches, snapshot?.preferences);
        if (
          daily &&
          (await db('rpc/enqueue_daily_web_summary', 'POST', {
            p_user: subscriber.user_id,
            p_event: daily
          }))
        )
          queued++;
      }
      for (const event of remindersOnly
        ? detectFavoriteReminders(matches, snapshot?.preferences, snapshot?.favorites)
        : [])
        if (
          await db('rpc/enqueue_web_notification', 'POST', {
            p_user: subscriber.user_id,
            p_event: { ...event, web: true }
          })
        )
          queued++;
    }
  }
  const deliveries = remindersOnly ? [] : await db('rpc/claim_notification_deliveries', 'POST', {});
  if (web)
    deliveries.push(
      ...(await db(
        remindersOnly ? 'rpc/claim_favorite_reminders' : 'rpc/claim_web_notifications',
        'POST',
        {}
      ))
    );
  let sent = 0;
  const metrics: Record<
    string,
    {
      claimed: number;
      accepted: number;
      failed: number;
      uncertain: number;
      deferred: number;
      skipped: number;
      maxQueueSeconds: number;
    }
  > = {};
  const acceptedChannels = new Map<string, Set<string>>();
  for (const delivery of deliveries) {
    let category = 'other';
    let outcome = 'skipped';
    try {
      // Relit le consentement juste avant l’appel au fournisseur, même après la réservation de la file.
      const [p] = await db(
          `notification_preferences?user_id=eq.${delivery.user_id}&enabled=eq.true&select=*`
        ),
        [e] = await db(
          `notification_endpoints?user_id=eq.${delivery.user_id}&channel=eq.${delivery.channel}&select=encrypted`
        ),
        [event] = await db(`notification_events?id=eq.${delivery.event_id}&select=payload`);
      const kind = event?.payload;
      category = kind?.test_channel
        ? 'test'
        : kind?.briefing
          ? 'briefing'
          : kind?.daily_summary
            ? 'daily'
            : kind?.favorite_reminder
              ? 'favorite'
              : kind?.result_validated
                ? 'result'
                : 'other';
      if ((!['web'].includes(delivery.channel) && !p?.channels.includes(delivery.channel)) || !e) {
        await db(`notification_deliveries?id=eq.${delivery.id}`, 'PATCH', { status: 'cancelled' });
        continue;
      }
      if (!['web', 'email'].includes(delivery.channel)) {
        await db(`notification_deliveries?id=eq.${delivery.id}`, 'PATCH', { status: 'cancelled' });
        continue;
      }
      const target = await unseal(e.encrypted, env.NOTIFICATION_ENCRYPTION_KEY);
      let payload = event.payload;
      if (delivery.channel === 'email' && payload.briefing && !allowBriefing) {
        outcome = 'deferred';
        // Aucune tentative fournisseur : rendre le bail sans consommer de tentative.
        await db(`notification_deliveries?id=eq.${delivery.id}&status=eq.sending`, 'PATCH', {
          status: 'pending',
          attempts: Math.max(0, delivery.attempts - 1),
          due_at: new Date(Date.now() + 300000).toISOString()
        });
        continue;
      }
      if (delivery.channel === 'web') {
        const snapshot = await db('rpc/notification_web_snapshot', 'POST', {
          p_user: delivery.user_id
        });
        if (payload.daily_challenge_reminder) {
          await db(`notification_deliveries?id=eq.${delivery.id}`, 'PATCH', {
            status: 'cancelled'
          });
          continue;
        }
        if (payload.daily_summary) {
          const daily = dailyPushCurrent(payload, snapshot?.preferences, matches);
          if (!daily) {
            await db(`notification_deliveries?id=eq.${delivery.id}`, 'PATCH', {
              status: 'cancelled'
            });
            continue;
          }
          payload = daily;
        }
        if (payload.favorite_reminder) {
          const current = detectFavoriteReminders(
            matches,
            snapshot?.preferences,
            snapshot?.favorites
          ).find((item) => item.match_id === payload.match_id);
          if (current) payload = current;
        }
        const result = payload.result_validated === true,
          bet =
            result && /^[a-f0-9-]{36}$/.test(String(payload.bet_id))
              ? (
                  await db(
                    `bets?id=eq.${payload.bet_id}&user_id=eq.${delivery.user_id}&select=status`
                  )
                )[0]
              : null;
        const valid = payload.daily_challenge_reminder
          ? false
          : payload.daily_summary
            ? Boolean(dailyPushCurrent(payload, snapshot?.preferences, matches))
            : result
              ? validatedResultCurrent(payload, snapshot?.preferences, bet)
              : snapshot?.preferences?.enabled &&
                !snapshot.preferences.essential &&
                (payload.favorite_reminder
                  ? favoriteReminderCurrent(
                      payload,
                      snapshot.preferences,
                      snapshot.favorites,
                      matches
                    )
                  : false);
        if (!web || !snapshot?.preferences?.enabled || !valid) {
          await db(`notification_deliveries?id=eq.${delivery.id}`, 'PATCH', {
            status: 'cancelled'
          });
          continue;
        }
      }
      if (delivery.channel === 'email' && !payload.briefing && !payload.test_channel) {
        await db(`notification_deliveries?id=eq.${delivery.id}`, 'PATCH', { status: 'cancelled' });
        continue;
      }
      if (delivery.channel === 'email') {
        // Une ancienne association email ne doit plus recevoir de messages après changement d’adresse.
        const authResponse = await fetch(
          `${env.SUPABASE_URL}/auth/v1/admin/users/${delivery.user_id}`,
          {
            headers: {
              apikey: env.SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
            },
            signal: AbortSignal.timeout(10000)
          }
        );
        if (!authResponse.ok)
          throw new NotificationFailure('database', 'AUTH_EMAIL_CHECK', authResponse.status);
        const recipient = await authResponse.json();
        if (!recipient.email_confirmed_at || recipient.email !== target.email) {
          await db(`notification_deliveries?id=eq.${delivery.id}`, 'PATCH', {
            status: 'cancelled',
            error: 'Réassociez votre adresse email confirmée'
          });
          continue;
        }
      }
      if (payload.briefing) {
        if (delivery.channel !== 'email') {
          await db(`notification_deliveries?id=eq.${delivery.id}`, 'PATCH', {
            status: 'cancelled'
          });
          continue;
        }
        const content = await prepareBriefing(
          db,
          delivery.user_id,
          payload,
          p,
          matches,
          generatedAt,
          Date.now(),
          modelHistory
        );
        if (!content) {
          await db(`notification_deliveries?id=eq.${delivery.id}`, 'PATCH', {
            status: 'cancelled'
          });
          continue;
        }
        payload = { ...payload, briefing_content: content };
      }
      if (payload.briefing) {
        const [latest] = await db(
          `notification_preferences?user_id=eq.${delivery.user_id}&enabled=eq.true&select=*`
        );
        if (
          !latest?.channels.includes('email') ||
          latest.updated_at !== p.updated_at ||
          Date.parse(payload.kickoff) <= Date.now()
        ) {
          await db(`notification_deliveries?id=eq.${delivery.id}`, 'PATCH', {
            status: 'cancelled'
          });
          continue;
        }
      }
      const pushTTL = 120;
      const result = await deliver(
        delivery.channel,
        target,
        payload,
        delivery.id,
        env,
        fetch,
        async (target: object, payload: string) =>
          webPush.sendNotification(target, payload, {
            vapidDetails: {
              subject: env.VAPID_SUBJECT,
              publicKey: env.VAPID_PUBLIC_KEY,
              privateKey: env.VAPID_PRIVATE_KEY
            },
            TTL: pushTTL,
            timeout: 10000
          })
      );
      const status =
        result.status === 'pending' && delivery.attempts >= 4 ? 'failed' : result.status;
      await db(`notification_deliveries?id=eq.${delivery.id}&status=eq.sending`, 'PATCH', {
        status,
        error: result.error ?? null,
        ...(status === 'sent' ? { sent_at: new Date().toISOString() } : {}),
        ...(status === 'pending'
          ? { due_at: new Date(Date.now() + (result.retry ?? 300) * 1000).toISOString() }
          : {})
      });
      if (result.expired)
        await db(
          `notification_endpoints?user_id=eq.${delivery.user_id}&channel=eq.${delivery.channel}`,
          'DELETE'
        );
      if (status === 'sent') {
        sent++;
        outcome = 'accepted';
        if (category !== 'test') {
          const channels = acceptedChannels.get(delivery.user_id) ?? new Set<string>();
          channels.add(delivery.channel);
          acceptedChannels.set(delivery.user_id, channels);
        }
      } else if (status === 'failed') outcome = 'failed';
      else if (status === 'unknown') outcome = 'uncertain';
      else if (status === 'pending') outcome = 'deferred';
    } catch (error) {
      outcome = 'uncertain';
      reportNotificationFailure(error, crypto.randomUUID());
      await db(`notification_deliveries?id=eq.${delivery.id}&status=eq.sending`, 'PATCH', {
        status: 'unknown',
        error: 'Résultat de livraison inconnu'
      });
    } finally {
      const row = (metrics[category] ??= {
        claimed: 0,
        accepted: 0,
        failed: 0,
        uncertain: 0,
        deferred: 0,
        skipped: 0,
        maxQueueSeconds: 0
      });
      row.claimed++;
      if (outcome === 'accepted') row.accepted++;
      else if (outcome === 'failed') row.failed++;
      else if (outcome === 'uncertain') row.uncertain++;
      else if (outcome === 'deferred') row.deferred++;
      else row.skipped++;
      const dueAt = Date.parse(delivery.due_at);
      if (Number.isFinite(dueAt))
        row.maxQueueSeconds = Math.max(
          row.maxQueueSeconds,
          Math.floor((Date.now() - dueAt) / 1000)
        );
    }
  }
  if (!remindersOnly)
    await db(
      'notification_events?created_at=lt.' + new Date(Date.now() - 30 * 864e5).toISOString(),
      'DELETE'
    );
  const multiChannelAccepted = [...acceptedChannels.values()].filter(
    (channels) => channels.size > 1
  ).length;
  return {
    queued,
    sent,
    claimed: deliveries.length,
    metrics,
    multiChannelAccepted,
    revision: 'BET-350'
  };
}
Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  const cors = {
    'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'null',
    'Access-Control-Allow-Headers':
      'authorization,content-type,apikey,x-client-info,x-worker-secret',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    Vary: 'Origin'
  };
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Méthode refusée' }, 405);
  try {
    if (!site) throw new NotificationFailure('configuration', 'CONFIG_SITE_URL');
    if (Number(request.headers.get('content-length') ?? 0) > 2000000)
      return json({ error: 'Requête trop volumineuse' }, 413);
    const raw = await request.text();
    if (raw.length > 2000000) return json({ error: 'Requête trop volumineuse' }, 413);
    const body = JSON.parse(raw);
    if (body.action === 'scheduled-reminders') {
      if (
        !(await sameSecret(
          request.headers.get('x-scheduler-secret') ?? '',
          env.NOTIFICATION_SCHEDULER_SECRET
        ))
      )
        return json({ error: 'Non autorisé' }, 401);
      if (body.dry_run === true)
        return json({
          revision: 'BET-350',
          dry_run: true,
          available: notificationConfig(env).available
        });
      return json(await runScheduledReminders(db, worker));
    }
    if (['worker', 'health', 'sender_status'].includes(body.action)) {
      if (
        !(await sameSecret(
          request.headers.get('x-worker-secret') ?? '',
          env.NOTIFICATION_WORKER_SECRET
        ))
      )
        return json({ error: 'Non autorisé' }, 401);
      if (body.action === 'sender_status') return json(await emailSenderStatus(env));
      if (body.action === 'health')
        return json({
          revision: 'BET-350',
          dry_run: true,
          available: notificationConfig(env).available
        });
      if (body.format !== undefined && body.format !== 2)
        return json({ error: 'Format du worker invalide' }, 400);
      return json(
        await worker(
          decodeWorkerMatches(body),
          body.generatedAt ?? null,
          false,
          body.briefingReady === true,
          Array.isArray(body.modelHistory) ? body.modelHistory : []
        )
      );
    }
    if (origin && !allowedOrigins.has(origin)) return json({ error: 'Origine refusée' }, 403);
    const authorization = request.headers.get('authorization') ?? '';
    const auth = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authorization, apikey: env.SUPABASE_SERVICE_ROLE_KEY }
    });
    if (!auth.ok) return json({ error: 'Connexion requise' }, 401);
    const user = await auth.json(),
      uid = user.id;
    const config = notificationConfig(env);
    if (body.action === 'config') return json(config);
    if (body.action === 'web-status') {
      if (!config.available.web || !validateDestination('web', body.destination))
        return json({ matches: false });
      const [stored] = await db(
        `notification_endpoints?user_id=eq.${uid}&channel=eq.web&select=encrypted`
      );
      const target = stored && (await unseal(stored.encrypted, env.NOTIFICATION_ENCRYPTION_KEY));
      return json({
        matches: Boolean(
          target &&
            target.endpoint === body.destination.endpoint &&
            target.keys?.p256dh === body.destination.keys?.p256dh &&
            target.keys?.auth === body.destination.keys?.auth
        )
      });
    }
    if (body.action === 'connect') {
      const channel = body.channel;
      if (!['email', 'web'].includes(channel)) return json({ error: 'Canal invalide' }, 400);
      if (!config.available[channel]) return json({ error: 'Canal non configuré' }, 503);
      if (channel === 'email' && !user.email_confirmed_at)
        return json({ error: 'Confirmez votre adresse email' }, 400);
      await endpoint(uid, channel, channel === 'email' ? { email: user.email } : body.destination);
      return json({ ok: true });
    }
    if (body.action === 'test') {
      if (body.channel !== 'email') return json({ error: 'Canal invalide' }, 400);
      if (!config.available[body.channel]) return json({ error: 'Canal non configuré' }, 503);
      // Le test utilise la même file et les mêmes limites que les alertes.
      const event = {
        match_id: 'test',
        home: 'Test',
        away: 'BetOptimum',
        label: 'Vos alertes fonctionnent',
        odd: 2,
        bookmaker: 'Démonstration',
        value: 0.1,
        confidence: 0.6,
        movement: 0,
        kickoff: new Date(Date.now() + 864e5).toISOString(),
        test_channel: body.channel
      };
      const [p] = await db(`notification_preferences?user_id=eq.${uid}&select=enabled,channels`);
      if (!p?.enabled || !p.channels.includes(body.channel))
        return json({ error: 'Activez et enregistrez ce canal avant de le tester' }, 400);
      const queued = await db('rpc/enqueue_notification', 'POST', {
        p_user: uid,
        p_key: `test:${body.channel}:${Math.floor(Date.now() / 3600000)}`,
        p_event: event,
        p_due: new Date().toISOString()
      });
      return json({
        ok: true,
        queued: Boolean(queued),
        message: queued
          ? 'Test placé dans la file, heures silencieuses et fréquence respectées'
          : 'Un test a déjà été demandé pour ce canal pendant cette heure. Consultez l’historique avant de réessayer.'
      });
    }
    return json({ error: 'Action inconnue' }, 400);
  } catch (error) {
    return json(reportNotificationFailure(error, crypto.randomUUID()), 503);
  }
});
