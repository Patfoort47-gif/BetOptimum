Deno.serve(async request=>{
 if(request.method!=='POST')return new Response('Méthode refusée',{status:405});
 const secret=Deno.env.get('NOTIFICATION_SCHEDULER_SECRET');if(!secret||request.headers.get('x-scheduler-secret')!==secret)return Response.json({error:'Non autorisé'},{status:401});
 try{
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  const candidates=await fetch(`${url}/rest/v1/rpc/ticket_preview_cleanup_candidates`,{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(15000)});if(!candidates.ok)throw Error();
  const names=(await candidates.json()).map(row=>row.name).filter(name=>/^[a-f0-9-]{36}\.png$/.test(name));if(!names.length)return Response.json({deleted:0});
  const removed=await fetch(`${url}/storage/v1/object/ticket-previews`,{method:'DELETE',headers,body:JSON.stringify({prefixes:names}),signal:AbortSignal.timeout(20000)});if(!removed.ok)throw Error();return Response.json({deleted:names.length});
 }catch{return Response.json({error:'Nettoyage indisponible'},{status:503});}
});
