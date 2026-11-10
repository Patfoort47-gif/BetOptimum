// Historique local propre au compte, alimenté exclusivement par les réponses du serveur.
export function createInbox(storage,key){
 let state={items:[],groups:{}};try{const saved=JSON.parse(storage?.getItem(key)||'null');if(saved&&Array.isArray(saved.items)&&saved.groups&&typeof saved.groups==='object')state=saved}catch{}
 const save=()=>{try{storage?.setItem(key,JSON.stringify(state))}catch{}};
 const add=(id,text,tab)=>{if(state.items.some(item=>item.id===id))return;state.items.unshift({id,text,tab,at:Date.now(),read:false});state.items=state.items.slice(0,100)};
 const observe=(group,keys,make)=>{const previous=state.groups[group];if(Array.isArray(previous))for(const value of keys)if(!previous.includes(value)){const item=make(value);if(item)add(...item)}state.groups[group]=[...new Set([...(Array.isArray(previous)?previous:[]),...keys])].slice(-2000);save()};
 return{
 bets(rows){observe('bets',rows.filter(b=>['won','lost'].includes(b.status)).map(b=>`${b.id}:${b.status}`),id=>[id,id.endsWith(':won')?'Votre ticket est gagné.':'Votre ticket est perdu.','bankroll'])},
 rewards(data){if(!data)return;const results=data.results??[];observe('challenges',results.map(r=>`${r.week_start}:${r.challenge_id}`),id=>{const result=results.find(r=>`${r.week_start}:${r.challenge_id}`===id);return['challenge:'+id,`Défi hebdomadaire terminé : ${result.challenge_id}.`,'challenges']})},
 league(data){if(!data)return;const mine=data.rows?.find(r=>r.user_id===data.me),scope=JSON.stringify([data.season,data.echelon,data.groupLabel]),rank=mine?.confirmed===true&&Number(mine.rank)>0?Number(mine.rank):null,prev=state.groups.league;if(rank!==null&&prev?.scope===scope&&prev.rank!==null&&rank>prev.rank)add(`rank:${scope}:${prev.rank}:${rank}:${Date.now()}`,`Vous passez de la place ${prev.rank} à la place ${rank} dans votre ligue.`,'community');state.groups.league={scope,rank};save()},
 items:()=>state.items.map(i=>({...i})),unread:()=>state.items.filter(i=>!i.read).length,
 read(id){state.items.forEach(i=>{if(!id||i.id===id)i.read=true});save()}
 };
}
export function initInbox({navigate}){
 const button=document.querySelector('#open-inbox'),dialog=document.querySelector('#inbox-dialog'),list=dialog.querySelector('[data-inbox-list]');let inbox=null;
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function render(){button.hidden=!inbox;const count=inbox?.unread()??0;button.setAttribute('aria-label',`Notifications : ${count} non lue${count>1?'s':''}`);button.querySelector('b').textContent=count?String(count):'';list.innerHTML=inbox?.items().map(i=>`<li class="${i.read?'':'unread'}"><button class="button ghost" data-inbox-id="${esc(i.id)}"><span>${esc(i.text)}</span><time>${new Date(i.at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}</time>${i.read?'':'<small>Non lue</small>'}</button></li>`).join('')||'<li>Aucune notification pour le moment.</li>'}
 button.addEventListener('click',()=>{render();dialog.showModal()});dialog.querySelector('[data-inbox-close]').addEventListener('click',()=>dialog.close());dialog.querySelector('[data-inbox-read]').addEventListener('click',()=>{inbox?.read();render()});list.addEventListener('click',event=>{const id=event.target.closest('[data-inbox-id]')?.dataset.inboxId,item=inbox?.items().find(i=>i.id===id);if(!item)return;inbox.read(id);render();dialog.close();navigate(item.tab)});
 return{account(id){dialog.close();let storage=null;try{storage=localStorage}catch{}inbox=id?createInbox(storage,'betoptimum-inbox:'+id):null;render()},bets(rows){inbox?.bets(rows);render()},rewards(data){inbox?.rewards(data);render()},league(data){inbox?.league(data);render()}};
}
