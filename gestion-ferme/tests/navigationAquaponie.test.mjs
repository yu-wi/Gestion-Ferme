import test from 'node:test';
import assert from 'node:assert/strict';
import {ongletAquaponie,ongletsAquaponie} from '../src/aquaponie/navigationAquaponie.ts';
test('liens directs des six onglets et repli sur Résumé pour les valeurs inconnues',()=>{for(const o of ongletsAquaponie)assert.equal(ongletAquaponie('?onglet='+o.id),o.id);for(const recherche of ['', '?onglet=inconnu','?onglet=','?autre=bassins'])assert.equal(ongletAquaponie(recherche),'resume');assert.equal(ongletAquaponie('?autre=1&onglet=parametres'),'parametres');});
