export function initOnboarding(root){
 if(!root)return;const key='betoptimum-onboarding-seen';let seen=false;try{seen=localStorage.getItem(key)==='1'||localStorage.getItem('betoptimum-discovery-dismissed')==='1'}catch{}root.hidden=seen;if(seen)return;
 const track=root.querySelector('[data-onboarding-track]'),slides=[...track.children],dots=[...root.querySelectorAll('[data-onboarding-step]')];
 function select(index,move=true){index=Math.max(0,Math.min(index,slides.length-1));dots.forEach((dot,i)=>{dot.setAttribute('aria-pressed',String(i===index));dot.tabIndex=i===index?0:-1});if(move)track.scrollTo({left:slides[index].offsetLeft-track.offsetLeft,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
 root.addEventListener('click',event=>{const dot=event.target.closest('[data-onboarding-step]');if(dot)select(Number(dot.dataset.onboardingStep));if(event.target.closest('[data-onboarding-dismiss]')){root.hidden=true;try{localStorage.setItem(key,'1')}catch{}document.querySelector('#quick-combo')?.focus({preventScroll:true})}});
 root.addEventListener('keydown',event=>{const dot=event.target.closest('[data-onboarding-step]');if(!dot||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const i=event.key==='Home'?0:event.key==='End'?2:Math.max(0,Math.min(2,Number(dot.dataset.onboardingStep)+(event.key==='ArrowRight'?1:-1)));select(i);dots[i].focus()});
 track.addEventListener('scroll',()=>{const index=Math.round(track.scrollLeft/track.clientWidth);select(index,false)},{passive:true});select(0,false);
}
