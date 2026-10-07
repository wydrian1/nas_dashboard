/* Standalone presentation only. No NAS API, tracking, cookies or external requests. */
(() => {
  const deck=document.querySelector('.deck');
  const slides=Array.from(deck.querySelectorAll('.slide'));
  const previous=document.getElementById('previous'),next=document.getElementById('next');
  const position=document.getElementById('position'),progress=document.getElementById('progress');
  const dialog=document.getElementById('timeline-dialog'),notes=document.getElementById('notes-toggle');
  let current=0,pointerStart=null;
  const fromHash=()=>slides.findIndex(slide=>'#'+slide.id===window.location.hash);
  function show(index,focus=false){
    current=Math.max(0,Math.min(slides.length-1,index));
    slides.forEach((slide,i)=>{slide.hidden=i!==current;slide.classList.toggle('slide-enter',i===current);});
    previous.disabled=current===0;next.disabled=current===slides.length-1;
    position.textContent=String(current+1).padStart(2,'0')+' / '+String(slides.length).padStart(2,'0');
    progress.style.width=((current+1)/slides.length*100)+'%';
    const titleHeading=slides[current].querySelector('h1,h2');
    document.title=(titleHeading.innerText||titleHeading.textContent).replace(/\s+/g,' ').trim()+' · Wydrian';
    if(focus){const heading=slides[current].querySelector('h1,h2');heading.tabIndex=-1;heading.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  }
  function go(index){
    const target=Math.max(0,Math.min(slides.length-1,index));
    if(target===current)return;
    history.replaceState(null,'','#'+slides[target].id);show(target,true);
  }
  function toggleNotes(){const visible=document.body.classList.toggle('notes-visible');notes.setAttribute('aria-pressed',String(visible));}
  async function fullscreen(){
    try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
    catch{position.textContent='Teljes képernyő nem elérhető';}
  }
  previous.addEventListener('click',()=>go(current-1));next.addEventListener('click',()=>go(current+1));
  notes.addEventListener('click',toggleNotes);document.getElementById('fullscreen').addEventListener('click',fullscreen);
  document.getElementById('timeline-open').addEventListener('click',()=>dialog.showModal());
  document.getElementById('timeline-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
  document.querySelectorAll('a[href^="#chapter-"]').forEach(link=>link.addEventListener('click',event=>{
    const index=slides.findIndex(slide=>'#'+slide.id===link.getAttribute('href'));if(index<0)return;
    event.preventDefault();if(dialog.open)dialog.close();history.replaceState(null,'','#'+slides[index].id);show(index,true);
  }));
  window.addEventListener('hashchange',()=>{const index=fromHash();if(index>=0)show(index,true);});
  document.addEventListener('keydown',event=>{
    if(dialog.open||event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    if(event.key==='ArrowRight'||event.key==='PageDown'){event.preventDefault();go(current+1);}
    else if(event.key==='ArrowLeft'||event.key==='PageUp'){event.preventDefault();go(current-1);}
    else if(event.key==='Home'){event.preventDefault();go(0);}
    else if(event.key==='End'){event.preventDefault();go(slides.length-1);}
    else if(event.key.toLowerCase()==='n'){event.preventDefault();toggleNotes();}
    else if(event.key.toLowerCase()==='f'){event.preventDefault();fullscreen();}
  });
  deck.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'&&!event.target.closest('a,button'))pointerStart={x:event.clientX,y:event.clientY};});
  deck.addEventListener('pointerup',event=>{if(!pointerStart)return;const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;pointerStart=null;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)go(current+(dx<0?1:-1));});
  deck.addEventListener('pointercancel',()=>{pointerStart=null;});
  deck.classList.add('is-ready');document.querySelector('.deck-controls').hidden=false;
  document.querySelectorAll('.header-actions button').forEach(button=>{button.hidden=false;});
  show(Math.max(0,fromHash()));
})();
