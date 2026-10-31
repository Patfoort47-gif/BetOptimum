import test from 'node:test';import assert from 'node:assert/strict';
import {renderClubTable} from '../club-table.js';
const html=value=>String(value).replaceAll('<','&lt;');
test('BET-133 : mêmes statistiques, ROI serveur et absence de NaN pour les nouveaux joueurs',()=>{
 const out=renderClubTable([{user_id:'a',nickname:'<Joueur>',rank:1,picks:4,wins:2,points:20,roi:66.7},{nickname:'Nouveau',rank:2}],{html,avatar:()=>'<i></i>',me:'a'});
 for(const label of ['Tickets','Gagnés','Réussite','ROI','Points'])assert.ok(out.includes(label));
 assert.ok(out.includes('+66.7 %'));assert.ok(out.includes('50.0 %'));assert.ok(out.includes('&lt;Joueur>'));assert.ok(out.includes('class="me '));assert.ok(!out.includes('NaN'));
});
