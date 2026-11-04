// BET-69 : état public des canaux. Aucune valeur secrète ne doit sortir de ce module.
export function notificationConfig(env) {
  let encryption=false;
  try { encryption=Uint8Array.from(atob(env.NOTIFICATION_ENCRYPTION_KEY??''),c=>c.charCodeAt(0)).length===32; } catch {}
  const ready={web:false,telegram:Boolean(env.TELEGRAM_BOT_TOKEN&&/^[A-Za-z0-9_]{5,32}$/.test(env.TELEGRAM_BOT_NAME??'')&&env.TELEGRAM_WEBHOOK_SECRET),discord:false,email:Boolean(env.RESEND_API_KEY&&env.EMAIL_FROM)};
  const unavailable={web:'Les notifications navigateur ont été retirées.',discord:'Discord ne fait pas partie des canaux proposés.',telegram:'Le bot Telegram doit être configuré par l’administrateur.',email:'Le service d’email doit être configuré par l’administrateur.'};
  const available=Object.fromEntries(Object.entries(ready).map(([channel,ok])=>[channel,encryption&&ok]));
  const reasons=Object.fromEntries(Object.entries(available).filter(([,ok])=>!ok).map(([channel])=>[channel,encryption?unavailable[channel]:'L’association sécurisée des canaux doit être configurée par l’administrateur.']));
  return {available,reasons,vapid:available.web?env.VAPID_PUBLIC_KEY:'',telegram:available.telegram?env.TELEGRAM_BOT_NAME:''};
}
