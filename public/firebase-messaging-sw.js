/* FCM delivers data-only messages; render them here without loading remote code. */
self.addEventListener('push',event=>{
  if(!event.data)return;
  let payload;
  try{payload=event.data.json();}catch{return;}
  const data=payload&&typeof payload.data==='object'?payload.data:{};
  const notice=payload&&typeof payload.notification==='object'?payload.notification:{};
  const title=String(notice.title||data.title||'Wydrian NAS').slice(0,120);
  const body=String(notice.body||data.body||'Új értesítés érkezett.').slice(0,300);
  let path=typeof data.path==='string'?data.path:'/pokemon';
  try{const target=new URL(path,self.location.origin);if(target.origin!==self.location.origin||!path.startsWith('/')||path.startsWith('//')||path.includes('\\'))path='/pokemon';else path=target.pathname+target.search+target.hash;}catch{path='/pokemon';}
  const tag=typeof data.eventId==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(data.eventId)?'nas-'+data.eventId:undefined;
  event.waitUntil(self.registration.showNotification(title,{body,icon:'/brand.svg',badge:'/brand.svg',tag,renotify:false,data:{path}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const path=typeof event.notification.data?.path==='string'?event.notification.data.path:'/pokemon';
  let target;
  try{target=new URL(path,self.location.origin);if(target.origin!==self.location.origin||!path.startsWith('/')||path.startsWith('//')||path.includes('\\'))target=new URL('/pokemon',self.location.origin);}catch{target=new URL('/pokemon',self.location.origin);}
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    for(const client of clients){if(new URL(client.url).origin!==self.location.origin)continue;if('focus'in client){await client.focus();if('navigate'in client)await client.navigate(target.href);return;}}
    return self.clients.openWindow(target.href);
  }));
});
