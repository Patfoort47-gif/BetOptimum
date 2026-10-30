import urllib.request,json,gzip,os,concurrent.futures,hashlib,time,sys
from pathlib import Path
revision='4b73468fc5b0f1950f9f66fada70ad3a4f9327cb'
base='https://raw.githubusercontent.com/statsbomb/open-data/'+revision+'/data/'
cache=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/bet-xg-research').resolve()
if cache.is_relative_to(Path(__file__).resolve().parents[1]):raise SystemExit('Conserver les données sources hors du dépôt statique')
cache.mkdir(parents=True,exist_ok=True)
with urllib.request.urlopen(base+'matches/11/27.json',timeout=40) as r:matches=json.load(r)
(cache/'matches.json').write_text(json.dumps(matches))
def one(m):
 path=cache/(str(m['match_id'])+'.json.gz')
 if path.exists():body=gzip.decompress(path.read_bytes())
 else:
  for attempt in range(3):
   try:
    with urllib.request.urlopen(base+'events/'+str(m['match_id'])+'.json',timeout=60) as r:body=r.read()
    break
   except Exception:
    if attempt==2:raise
    time.sleep(attempt+1)
  path.write_bytes(gzip.compress(body))
 events=json.loads(body);xg={m['home_team']['home_team_id']:0,m['away_team']['away_team_id']:0}
 for e in events:
  v=e.get('shot',{}).get('statsbomb_xg')
  if v is not None and e.get('team',{}).get('id') in xg:xg[e['team']['id']]+=float(v)
 return {'id':m['match_id'],'date':m['match_date'],'kickoff':m['match_date']+'T'+m['kick_off']+'Z','home':m['home_team']['home_team_name'],'away':m['away_team']['away_team_name'],'homeScore':m['home_score'],'awayScore':m['away_score'],'homeXg':xg[m['home_team']['home_team_id']],'awayXg':xg[m['away_team']['away_team_id']],'sha256':hashlib.sha256(body).hexdigest()}
rows=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
 for i,row in enumerate(ex.map(one,matches)):
  rows.append(row)
  if (i+1)%40==0:print(str(i+1)+'/'+str(len(matches))+' matchs traités',flush=True)
rows.sort(key=lambda r:(r['kickoff'],r['id']))
(cache/'summaries.json').write_text(json.dumps({'revision':revision,'matches':rows}))
print('Terminé :',len(rows),'matchs ; données conservées localement, pas de publication du jeu source.',flush=True)
