import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const compact=value=>`${JSON.stringify(value)}\n`;
const smallLogo=url=>typeof url==='string'?url.replace('/500-dark/','/96-dark/').replace('/500/','/96/'):url;
export function splitFixtures(data){const offersByDate={};const matches=(data.matches??[]).map(match=>{const {bookmakerOffers,...light}=match;if(bookmakerOffers?.length){offersByDate[match.date]??={};offersByDate[match.date][match.id]=bookmakerOffers}for(const key of ['homeLogo','awayLogo','leagueLogo','leagueLogoDark'])light[key]=smallLogo(light[key]);return light});return{index:{...data,matches},offersByDate}}
export async function writeFixtureIndex(data,file='data/fixtures.json'){await writeFile(file,compact(data));return Buffer.byteLength(compact(data))}
export async function publishFixtures(data,{file='data/fixtures.json',offersDir='data/offers'}={}){const {index,offersByDate}=splitFixtures(data);await rm(offersDir,{recursive:true,force:true});await mkdir(offersDir,{recursive:true});for(const [date,matches] of Object.entries(offersByDate))await writeFile(`${offersDir}/${date}.json`,compact({generatedAt:data.generatedAt??null,matches}));return{indexBytes:await writeFixtureIndex(index,file),offerFiles:Object.keys(offersByDate).length}}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const data=JSON.parse(await readFile('data/fixtures.json','utf8')),before=Buffer.byteLength(JSON.stringify(data)),result=await publishFixtures(data);console.log(JSON.stringify({before,indexBytes:result.indexBytes,offerFiles:result.offerFiles}))}
