// Layout preferences contain only stable section IDs, never page data.
export function readSectionOrder(value:unknown):string[] {
  if(typeof value!=='string'||value.length>10000)return [];
  try{const parsed:unknown=JSON.parse(value);return Array.isArray(parsed)?[...new Set(parsed.filter((id):id is string=>typeof id==='string'&&/^[a-z0-9-]{1,80}$/.test(id)))].slice(0,100):[];}catch{return [];}
}
export function sectionOrder(available:string[],saved:string[]):string[] {
  return [...saved.filter((id,index)=>available.includes(id)&&saved.indexOf(id)===index),...available.filter(id=>!saved.includes(id))];
}
export function moveSection(order:string[],id:string,direction:-1|1):string[] {
  const index=order.indexOf(id),next=index+direction;
  if(index<0||next<0||next>=order.length)return order;
  const result=[...order];[result[index],result[next]]=[result[next],result[index]];return result;
}
