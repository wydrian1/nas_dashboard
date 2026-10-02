import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { initializeDatabase } from "../lib/db-schema.ts";
import { readPokemonSnapshot } from "../lib/pokemon/snapshot.ts";
import { SHOP_IDS, type PokemonProduct } from "../lib/pokemon/types.ts";
import { claimScan, finishScan, failScan } from "../lib/pokemon/store.ts";

function insertProduct(db:DatabaseSync,shopID:string,id:string,inStock=1,episode=1,missing=0) {
  db.prepare("INSERT INTO pokemon_products(shop_id,external_id,sku,title,url,availability,in_stock,episode,missing_count,first_seen,last_seen) VALUES(?,?,'',?,'https://example.com/product','available',?,?,?,?,1)").run(shopID,id,id,inStock,episode,missing,1);
}
function scan(db:DatabaseSync,products:PokemonProduct[],now:number) {
  db.prepare("UPDATE pokemon_shops SET next_scan=? WHERE id='gamerunner'").run(now);
  return finishScan(db,claimScan(db,now)!,{products,total:products.length,pages:1,scannedAt:now},now+1);
}

test('aggregate: no manufactured baseline events, all shops exposed as React-safe objects',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  try{
    const snapshot=readPokemonSnapshot(db,false,5_000_000);
    assert.deepEqual(snapshot.shops.map(item=>item.shop.id),SHOP_IDS);assert.deepEqual(snapshot.latestEvents,[]);
    assert.equal(Object.getPrototypeOf(snapshot.shops[2].shop),Object.prototype);
    assert.equal(snapshot.shop.id,'gamerunner');assert.equal(snapshot.workerAlive,false);
  }finally{db.close();}
});
test('aggregate: globally latest 60 events, newest-first with deterministic ties, not merging truncated shop histories',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  const insert=db.prepare("INSERT INTO pokemon_events(scan_id,shop_id,external_id,episode,kind,title,url,price_huf,occurred_at) VALUES(?,?,?,1,?,?,?,1000,?)");
  try{
    for(let i=0;i<65;i++){
      insertProduct(db,'pottyoszebra','product-'+i);
      insert.run('scan-'+i,'pottyoszebra','product-'+i,i%2 ? 'restock' : 'new','Product '+i,'https://pottyoszebra.hu/pokemon-'+i,1000+i);
    }
    insertProduct(db,'gamerunner','old');insertProduct(db,'mythgames','new');
    insert.run('old','gamerunner','old','preorder','Old preorder','https://gamerunner.hu/old',999);
    insert.run('tie','mythgames','new','new','New MythGames','https://mythgames.eu/products/new',1064);
    const snapshot=readPokemonSnapshot(db,false,5_000_000);
    assert.equal(snapshot.latestEvents.length,60);assert.equal(snapshot.latestEvents[0].shop_id,'mythgames');
    assert.equal(snapshot.latestEvents[1].title,'Product 64');assert.equal(snapshot.latestEvents.at(-1)?.title,'Product 6');
    assert.equal(snapshot.latestEvents[1].shop_name,'Pöttyös Zebra');assert.equal(snapshot.latestEvents[1].image,null);
    assert.equal(snapshot.shops[2].events.length,30);assert.equal(Object.getPrototypeOf(snapshot.latestEvents[0]),Object.prototype);
    assert.equal(snapshot.latestEvents.some(event=>event.title==='Old preorder'),false);
  }finally{db.close();}
});
test('aggregate: same external ID in different shops stays distinct, image lookup remains shop-scoped',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  try{
    db.prepare("INSERT INTO pokemon_products(shop_id,external_id,sku,title,url,image,availability,in_stock,first_seen,last_seen) VALUES('pottyoszebra','same','','Zebra','https://pottyoszebra.hu/item','https://pottyoszebra.cdn.shoprenter.hu/example.webp','available',1,1,1)").run();
    insertProduct(db,'gamerunner','same');
    const insert=db.prepare("INSERT INTO pokemon_events(scan_id,shop_id,external_id,episode,kind,title,url,occurred_at) VALUES(?,?,'same',1,'new',?,'https://example.com',1)");
    insert.run('one','pottyoszebra','Zebra');insert.run('two','gamerunner','Runner');
    const snapshot=readPokemonSnapshot(db,false,5_000_000);
    assert.equal(snapshot.latestEvents.length,2);assert.equal(snapshot.latestEvents[0].image,null);
    assert.equal(snapshot.latestEvents[1].image,'https://pottyoszebra.cdn.shoprenter.hu/example.webp');
    assert.deepEqual(snapshot.shops.map(item=>[item.shop.id,item.products.length]),SHOP_IDS.map(id=>[id,['pottyoszebra','gamerunner'].includes(id) ? 1 : 0]));
    db.exec("UPDATE pokemon_products SET in_stock=0 WHERE shop_id='gamerunner'");
    assert.deepEqual(readPokemonSnapshot(db,false,5_000_000).latestEvents.map(event=>event.shop_id),['pottyoszebra']);
    assert.equal(readPokemonSnapshot(db,false,5_000_000).events.length,0);
    assert.equal(readPokemonSnapshot(db,false,5_000_000).shops[2].events.length,1);
  }finally{db.close();}
});

