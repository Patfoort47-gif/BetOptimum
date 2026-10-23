// Notifications seulement : aucun cache des pages ou des données privées.
self.addEventListener('push',event=>{
 let payload;try{payload=event.data.json();}catch{return;}
 const base=new URL(self.registration.scope);let target;try{target=new URL(payload.url,base);}catch{return;}
 if(target.origin!==base.origin||!target.pathname.startsWith(base.pathname))return;
 event.waitUntil(self.registration.showNotification(String(payload.title??'BetOptimum').slice(0,100),{body:String(payload.body??'').slice(0,1000),tag:String(payload.tag??'').slice(0,100),data:{url:target.href}}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();const target=new URL(event.notification.data.url),base=new URL(self.registration.scope);if(target.origin!==base.origin||!target.pathname.startsWith(base.pathname))return;event.waitUntil(self.clients.openWindow(target.href));});
