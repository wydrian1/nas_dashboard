export function parseZeroSslEab(text:string):{keyId:string;hmacKey:string} {
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(lines.length!==2||!lines.every(line=>/^[A-Za-z0-9_-]+$/.test(line))||lines[0].length<10||lines[0].length>256||lines[1].length>256)throw new Error('Invalid ZeroSSL EAB input; values are not logged');
  const key=Buffer.from(lines[1],'base64url');
  if(key.length<32||key.toString('base64url')!==lines[1])throw new Error('Invalid ZeroSSL EAB HMAC encoding');
  return {keyId:lines[0],hmacKey:lines[1]};
}
export function zeroSslSnippet(eab:{keyId:string;hmacKey:string}):string {
  const {keyId,hmacKey}=parseZeroSslEab(eab.keyId+'\n'+eab.hmacKey);
  return '(zerossl-apex) {\n    tls {\n        issuer acme {\n            dir https://acme.zerossl.com/v2/DV90\n            eab '+keyId+' '+hmacKey+'\n            disable_tlsalpn_challenge\n        }\n    }\n}\n';
}
