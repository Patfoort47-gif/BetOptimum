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
 for m in d.get('matches',[])+d.get('settlements',[]):
  if m.get('completed') and all(isinstance(m.get(k),(int,float)) for k in ['homeScore','awayScore']):results[m['id']]={'homeScore':m['homeScore'],'awayScore':m['awayScore']}
 for m in d.get('matches',[]):
  kick=stamp(m.get('kickoff',''))
  if kick and captured<kick and not m.get('completed') and not m.get('voided') and all(isinstance(m.get(k),(int,float)) and m[k]>0 for k in ['homeGoals','awayGoals']):
   # Last snapshot at least 1h before kickoff, all inputs still prematch.
   if kick-captured>=3600 and (m['id'] not in rows or captured>rows[m['id']]['captured']):rows[m['id']]={'match':m,'captured':captured,'kickoff':kick,'commit':c}
data=[dict(r,**results[i]) for i,r in rows.items() if i in results];data.sort(key=lambda r:r['kickoff'])
json.dump({'snapshots':snapshots,'rows':data},open(sys.argv[1],'w'))
print(json.dumps({'snapshots':snapshots,'matched':len(data),'dates':[data[0]['match']['date'],data[-1]['match']['date']] if data else [],'real1N2':sum(all(k in r['match'].get('realOddsMarkets',[]) for k in ['home','draw','away']) for r in data),'storedPicks':dict(collections.Counter(r['match'].get('suggestedPick',{}).get('key') for r in data))}))
