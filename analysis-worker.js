import {analyseMatch} from './model.js';
self.onmessage=({data})=>{try{self.postMessage({results:data.map(match=>analyseMatch(match))})}catch{self.postMessage({error:true})}};
