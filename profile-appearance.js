export const PROFILE_FRAMES=[['none','Sans cadre'],['lime','Citron'],['blue','Bleu'],['gold','Or']];
export const profileFrame=value=>PROFILE_FRAMES.some(([id])=>id===value)?value:'none';
