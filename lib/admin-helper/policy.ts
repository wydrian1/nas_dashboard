export const HELPER_ORIGIN='http://127.0.0.1:3102';
export const DASHBOARD_ORIGIN='https://nas.wydrian.hu';
export const ADMIN_TARGETS=[
  {id:'dashboard',service:'WydrianDashboard',label:'Dashboard',warning:'A dashboard rövid időre megszakad; a jóváhagyott művelet ettől még folytatódik.'},
  {id:'https',service:'WydrianHttps',label:'HTTPS',warning:'A web és az app HTTPS-kapcsolata rövid időre megszakad.'},
  {id:'pokemon',service:'WydrianPokemon',label:'Pokémon-worker',warning:'A webshopfigyelés és a push-küldés rövid időre szünetel.'},
  {id:'opencode-gateway',service:'WydrianOpenCodeGateway',label:'OpenCode-átjáró',warning:'A webes OpenCode-kapcsolat megszakad. Az eredeti OpenCode-folyamat és a beszélgetések nem indulnak újra.'},
] as const;
export type AdminTarget=typeof ADMIN_TARGETS[number]['id'];
export type HelperJob={id:string;target:AdminTarget;service:string;state:'pending'|'review'|'queued'|'running'|'succeeded'|'failed'|'cancelled'|'expired'|'uncertain';createdAt:number;expiresAt:number;finishedAt:number;requestedBy:string;errorCode:number};
export type HelperStatus={available:boolean;targets:{id:AdminTarget;service:string;status:string}[];jobs:HelperJob[]};
