// API privée des préférences : diagnostics traduits, jamais de corps d’erreur brut dans l’interface.
const BUSINESS = { NOTIFICATION_LIMIT:'Les limites de votre formule sont dépassées.', NOTIFICATION_ENDPOINT:'Associez chaque canal sélectionné avant d’activer les alertes.', NOTIFICATION_INVALID:'Vérifiez les favoris et le fuseau horaire.' };
function translated(error, source) {
  const code=String(error?.code??''), message=String(error?.message??'');
  if(BUSINESS[message])return new Error(BUSINESS[message]);
  if(message==='AUTH_REQUIRED'||['PGRST301','PGRST302','PGRST303'].includes(code)||error?.status===401)return new Error('Votre session a expiré. Reconnectez-vous pour gérer vos alertes.');
  if(['PGRST202','PGRST205','42P01','42883'].includes(code))return new Error('Les préférences d’alertes ne sont pas accessibles dans la base du site. La configuration doit être vérifiée par l’administrateur.');
  if(code==='42501')return new Error('Le serveur refuse l’accès à vos préférences d’alertes. L’administrateur doit vérifier les droits.');
  if(source==='function')return new Error('Impossible de joindre le service d’alertes depuis ce navigateur. Réessayez après reconnexion ; si le problème persiste, la configuration du service doit être vérifiée.');
  return new Error('Impossible de charger ou enregistrer vos préférences d’alertes. Réessayez dans quelques instants.');
}
export function createNotificationApi(client) {
  const rpc=async(name,args={})=>{const {data,error}=await client.rpc(name,args);if(error)throw translated(error,'preferences');return data;};
  return {load:()=>rpc('my_notifications'),save:p=>rpc('save_notification_preferences',{p}),unsubscribe:()=>rpc('unsubscribe_notifications'),action:async body=>{
    let result;try{result=await client.functions.invoke('notifications',{body});}catch{throw translated(null,'function');}
    let response=result.data;
    if(result.error?.context&&typeof result.error.context.json==='function'){try{response=await result.error.context.json();}catch{}}
    if(result.error||response?.error){
      const status=result.error?.context?.status;
      if(status===401)throw translated({status},'function');
      if(status===403)throw new Error('Le service d’alertes refuse les appels depuis cette adresse du site. L’administrateur doit vérifier l’adresse autorisée.');
      const expected=new Set(['Telegram non configuré','Confirmez votre adresse email','Activez et enregistrez ce canal avant de le tester','Canal invalide','Canal non configuré']);
      if(expected.has(response?.error))throw new Error(response.error);
      const reference=/^[a-f0-9-]{36}$/.test(String(response?.reference))?` Référence : ${response.reference}.`:'';
      const messages={CONFIG_SITE_URL:'L’adresse du site n’est pas correctement configurée dans le service d’alertes.',CONFIG_SUPABASE:'La connexion du service d’alertes à la base doit être configurée.'};
      if(messages[response?.code])throw new Error(messages[response.code]+reference);
      throw new Error(translated(null,'function').message+reference);
    }
    return response;
  }};
}
export async function loadNotificationSettings(api) {
  // Les deux appels sont indépendants. Rapporte précisément celui qui échoue.
  const [preferences,service]=await Promise.allSettled([api.load(),api.action({action:'config'})]);
  if(preferences.status==='rejected')throw new Error(`Préférences : ${preferences.reason?.message??'chargement impossible.'}`);
  if(service.status==='rejected')throw new Error(`Connexion au service : ${service.reason?.message??'chargement impossible.'}`);
  const data=preferences.value,config=service.value;
  if(!data?.preferences||!data?.plan||!Array.isArray(data.endpoints)||!Array.isArray(data.history)||!config?.available)throw new Error('Le service d’alertes a renvoyé une réponse incomplète. Réessayez dans quelques instants.');
  return {data,config};
}
