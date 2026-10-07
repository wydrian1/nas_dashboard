// Explicitly publish one artifact, never a workspace directory or live browser.
import {publishOpenCodePreview} from '../lib/opencode-preview.ts';
const [source,title,...rest]=process.argv.slice(2);
if(!source||!title||rest.length)throw new Error('Usage: node --experimental-strip-types scripts/Publish-OpenCodePreview.mjs <file> <title>');
const item=await publishOpenCodePreview(source,title);
console.log(JSON.stringify({id:item.id,title:item.title,path:'/opencode',ownerOnly:true}));
