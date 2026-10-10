import {copyFileSync,lstatSync,mkdirSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const sourceRoot=fileURLToPath(new URL('../docs/history-site/',import.meta.url));
export const timelineFiles=['index.html','style.css','presentation.js',...['mark','dashboard','architecture','pokemon','finance','mobile','collections','files','workflow'].map(name=>'assets/'+name+'.svg')];

// Publish only the reviewed story, never the repository or the whole docs directory.
export function buildTimelinePages(destination,source=sourceRoot){
  if(!lstatSync(source).isDirectory())throw new Error('Timeline source must be a directory');
  const files=[];
  function walk(directory,prefix=''){
    for(const name of readdirSync(directory)){
      const path=join(directory,name),file=prefix+name,stat=lstatSync(path);
      if(stat.isSymbolicLink())throw new Error('Timeline symlinks are forbidden');
      if(stat.isDirectory()){
        if(file!=='assets')throw new Error('Unexpected timeline directory');
        walk(path,file+'/');
      }else{
        if(!stat.isFile()||!timelineFiles.includes(file))throw new Error('Unexpected timeline file');
        files.push(file);
      }
    }
  }
  walk(source);
  if(files.length!==timelineFiles.length||timelineFiles.some(file=>!files.includes(file)))throw new Error('Timeline source is incomplete');
  // A fresh destination prevents stale/unreviewed files from reaching the artifact.
  mkdirSync(destination);
  mkdirSync(join(destination,'assets'));
  for(const file of timelineFiles)copyFileSync(join(source,file),join(destination,file));
  writeFileSync(join(destination,'.nojekyll'),'');
  return [...timelineFiles,'.nojekyll'];
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==2)throw new Error('Usage: node scripts/Build-Timeline-Pages.mjs');
  const destination=join(dirname(sourceRoot),'..','.timeline-pages');
  console.log(JSON.stringify({files:buildTimelinePages(destination).length,destination:'.timeline-pages'}));
}
