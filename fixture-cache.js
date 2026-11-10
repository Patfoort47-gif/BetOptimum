const CACHE_NAME='betoptimum-calendar-v1',CACHE_URL='./data/fixtures.json';
export async function readFixtureCache(){if(typeof caches==='undefined')return null;try{const response=await(await caches.open(CACHE_NAME)).match(CACHE_URL);return response?.ok?await response.json():null}catch{return null}}
export async function writeFixtureCache(data){if(typeof caches==='undefined'||!data?.matches)return false;try{const cache=await caches.open(CACHE_NAME);await cache.put(CACHE_URL,new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}}));return true}catch{return false}}
export function clearLegacyFixtureCache(storage=typeof localStorage==='undefined'?null:localStorage){try{storage?.removeItem('betmaster-fixtures-cache-v2')}catch{}}
