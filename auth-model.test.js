import test from 'node:test';import assert from 'node:assert/strict';
// BET-46 · connexion et inscription : règles pures
const A=await import('./auth-model.js');
test('le pseudo compte 3 à 24 caractères autorisés, sans espace en bordure',()=>{
  assert.equal(A.validNickname('Matteo'),true);assert.equal(A.validNickname('Jean-Luc_2'),true);assert.equal(A.validNickname('ab'),false);assert.equal(A.validNickname('a'.repeat(25)),false);assert.equal(A.validNickname(' Matteo'),false);assert.equal(A.validNickname('Mat<script>'),false);assert.equal(A.validNickname(null),false);assert.equal(A.validNickname('Éloïse'),true);
});
test('les emails sont validés',()=>{assert.equal(A.validEmail('a@b.fr'),true);assert.equal(A.validEmail('a b@c.fr'),false);assert.equal(A.validEmail('a@b'),false);assert.equal(A.validEmail('@b.fr'),false);assert.equal(A.validEmail(undefined),false)});
test('la solidité du mot de passe : minimum 8 caractères, mots de passe banals refusés',()=>{
  assert.deepEqual([A.passwordStrength('abc').ok,A.passwordStrength('abcdefgh').ok,A.passwordStrength('password').ok,A.passwordStrength('12345678').ok],[false,true,false,false]);
  assert.equal(A.passwordStrength('').score,0);assert.ok(A.passwordStrength('abcdefgh').score<=1);assert.equal(A.passwordStrength('Abcdefgh1!xyz').score,4);assert.equal(A.passwordStrength('Abcdefg1!').score,3);
  assert.ok(A.passwordStrength('Abcdefgh1!xyz').score>A.passwordStrength('abcdefgh').score);assert.equal(A.passwordStrength('Abcdefgh1!xyz').label,'Solide');
});
test('aucune erreur Supabase n’est affichée en anglais : identifiants, email déjà utilisé, mot de passe faible, trop de tentatives, email non confirmé, réseau',()=>{
  const t=A.translateAuthError;
  assert.equal(t({message:'Invalid login credentials'}),'Email ou mot de passe incorrect.');assert.equal(t({code:'invalid_credentials',message:'x'}),'Email ou mot de passe incorrect.');
  assert.match(t({message:'User already registered'}),/existe déjà/);assert.match(t({code:'user_already_exists'}),/existe déjà/);
  assert.match(t({message:'Password should be at least 6 characters'}),/trop faible/);assert.match(t({code:'weak_password',message:'Password is known to be weak'}),/trop faible/);
  assert.match(t({message:'Email not confirmed'}),/non confirmée/);assert.match(t({code:'email_not_confirmed'}),/non confirmée/);
  assert.match(t({status:429,message:'x'}),/Trop de tentatives/);assert.match(t({message:'email rate limit exceeded'}),/Trop de tentatives/);assert.match(t({message:'For security purposes, you can only request this after 52 seconds.'}),/Trop de tentatives/);
  assert.match(t(new TypeError('Failed to fetch')),/connexion/);assert.match(t({message:'NetworkError when attempting to fetch resource.'}),/connexion/);assert.match(t({message:'New password should be different from the old password.',code:'same_password'}),/différent/);
  for(const raw of ['Something unexpected happened','Database error saving new user','',undefined,null]){const text=t(typeof raw==='string'?{message:raw}:raw);assert.equal(text,'Une erreur est survenue : réessayez dans un instant.')}
});
test('l’étape Avatar n’existe qu’avec le personnage 3D : sinon deux étapes, aucun avatar simplifié',()=>{assert.deepEqual(A.signupSteps(),['identity','preferences']);assert.deepEqual(A.signupSteps(true),['identity','avatar','preferences'])});
test('la validation d’identité refuse pseudo, email, mot de passe et case 18 ans manquants',()=>{
  assert.equal(A.validateIdentity({nickname:'Matteo',email:'m@x.fr',password:'Abcdefg1!',adult:true}).ok,true);
  const bad=A.validateIdentity({nickname:'M',email:'x',password:'abc',adult:false});assert.deepEqual(Object.keys(bad.errors),['nickname','email','password','adult']);assert.match(bad.errors.password,/3\/8/);
  assert.equal(A.validateIdentity({nickname:'Matteo',email:'m@x.fr',password:'password',adult:true}).errors.password,'Ce mot de passe est trop courant.');
});
test('les préférences d’inscription sont nettoyées : club, compétitions connues, style',()=>{
  const known=['Ligue 1','La Liga'],prefs=A.sanitizePreferences({club:{id:'160',name:'Paris Saint-Germain'},leagues:['Ligue 1','Ligue 1','Inconnue','La Liga'],style:'bold'},known);
  assert.deepEqual(prefs,{club:{id:'160',name:'Paris Saint-Germain'},leagues:['Ligue 1','La Liga'],style:'bold'});
  assert.deepEqual(A.sanitizePreferences({club:{id:'../x',name:'Évil'},leagues:'nope',style:'<b>'}),{club:null,leagues:[],style:'balanced'});assert.deepEqual(A.sanitizePreferences(),{club:null,leagues:[],style:'balanced'});
  assert.equal(A.sanitizePreferences({club:{id:'1',name:'x'.repeat(100)}}).club.name.length,40);
  assert.deepEqual(A.RISK_STYLES,{prudent:'safe',equilibre:'balanced',audacieux:'bold'});
});
