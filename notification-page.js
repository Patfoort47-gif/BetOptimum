// BET-69 : opt-in explicite. Les destinations passent au serveur, jamais au stockage local.
export async function mountNotifications(root, { api, html, toast, getState }) {
  let alive=true, data=null, config=null;
  const labels={web:'Navigateur',telegram:'Telegram',discord:'Discord',email:'Email'};
  const time=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  const minute=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
  const render=()=>{
    if(!alive)return;
    const p=data.preferences,plan=data.plan;
    root.innerHTML=`<div class="settings-card"><h3>Alertes sur vos favoris</h3><p>Alertes au rythme des collectes de cotes : 7 h, 14 h et 19 h (Paris). Aucune garantie de résultat. Les heures silencieuses reportent les alertes jusqu’à leur fin, tant que le match n’a pas commencé.</p><p class="muted">Formule ${html(plan.id)} : ${plan.max_favorites} favoris, ${plan.max_external} canal externe et le navigateur, ${plan.max_per_hour} alertes par heure et par canal au maximum.</p><form data-notification-form>
<label class="switch-line"><input name="enabled" type="checkbox" ${p.enabled?'checked':''}><span>J’accepte de recevoir les alertes sur les canaux cochés</span></label>
<fieldset><legend>Canaux</legend>${Object.entries(labels).map(([key,label])=>`<div class="notification-channel"><label><input type="checkbox" name="channel" value="${key}" ${p.channels.includes(key)?'checked':''} ${data.endpoints.includes(key)?'':'disabled'}>${label}</label><span>${data.endpoints.includes(key)?'Associé':'Non associé'}</span><button type="button" class="button secondary" data-connect="${key}" ${config.available[key]?'':'disabled'}>${config.available[key]?'Associer':'Indisponible'}</button><button type="button" class="text-button" data-test-channel="${key}" ${p.enabled&&p.channels.includes(key)?'':'disabled'}>Tester</button></div>`).join('')}</fieldset>
<div class="notification-fields"><label>Équipes suivies (une par ligne)<textarea name="teams" rows="4" maxlength="10000">${html(p.teams.join('\n'))}</textarea></label><label>Compétitions suivies (une par ligne)<textarea name="leagues" rows="4" maxlength="10000">${html(p.leagues.join('\n'))}</textarea></label><button type="button" class="button secondary" data-import-favorites>Reprendre mes favoris du site</button>
<label>Value minimale (%)<input name="min_value" type="number" min="0" max="1000" step="1" value="${p.min_value*100}" required></label><label>Confiance minimale (%)<input name="min_confidence" type="number" min="0" max="100" value="${p.min_confidence*100}" required></label><label>Maximum par heure et par canal<input name="max_per_hour" type="number" min="1" max="${plan.max_per_hour}" value="${p.max_per_hour}" required></label><label>Silence à partir de<input name="quiet_start" type="time" value="${time(p.quiet_start)}" required></label><label>Silence jusqu’à<input name="quiet_end" type="time" value="${time(p.quiet_end)}" required></label><label>Fuseau horaire<input name="timezone" value="${html(p.timezone)}" required maxlength="100"></label></div><p class="muted">Deux heures identiques désactivent la plage silencieuse. Les noms des favoris doivent correspondre à ceux affichés sur le site.</p><button class="button primary">Enregistrer mes préférences</button></form>
<button class="button danger" data-unsubscribe>Toutes mes alertes : me désabonner et supprimer mes destinations</button><div data-pairing aria-live="polite"></div></div><section class="settings-card"><h3>Historique des livraisons</h3><p class="muted">Conservé 30 jours. « Résultat inconnu » signifie qu’une confirmation manque : aucun nouvel envoi automatique pour éviter un doublon.</p><button class="button secondary" data-notification-refresh>Actualiser</button><ul>${data.history.map(row=>`<li>${html(labels[row.channel]??row.channel)} · ${html(({pending:'En attente',sending:'En cours',sent:'Envoyée',failed:'Échec',unknown:'Résultat inconnu',cancelled:'Annulée'})[row.status]??row.status)} · ${html(new Date(row.sent_at??row.due_at).toLocaleString('fr-FR'))}${row.error?` · ${html(row.error)}`:''}</li>`).join('')||'<li>Aucune alerte pour le moment.</li>'}</ul></section>`;
  };
  async function load(){try{[data,config]=await Promise.all([api.load(),api.action({action:'config'})]);render();}catch{if(alive)root.innerHTML='<p class="empty">Les alertes ne sont pas encore disponibles. Leur activation nécessite la configuration du serveur de notifications.</p>';}}
  const click=async event=>{
    const button=event.target.closest('button');if(!button)return;
    try{
      if(button.matches('[data-notification-refresh]')){await load();return;}
      if(button.matches('[data-import-favorites]')){root.querySelector('[name=teams]').value=(getState().favoriteTeams??[]).join('\n');root.querySelector('[name=leagues]').value=(getState().favoriteLeagues??[]).join('\n');return;}
      if(button.matches('[data-unsubscribe]')){button.disabled=true;await api.unsubscribe();if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.getRegistration(new URL('.',import.meta.url));await (await reg?.pushManager.getSubscription())?.unsubscribe();}toast('Alertes désactivées et destinations supprimées');await load();return;}
      if(button.dataset.testChannel){await api.action({action:'test',channel:button.dataset.testChannel});toast('Test en attente du prochain passage du service');return;}
      const channel=button.dataset.connect;if(!channel)return;button.disabled=true;
      if(channel==='telegram'){const result=await api.action({action:'telegram-pair'});const box=root.querySelector('[data-pairing]');box.innerHTML='';const link=document.createElement('a');link.textContent='Associer mon compte Telegram (valable 10 minutes)';link.href=result.url;link.target='_blank';link.rel='noopener noreferrer';box.append(link);box.append(document.createTextNode(' Après association, cliquez sur Actualiser.'));return;}
      let destination;
      if(channel==='web'){
        if(!('serviceWorker'in navigator)||!('PushManager'in window))throw new Error('Notifications web non disponibles sur cet appareil');
        const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Autorisez les notifications dans votre navigateur pour activer ce canal');
        const reg=await navigator.serviceWorker.register(new URL('./notification-sw.js',import.meta.url),{scope:new URL('.',import.meta.url).pathname});await navigator.serviceWorker.ready;
        const key=config.vapid.replace(/-/g,'+').replace(/_/g,'/'),bytes=Uint8Array.from(atob(key),c=>c.charCodeAt(0));
        destination=(await reg.pushManager.getSubscription()??await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes})).toJSON();
      }else if(channel==='discord'){const url=prompt('Collez l’URL du webhook Discord du salon dont vous gérez les notifications. Elle sera chiffrée côté serveur.');if(!url)return;destination={url:url.trim()};}
      await api.action({action:'connect',channel,destination});await load();toast('Canal associé. Cochez-le et enregistrez pour activer les alertes.');
    }catch(error){toast(error.message);}finally{if(button.isConnected)button.disabled=false;}
  };
  const submit=async event=>{if(!event.target.matches('[data-notification-form]'))return;event.preventDefault();const f=new FormData(event.target),list=name=>[...new Set(String(f.get(name)).split('\n').map(v=>v.trim()).filter(Boolean))];const button=event.target.querySelector('button:not([type])');if(button)button.disabled=true;
    try{await api.save({enabled:f.has('enabled'),channels:f.getAll('channel'),teams:list('teams'),leagues:list('leagues'),min_value:Number(f.get('min_value'))/100,min_confidence:Number(f.get('min_confidence'))/100,max_per_hour:Number(f.get('max_per_hour')),quiet_start:minute(String(f.get('quiet_start'))),quiet_end:minute(String(f.get('quiet_end'))),timezone:String(f.get('timezone')).trim()});await load();toast('Préférences enregistrées');}catch(error){toast(error.message);}finally{if(button?.isConnected)button.disabled=false;}
  };
  root.addEventListener('click',click);root.addEventListener('submit',submit);await load();
  return {destroy(){alive=false;root.removeEventListener('click',click);root.removeEventListener('submit',submit);}};
}
