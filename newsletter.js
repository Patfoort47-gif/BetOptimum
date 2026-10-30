// Inscription newsletter indépendante des alertes sur favoris. Aucun envoi depuis le navigateur.
export function createNewsletterApi(client) {
 const rpc=async(name,args)=>{const {data,error}=await client.rpc(name,args);if(error)throw new Error(['PGRST202','PGRST205','42883','42P01'].includes(error.code)?'L’inscription à la newsletter sera disponible après la mise à jour du serveur.':'Impossible de modifier votre inscription à la newsletter. Réessayez.');return data;};
 return {load:()=>rpc('my_newsletter'),set:subscribed=>rpc('set_newsletter',{p_subscribed:subscribed===true})};
}
export async function mountNewsletter(root,{api,html,toast}) {
 const render=data=>{if(!root.isConnected)return;root.innerHTML=`<h3>Newsletter BetOptimum</h3><label class="switch-line"><input type="checkbox" data-newsletter-toggle ${['subscribed','pending'].includes(data.status)?'checked':''}><span>Je souhaite recevoir la newsletter BetOptimum par email.</span></label><p class="muted">Désabonnement à tout moment ici. ${data.status==='pending'?'Confirmez votre adresse email pour activer votre inscription.':data.status==='subscribed'?'Vous êtes inscrit à la newsletter.':'Vous n’êtes pas inscrit à la newsletter.'}</p>`;};
 try{render(await api.load());}catch(error){if(root.isConnected)root.innerHTML=`<h3>Newsletter BetOptimum</h3><p role="status">${html(error.message)}</p>`;}
 root.addEventListener('change',async event=>{const input=event.target.closest('[data-newsletter-toggle]');if(!input)return;const wanted=input.checked;input.disabled=true;try{render(await api.set(wanted));toast(wanted?'Inscription à la newsletter enregistrée':'Désabonnement de la newsletter enregistré');}catch(error){if(input.isConnected){input.checked=!wanted;input.disabled=false;}toast(error.message);}});
}
