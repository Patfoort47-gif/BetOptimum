// BET-269 : aucun partenaire ni identifiant d'affiliation n'est configuré.
export const AFFILIATE_CONFIG=Object.freeze({enabled:false,partner:'',url:'',tracking:{}});
export function affiliateOffer(config=AFFILIATE_CONFIG){
 if(config.enabled!==true||typeof config.partner!=='string'||!config.partner.trim())return null;
 try{const url=new URL(config.url);if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.'))return null;const entries=Object.entries(config.tracking??{}).filter(([key,value])=>key&&typeof value==='string'&&value.trim());if(!entries.length)return null;for(const [key,value] of entries)url.searchParams.set(key,value);return{partner:config.partner.trim(),url:url.href}}catch{return null}
}
export function renderAffiliate(root,confirmed,config=AFFILIATE_CONFIG){
 if(!root)return;root.replaceChildren();root.hidden=true;const offer=confirmed?affiliateOffer(config):null;if(!offer)return;
 const link=document.createElement('a');link.className='button secondary';link.textContent=`Jouer ce ticket en vrai sur ${offer.partner}`;link.href=offer.url;link.target='_blank';link.rel='sponsored noopener noreferrer';const note=document.createElement('p');note.className='muted';note.textContent='Lien d’affiliation : BetOptimum peut percevoir une commission. 18+ · Les jeux d’argent comportent des risques. Le ticket virtuel n’est pas transféré : vérifiez les sélections et les cotes chez le partenaire.';root.append(link,note);root.hidden=false;
}
