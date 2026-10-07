// One browser-wide visibility preference, separate from each page's section order.
export const SECTION_CONTROLS_KEY='wydrian:section-controls:v1';
let visible=false,pending=false;
const listeners=new Set<()=>void>();
function publish(next:boolean){if(next===visible)return;visible=next;for(const listener of listeners)listener();}
function storageChanged(event:StorageEvent){
  if(event.key!==SECTION_CONTROLS_KEY&&event.key!==null)return;
  try{if(event.storageArea!==window.localStorage)return;}catch{return;}
  pending=false;publish(event.newValue==='true');
}
export function sectionControlsVisible(){return visible;}
export function sectionControlsServerSnapshot(){return false;}
export function subscribeSectionControls(listener:()=>void){
  listeners.add(listener);
  if(listeners.size===1){
    window.addEventListener('storage',storageChanged);
    // Keep an unsaved in-memory choice during client navigation if storage is blocked.
    if(!pending)try{publish(window.localStorage.getItem(SECTION_CONTROLS_KEY)==='true');}catch{}
  }
  return ()=>{listeners.delete(listener);if(!listeners.size)window.removeEventListener('storage',storageChanged);};
}
export function setSectionControlsVisible(next:boolean):boolean {
  try{window.localStorage.setItem(SECTION_CONTROLS_KEY,String(next));pending=false;}catch{pending=true;}
  publish(next);return !pending;
}
