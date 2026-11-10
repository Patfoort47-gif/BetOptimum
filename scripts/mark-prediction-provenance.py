import subprocess,json,collections
archive=json.load(open('data/predictions-history.json')); targets={r['id']:r for r in archive}; evidence={}
commits=subprocess.check_output(['git','log','--format=%H','HEAD','--','data/fixtures.json'],text=True).split()
for c in commits:
 if len(evidence)==len(targets):break
 try:d=json.loads(subprocess.check_output(['git','show',c+':data/fixtures.json'],stderr=subprocess.DEVNULL))
 except:continue
 for m in d.get('matches',[]):
  i=m['id'];p=m.get('suggestedPick') or {};a=targets.get(i)
  if not a or i in evidence or p.get('key')!=a['key'] or p.get('odd')!=a['odd'] or abs(p.get('probability',-1)-a['probability'])>1e-10:continue
  source='bookmaker' if p.get('real') is True or p.get('basis')=='real-odds' else 'model' if p.get('real') is False else ('bookmaker' if a['key'] in m.get('realOddsMarkets',[]) else 'model') if m.get('odds',{}).get(a['key'])==a['odd'] else 'unknown'
  evidence[i]={'oddsSource':source,'oddsSourceEvidence':{'commit':c,'path':'data/fixtures.json','method':'matching-stored-pick'}}
for a in archive:a.update(evidence.get(a['id'],{'oddsSource':'unknown'}))
json.dump(archive,open('data/predictions-history.json','w'),ensure_ascii=False,separators=(',',':'));open('data/predictions-history.json','a').write('\n')
print(collections.Counter(a['oddsSource'] for a in archive))
