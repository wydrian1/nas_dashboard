"use client";
import {Children,isValidElement,useEffect,useState,type ReactNode,type ReactElement} from 'react';
import {readSectionOrder,sectionOrder,moveSection} from '@/lib/section-order';
type Slot={sectionId:string;label:string;children:ReactNode};
export function LocalSection({children}:Slot){return <>{children}</>;}
export default function LocalSections({page,children}:{page:string;children:ReactNode}) {
  const slots=Children.toArray(children).filter((child):child is ReactElement<Slot>=>isValidElement<Slot>(child)&&typeof child.props.sectionId==='string');
  const ids=slots.map(child=>child.props.sectionId),key='wydrian:sections:v1:'+page;
  const [saved,setSaved]=useState<string[]>([]),[ready,setReady]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{try{setSaved(readSectionOrder(localStorage.getItem(key)));}catch{setSaved([]);}setReady(true);},[key]);
  const order=sectionOrder(ids,saved);
  function move(id:string,direction:-1|1){
    const next=moveSection(order,id,direction);if(next===order)return;
    // Retain temporarily absent sections, e.g. hidden quick links or share forms.
    const preference=[...next,...saved.filter(item=>!ids.includes(item))];setSaved(preference);
    try{localStorage.setItem(key,JSON.stringify(preference));setMessage('');}catch{setMessage('A sorrend ezen a lapon változott; a böngésző nem engedi a helyi mentést.');}
  }
  return <div className="local-sections">{order.map((id,index)=>{const slot=slots.find(child=>child.props.sectionId===id)!;return <div className="local-section" key={id} data-section={id}>
    <div className="section-order-controls" role="group" aria-label={slot.props.label+' sorrendje'}><button type="button" title="Feljebb" aria-label={slot.props.label+': feljebb'} disabled={!ready||index===0} onClick={()=>move(id,-1)}>↑</button><button type="button" title="Lejjebb" aria-label={slot.props.label+': lejjebb'} disabled={!ready||index===order.length-1} onClick={()=>move(id,1)}>↓</button></div>{slot}
  </div>;})}{message&&<p role="status" className="footnote">{message}</p>}</div>;
}
