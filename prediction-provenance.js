// Les anciennes cotes sans preuve restent explicitement inconnues.
export function predictionOddsSource(pick){if(['bookmaker','model','unknown'].includes(pick?.oddsSource))return pick.oddsSource;if(pick?.real===true||pick?.basis==='real-odds')return 'bookmaker';if(pick?.real===false)return 'model';return 'unknown'}
export function predictionProvenance(pick){return{oddsSource:predictionOddsSource(pick),...(pick?.modelVersion?{modelVersion:pick.modelVersion}:{}),...(pick?.capturedAt?{capturedAt:pick.capturedAt}:{})}}
