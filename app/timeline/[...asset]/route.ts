import {timelineAssets,timelineResponse} from '@/lib/timeline-site';

export const dynamic='force-static';
export const dynamicParams=false;

export function generateStaticParams(){return timelineAssets.map(file=>({asset:file.split('/')}));}
export async function GET(_request:Request,{params}:{params:Promise<{asset:string[]}>}){
  const {asset}=await params;return timelineResponse(asset.join('/'));
}
