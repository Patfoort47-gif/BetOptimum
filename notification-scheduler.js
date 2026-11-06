// BET-243 : calendrier Supabase, cadence serveur indépendante des collectes GitHub.
export async function runScheduledReminders(db, worker, now = Date.now()) {
  if (!await db('rpc/claim_notification_scheduler', 'POST', {})) return {skipped:true, revision:'BET-243'};
  try {
    const query=`select=id,home,away,league,kickoff,completed,voided&completed=eq.false&voided=eq.false&kickoff=gt.${new Date(now).toISOString()}&kickoff=lte.${new Date(now+2*3600000).toISOString()}&updated_at=gt.${new Date(now-864e5).toISOString()}`;
    const matches=[];
    for(let offset=0;;offset+=1000){const rows=await db(`fixtures?${query}&limit=1000&offset=${offset}`);matches.push(...rows);if(rows.length<1000)break;}
    const result=await worker(matches,new Date(now).toISOString(),true);
    await db('rpc/finish_notification_scheduler','POST',{p_ok:true,p_queued:result.queued,p_sent:result.sent});
    return result;
  } catch(error) {
    await db('rpc/finish_notification_scheduler','POST',{p_ok:false,p_queued:0,p_sent:0});
    throw error;
  }
}
