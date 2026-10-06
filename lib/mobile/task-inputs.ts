export class InputError extends Error {}
export function inputText(value:unknown,label:string,max:number,optional=false):string {
  if(optional&&(value===null||value===undefined))return '';
  if(typeof value!=='string')throw new InputError(`${label}: szöveges érték szükséges.`);
  const text=value.trim();if((!optional&&!text)||text.length>max)throw new InputError(`${label}: ${optional?'legfeljebb ':'1–'}${max} karakter adható meg.`);return text;
}
