"use client";
import {useActionState,useEffect,useRef,useState} from 'react';
import {saveInfo} from './actions';
import {INFO_HTML_LIMIT,infoLink} from '@/lib/important-info/policy';
import type {ImportantInfoDocument} from '@/lib/important-info/store';

export default function ImportantInfoEditor({document:initial}:{document:ImportantInfoDocument}){
  const editor=useRef<HTMLDivElement>(null),selection=useRef<Range|null>(null),initialHtml=useRef(initial.html);
  const [html,setHtml]=useState(initial.html),[state,action,pending]=useActionState(saveInfo,{}),[linkError,setLinkError]=useState('');
  const [revision,setRevision]=useState(initial.revision);
  // Never reset a local draft when another admin changed the server document. Only our own save advances its revision.
  useEffect(()=>{if(state.savedRevision!==undefined)setRevision(state.savedRevision);},[state.savedRevision]);
  const sync=()=>{if(editor.current)setHtml(editor.current.innerHTML);};
  const remember=()=>{const selected=window.getSelection();if(selected?.rangeCount&&editor.current?.contains(selected.anchorNode))selection.current=selected.getRangeAt(0).cloneRange();};
  const command=(name:string,value?:string)=>{editor.current?.focus();if(selection.current){const selected=window.getSelection();selected?.removeAllRanges();selected?.addRange(selection.current);}window.document.execCommand(name,false,value);sync();remember();};
  const link=()=>{const value=window.prompt('HTTPS hivatkozás (https://…)');if(value===null)return;const href=infoLink(value.trim());if(!href){setLinkError('Csak teljes, jelszó nélküli HTTPS hivatkozás adható meg.');return;}setLinkError('');command('createLink',href);};
  const buttons=[['bold','Félkövér','B'],['italic','Dőlt','I'],['underline','Aláhúzott','U'],['insertUnorderedList','Felsorolás','• Lista'],['insertOrderedList','Számozott lista','1. Lista'],['removeFormat','Formázás törlése','Tx'],['undo','Visszavonás','↶'],['redo','Újra','↷']];
  return <form action={action} className="info-editor-form" onSubmit={()=>sync()}>
    <input type="hidden" name="revision" value={revision}/><input type="hidden" name="html" value={html}/>
    <div className="info-toolbar" role="toolbar" aria-label="Szövegformázás">
      <select aria-label="Bekezdés formátuma" disabled={pending} defaultValue="p" onChange={event=>command('formatBlock',event.target.value)}><option value="p">Bekezdés</option><option value="h2">Címsor</option><option value="h3">Alcím</option><option value="blockquote">Idézet</option></select>
      {buttons.map(([name,label,text])=><button key={name} type="button" title={label} aria-label={label} disabled={pending} onMouseDown={event=>event.preventDefault()} onClick={()=>command(name)}>{text}</button>)}
      <button type="button" disabled={pending} onMouseDown={event=>event.preventDefault()} onClick={link}>Hivatkozás</button><button type="button" disabled={pending} onMouseDown={event=>event.preventDefault()} onClick={()=>command('unlink')}>Hivatkozás törlése</button>
    </div>
    <div ref={editor} className="info-rich-text info-editable" contentEditable={!pending} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Fontos infók szerkesztése" onInput={sync} onKeyUp={remember} onMouseUp={remember} onBlur={remember} onDrop={event=>event.preventDefault()} onPaste={event=>{event.preventDefault();command('insertText',event.clipboardData.getData('text/plain'));}} dangerouslySetInnerHTML={{__html:initialHtml.current}}/>
    <p className="footnote">A szöveg csak a Mentés gombbal kerül a szerverre. Beillesztéskor a szöveget biztonságosan, formázás nélkül vesszük át; itt újraformázhatod. Maximum {INFO_HTML_LIMIT.toLocaleString('hu-HU')} karakter.</p>
    {linkError&&<p className="error" role="alert">{linkError}</p>}{state.error&&<p className="error" role="alert">{state.error}</p>}{state.success&&<p role="status" className="form-success">{state.success}</p>}
    <button className="primary-button" disabled={pending||html.length>INFO_HTML_LIMIT}>{pending?'Mentés…':'Fontos infók mentése'}</button>
  </form>;
}
