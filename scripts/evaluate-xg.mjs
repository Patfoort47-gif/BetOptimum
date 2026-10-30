import {readFile} from 'node:fs/promises';import {evaluateXg} from '../xg-evaluation.js';
const [path,weight]=process.argv.slice(2);if(!path||weight===undefined)throw new Error('Usage : node scripts/evaluate-xg.mjs donnees-test.json ponderation-fixee');console.log(JSON.stringify(evaluateXg(JSON.parse(await readFile(path,'utf8')),Number(weight)),null,2));
