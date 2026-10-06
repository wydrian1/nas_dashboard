import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
export const MAX_APK_BYTES=100*1024*1024;
function manifestEntry(apk:Buffer){
  let end=-1;for(let i=apk.length-22;i>=Math.max(0,apk.length-65557);i--)if(apk.readUInt32LE(i)===0x06054b50&&i+22+apk.readUInt16LE(i+20)===apk.length){end=i;break;}
  if(end<0||apk.readUInt16LE(end+4)||apk.readUInt16LE(end+6))throw new Error('Invalid APK ZIP');
  const count=apk.readUInt16LE(end+10),central=apk.readUInt32LE(end+16),centralEnd=central+apk.readUInt32LE(end+12);if(count>10000||centralEnd>end)throw new Error('Invalid APK directory');let offset=central,result:Buffer|undefined;
  for(let i=0;i<count;i++){
    if(offset+46>centralEnd||apk.readUInt32LE(offset)!==0x02014b50)throw new Error('Invalid APK entry');
    const nameLength=apk.readUInt16LE(offset+28),next=offset+46+nameLength+apk.readUInt16LE(offset+30)+apk.readUInt16LE(offset+32);if(next>centralEnd)throw new Error('Invalid APK name');
    if(apk.subarray(offset+46,offset+46+nameLength).toString('utf8')==='AndroidManifest.xml'){
      if(result||apk.readUInt16LE(offset+8)&1)throw new Error('Invalid APK manifest');const size=apk.readUInt32LE(offset+20),plain=apk.readUInt32LE(offset+24),local=apk.readUInt32LE(offset+42);
      if(plain>1024*1024||local+30>central||apk.readUInt32LE(local)!==0x04034b50)throw new Error('Invalid APK manifest size');const start=local+30+apk.readUInt16LE(local+26)+apk.readUInt16LE(local+28);if(start+size>central)throw new Error('Invalid APK manifest offset');
      const method=apk.readUInt16LE(offset+10),compressed=apk.subarray(start,start+size);result=method===0?Buffer.from(compressed):method===8?inflateRawSync(compressed,{maxOutputLength:1024*1024}):undefined;if(!result||result.length!==plain)throw new Error('Invalid APK compression');
    }offset=next;
  }if(!result)throw new Error('APK manifest missing');return result;
}
export function apkMetadata(apk:Buffer){
  if(apk.length<22||apk.length>MAX_APK_BYTES)throw new Error('APK size rejected');const xml=manifestEntry(apk);if(xml.length<8||xml.readUInt16LE(0)!==3||xml.readUInt32LE(4)!==xml.length)throw new Error('Invalid binary manifest');
  let strings:string[]=[],offset=xml.readUInt16LE(2);const attributes:Record<string,string|number>={};
  while(offset+8<=xml.length){const type=xml.readUInt16LE(offset),header=xml.readUInt16LE(offset+2),size=xml.readUInt32LE(offset+4);if(header<8||size<header||offset+size>xml.length)throw new Error('Invalid XML chunk');
    if(type===1){if(header<28)throw new Error('Invalid string pool');const count=xml.readUInt32LE(offset+8),utf8=!!(xml.readUInt32LE(offset+16)&0x100),base=offset+xml.readUInt32LE(offset+20);if(count>10000||header+count*4>size)throw new Error('Invalid strings');strings=[];
      for(let i=0;i<count;i++){let p=base+xml.readUInt32LE(offset+header+i*4);const limit=offset+size;const length=()=>{if(p+(utf8?1:2)>limit)throw new Error('Invalid string length');let n=utf8?xml[p++]:xml.readUInt16LE(p);if(!utf8)p+=2;if(n&(utf8?0x80:0x8000)){if(p+(utf8?1:2)>limit)throw new Error('Invalid string');n=((n&(utf8?0x7f:0x7fff))<<(utf8?8:16))|(utf8?xml[p++]:xml.readUInt16LE(p));if(!utf8)p+=2;}return n;};let bytes=length();if(utf8)bytes=length();else bytes*=2;if(bytes>65536||p<base||p+bytes+(utf8?1:2)>limit)throw new Error('Invalid string range');strings.push(xml.subarray(p,p+bytes).toString(utf8?'utf8':'utf16le'));}
    }
    if(type===0x102){if(header<16||size<36)throw new Error('Invalid element');const ext=offset+header,name=xml.readUInt32LE(ext+4),count=xml.readUInt16LE(ext+12),stride=xml.readUInt16LE(ext+10),start=ext+xml.readUInt16LE(ext+8);if(strings[name]==='manifest'){
      if(stride<20||count>100||start+count*stride>offset+size)throw new Error('Invalid attributes');for(let i=0;i<count;i++){const p=start+i*stride,key=strings[xml.readUInt32LE(p+4)],raw=xml.readUInt32LE(p+8),valueType=xml[p+15],value=xml.readUInt32LE(p+16);if(['package','versionCode','versionName'].includes(key)){if(key in attributes)throw new Error('Duplicate version attribute');attributes[key]=raw!==0xffffffff?strings[raw]:valueType===3?strings[value]:value;}}
      break;
    }}offset+=size;
  }
  if(attributes.package!=='hu.wydrian.nas'||typeof attributes.versionName!=='string'||!/^\d+\.\d+\.\d+$/.test(attributes.versionName)||!Number.isSafeInteger(attributes.versionCode)||Number(attributes.versionCode)<1)throw new Error('Invalid app release');
  return {versionName:attributes.versionName,versionCode:Number(attributes.versionCode),sha256:createHash('sha256').update(apk).digest('hex'),size:apk.length};
}
let cached:{mtime:number;size:number;bytes:Buffer;release:ReturnType<typeof apkMetadata>}|undefined;
export async function publishedApk(){const path=join(process.cwd(),'.runtime/artifacts/Wydrian-NAS-1.0.0.apk'),info=await stat(path);if(info.size>MAX_APK_BYTES)throw new Error('APK too large');if(cached&&cached.mtime===info.mtimeMs&&cached.size===info.size)return cached;const bytes=await readFile(path);cached={mtime:info.mtimeMs,size:bytes.length,bytes,release:apkMetadata(bytes)};return cached;}
