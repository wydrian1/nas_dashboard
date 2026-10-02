export async function boundedText(response:Response,maxBytes:number,encoding='utf-8'):Promise<string> {
  if(!response.ok || !response.body)throw new Error('Upstream response failed');
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw new Error('Upstream response too large');chunks.push(value);}}
  catch(error){await reader.cancel();throw error;}finally{reader.releaseLock();}
  return new TextDecoder(encoding).decode(Buffer.concat(chunks));
}
