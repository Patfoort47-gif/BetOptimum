# Recherche : snapshots publics du dépôt, aucun accès aux fournisseurs.
import subprocess,json,datetime,collections,sys
if len(sys.argv)<2:raise SystemExit("Usage : python3 scripts/extract-prediction-history.py sortie.json [revision]")
revision=sys.argv[2] if len(sys.argv)>2 else "HEAD"
commits=subprocess.check_output(['git','log','--format=%H','--reverse',revision,'--','data/fixtures.json'],text=True).split()
rows={};results={};snapshots=0
def stamp(s):
 try:return datetime.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
 except:return None
for c in commits:
 try:d=json.loads(subprocess.check_output(['git','show',c+':data/fixtures.json'],stderr=subprocess.DEVNULL))
 except:continue
 captured=stamp(d.get('generatedAt',''))
 if not captured:continue
 snapshots+=1
 observed=int(subprocess.check_output(['git','show','-s','--format=%ct',c],text=True).strip())
 for m in d.get('matches',[])+d.get('settlements',[]):
  if m.get('completed') and all(isinstance(m.get(k),(int,float)) for k in ['homeScore','awayScore']):
   result={'homeScore':m['homeScore'],'awayScore':m['awayScore']}
   old=results.get(m['id'],{})
   result['resultSeenAt']=old.get('resultSeenAt',observed) if all(old.get(k)==v for k,v in result.items()) else observed
   result['regulation']=m.get('regulation')
   results[m['id']]=result
 for m in d.get('matches',[]):
  kick=stamp(m.get('kickoff',''))
  if kick and captured<kick and not m.get('completed') and not m.get('voided') and all(isinstance(m.get(k),(int,float)) and m[k]>0 for k in ['homeGoals','awayGoals']):
   # Last snapshot at least 1h before kickoff, all inputs still prematch.
   if kick-captured>=3600 and (m['id'] not in rows or captured>rows[m['id']]['captured']):rows[m['id']]={'match':m,'captured':captured,'kickoff':kick,'commit':c}
data=[dict(r,**results[i]) for i,r in rows.items() if i in results];data.sort(key=lambda r:r['kickoff'])
# Les offres détaillées sont parfois séparées du calendrier. Lire uniquement
# la version jointe au même commit, jamais le fichier actuel.
offers_by_snapshot={}
for row in data:
 match=row['match']
 date=match.get('date','')
 if not date or match.get('bookmakerOffers'):continue
 key=(row['commit'],date)
 if key not in offers_by_snapshot:
  try:
   detail=json.loads(subprocess.check_output(['git','show',f'{key[0]}:data/offers/{date}.json'],stderr=subprocess.DEVNULL))
   generated=stamp(detail.get('generatedAt',''))
   offers_by_snapshot[key]=detail.get('matches',{}) if generated and generated<=row['captured'] else {}
  except subprocess.CalledProcessError:
   offers_by_snapshot[key]={}
 offers=offers_by_snapshot[key].get(match['id'])
 if isinstance(offers,list):match['bookmakerOffers']=offers
json.dump({'snapshots':snapshots,'rows':data},open(sys.argv[1],'w'))
print(json.dumps({'snapshots':snapshots,'matched':len(data),'dates':[data[0]['match']['date'],data[-1]['match']['date']] if data else [],'real1N2':sum(all(k in r['match'].get('realOddsMarkets',[]) for k in ['home','draw','away']) for r in data),'storedPicks':dict(collections.Counter((r['match'].get('suggestedPick') or {}).get('key') for r in data))}))
