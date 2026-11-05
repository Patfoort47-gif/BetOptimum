// Appliqué dans le head, avant les styles et le premier rendu.
(function(){if(typeof document==='undefined')return;const key='betmaster-theme',valid=value=>value==='light'||value==='dark'?value:null,media=typeof matchMedia==='function'?matchMedia('(prefers-color-scheme: dark)'):null;let preference=null,notify=()=>{},bound=false;try{preference=valid(localStorage.getItem(key))}catch{}
 const current=()=>preference??(media?.matches?'dark':'light');
 const apply=()=>{const dark=current()==='dark';document.documentElement.classList.toggle('light',!dark);const meta=document.querySelector('meta[name=theme-color]');if(meta)meta.content=dark?'#0A0C0B':'#F2F4F0';const button=document.getElementById('theme-toggle');if(button){button.setAttribute('role','switch');button.setAttribute('aria-label','Thème sombre');button.setAttribute('aria-checked',String(dark));button.title=dark?'Activer le thème clair':'Activer le thème sombre'}};
 const change=()=>{apply();notify()};apply();
 const systemChange=()=>{if(preference===null)change()};if(media?.addEventListener)media.addEventListener('change',systemChange);else media?.addListener?.(systemChange);
 globalThis.addEventListener?.('storage',event=>{if(event.key!==key&&event.key!==null)return;preference=valid(event.newValue);change()});
 globalThis.betOptimumTheme=Object.freeze({current,bind(onChange){notify=onChange??(()=>{});apply();if(bound)return;const button=document.getElementById('theme-toggle');if(!button)return;bound=true;button.addEventListener('click',()=>{preference=current()==='dark'?'light':'dark';try{localStorage.setItem(key,preference)}catch{}change()})}});
})();