test('aggregate: unavailable, unconfirmed missing, orphaned and past-episode events are excluded before LIMIT',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  const event=db.prepare("INSERT INTO pokemon_events(scan_id,shop_id,external_id,episode,kind,title,url,occurred_at) VALUES(?,'gamerunner',?,?,'new',?,'https://example.com',?)");
  try{
    insertProduct(db,'gamerunner','live');event.run('live','live',1,'Live',1);
    for(let i=0;i<65;i++){
      insertProduct(db,'gamerunner','gone-'+i,0);event.run('gone-'+i,'gone-'+i,1,'Gone '+i,100+i);
    }
    insertProduct(db,'gamerunner','missing',1,1,1);event.run('missing','missing',1,'Missing',200);
    insertProduct(db,'gamerunner','returned',1,2);event.run('old-episode','returned',1,'Previous availability',201);
    event.run('new-episode','returned',2,'Current availability',202);event.run('orphan','orphan',1,'No product row',203);
    const snapshot=readPokemonSnapshot(db,false,5_000_000);
    assert.deepEqual(snapshot.latestEvents.map(event=>event.title),['Current availability','Live']);
    assert.deepEqual(snapshot.events.map(event=>event.title),['Current availability','Live']);
    assert.equal(db.prepare('SELECT count(*) AS n FROM pokemon_events').get()!.n,70);
  }finally{db.close();}
});

test('aggregate: successful disappearance hides a card immediately, history survives, restock only shows its new episode',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  const baseline:PokemonProduct[]=Array.from({length:3},(_,i)=>({externalID:'base-'+i,sku:'',title:'Base '+i,url:'https://gamerunner.hu/base-'+i,image:null,priceHuf:1000,availability:'in_stock'}));
  const added:PokemonProduct={...baseline[0],externalID:'added',title:'Added preorder',availability:'preorder'};
  try{
    scan(db,baseline,1000);scan(db,[...baseline,added],700_000);
    const first=readPokemonSnapshot(db,false,5_000_000).latestEvents[0];assert.equal(first.kind,'preorder');
    scan(db,baseline,1400_000);
    let snapshot=readPokemonSnapshot(db,false,5_000_000);assert.deepEqual(snapshot.latestEvents,[]);
    assert.equal(snapshot.events.length,0);assert.equal(db.prepare('SELECT count(*) AS n FROM pokemon_events').get()!.n,1);
    assert.ok(snapshot.products.some(product=>product.external_id==='added' && product.missing_count===1));
    // A transient absence may reappear without becoming a fresh event or notification.
    scan(db,[...baseline,added],2100_000);assert.equal(readPokemonSnapshot(db,false,5_000_000).latestEvents[0].id,first.id);
    assert.equal(readPokemonSnapshot(db,false,5_000_000).events[0].id,first.id);
    scan(db,baseline,2800_000);scan(db,baseline,3500_000);assert.deepEqual(readPokemonSnapshot(db,false,5_000_000).latestEvents,[]);
    scan(db,[...baseline,added],4200_000);snapshot=readPokemonSnapshot(db,false,5_000_000);
    assert.equal(snapshot.events.length,1);assert.equal(snapshot.latestEvents.length,1);
    assert.equal(snapshot.events[0].id,snapshot.latestEvents[0].id);assert.equal(db.prepare('SELECT count(*) AS n FROM pokemon_events').get()!.n,2);
    assert.equal(snapshot.latestEvents[0].kind,'restock');assert.notEqual(snapshot.latestEvents[0].id,first.id);
  }finally{db.close();}
});

test('aggregate: failed, incomplete and suspicious scans preserve the last accepted availability list',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  const base:PokemonProduct={externalID:'base',sku:'',title:'Base',url:'https://gamerunner.hu/base',image:null,priceHuf:1000,availability:'in_stock'};
  const added={...base,externalID:'added',title:'Added'};
  try{
    scan(db,[base],1000);scan(db,[base,added],700_000);const before=readPokemonSnapshot(db,false,5_000_000).latestEvents;
    const beforeShop=readPokemonSnapshot(db,false,5_000_000).events;
    db.exec("UPDATE pokemon_shops SET next_scan=0 WHERE id='gamerunner'");
    failScan(db,claimScan(db,1400_000)!,'HTTP 403',0,1400_001);assert.deepEqual(readPokemonSnapshot(db,false,5_000_000).latestEvents,before);
    assert.deepEqual(readPokemonSnapshot(db,false,5_000_000).events,beforeShop);
    db.exec("UPDATE pokemon_shops SET next_scan=0 WHERE id='gamerunner'");const owner=claimScan(db,2100_000)!;
    assert.throws(()=>finishScan(db,owner,{products:[],total:2,pages:1,scannedAt:2100_000},2100_001));
    failScan(db,owner,'Incomplete scan',0,2100_001);assert.deepEqual(readPokemonSnapshot(db,false,5_000_000).latestEvents,before);
    assert.deepEqual(readPokemonSnapshot(db,false,5_000_000).events,beforeShop);
    assert.equal(scan(db,[],2800_000).deferred,true);assert.deepEqual(readPokemonSnapshot(db,false,5_000_000).latestEvents,before);
    assert.deepEqual(readPokemonSnapshot(db,false,5_000_000).events,beforeShop);
  }finally{db.close();}
});

test('recent lists: rolling 24-hour boundary applies to both lists for admin/readers, preserving available products and stored events',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  const now=Date.UTC(2026,9,2,12),day=24*60*60_000;
  const insert=db.prepare("INSERT INTO pokemon_events(scan_id,shop_id,external_id,episode,kind,title,url,occurred_at) VALUES(?,'gamerunner',?,1,'new',?,'https://example.com',?)");
  try{
    for(const [id,time] of [['fresh',now],['inside',now-day+1],['boundary',now-day],['older',now-day-1],['future',now+1]] as const){
      insertProduct(db,'gamerunner',id);insert.run(id,id,id,time);
    }
    for(const role of ['admin','pokemon-reader'] as const){
      const snapshot=readPokemonSnapshot(db,false,now,{email:role==='admin' ? 'wydrian@gmail.com' : 'reader@example.com',role});
      assert.deepEqual(snapshot.latestEvents.map(event=>event.title),['fresh','inside']);
      assert.deepEqual(snapshot.events.map(event=>event.title),['fresh','inside']);
      assert.equal(snapshot.products.length,5);
    }
    const expired=readPokemonSnapshot(db,false,now+1);
    assert.equal(expired.latestEvents.some(event=>event.title==='inside'),false);
    assert.equal(expired.events.some(event=>event.title==='inside'),false);
    assert.equal(expired.products.length,5);assert.equal(db.prepare('SELECT count(*) AS n FROM pokemon_events').get()!.n,5);
  }finally{db.close();}
});

test('recent lists: age and availability filtering occur before global/shop limits, preserving unavailable events only in the database',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);
  const now=Date.UTC(2026,9,2,12),day=24*60*60_000;
  const insert=db.prepare("INSERT INTO pokemon_events(scan_id,shop_id,external_id,episode,kind,title,url,occurred_at) VALUES(?,'gamerunner',?,1,'new',?,'https://example.com',?)");
  try{
    for(let i=0;i<65;i++){insertProduct(db,'gamerunner','old-'+i);insert.run('old-'+i,'old-'+i,'Old '+i,now-day-i);}
    insertProduct(db,'gamerunner','live');insert.run('live','live','Live',now-2);
    insertProduct(db,'gamerunner','gone',0);insert.run('gone','gone','Recent gone',now-1);
    const snapshot=readPokemonSnapshot(db,false,now);
    assert.deepEqual(snapshot.latestEvents.map(event=>event.title),['Live']);
    assert.deepEqual(snapshot.events.map(event=>event.title),['Live']);
    assert.equal(snapshot.products.length,66);assert.equal(db.prepare('SELECT count(*) AS n FROM pokemon_events').get()!.n,67);
  }finally{db.close();}
});

test('recent lists: unchanged scans do not extend visibility; only a genuinely new restock starts another 24-hour window',()=>{
  const db=new DatabaseSync(':memory:');initializeDatabase(db);const day=24*60*60_000;
  const baseline:PokemonProduct[]=Array.from({length:3},(_,i)=>({externalID:'base-'+i,sku:'',title:'Base '+i,url:'https://gamerunner.hu/base-'+i,image:null,priceHuf:1000,availability:'in_stock'}));
  const added={...baseline[0],externalID:'added',title:'Added'};
  try{
    scan(db,baseline,1000);scan(db,[...baseline,added],700_000);const first=readPokemonSnapshot(db,false,700_001).latestEvents[0];
    assert.equal(readPokemonSnapshot(db,false,700_001+day-1).latestEvents.length,1);
    scan(db,[...baseline,added],700_001+day);let snapshot=readPokemonSnapshot(db,false,700_002+day);
    assert.deepEqual(snapshot.latestEvents,[]);assert.deepEqual(snapshot.events,[]);assert.equal(snapshot.products.length,4);
    assert.equal(db.prepare('SELECT count(*) AS n FROM pokemon_events').get()!.n,1);
    scan(db,baseline,800_000+day);scan(db,baseline,1500_000+day);scan(db,[...baseline,added],2200_000+day);
    snapshot=readPokemonSnapshot(db,false,2200_001+day);
    assert.equal(snapshot.latestEvents.length,1);assert.equal(snapshot.events.length,1);assert.equal(snapshot.latestEvents[0].kind,'restock');
    assert.notEqual(snapshot.latestEvents[0].id,first.id);assert.equal(db.prepare('SELECT count(*) AS n FROM pokemon_events').get()!.n,2);
  }finally{db.close();}
});
