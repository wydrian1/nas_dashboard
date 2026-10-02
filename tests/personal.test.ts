import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { initializeDatabase } from "../lib/db-schema.ts";
import { quickLinkUrl, inputId, inputText, inputLocation } from "../lib/personal-types.ts";
import { parseWeather, parseCities, weatherLabel, weatherIcon } from "../lib/weather-types.ts";
import { plainSqlRow } from "../lib/sql-rows.ts";

test("quick links permit browser HTTP/HTTPS links but reject executable URLs and credentials", () => {
  assert.equal(quickLinkUrl("https://example.com"), "https://example.com/");
  assert.equal(quickLinkUrl("http://192.168.1.20:8123/"), "http://192.168.1.20:8123/");
  for (const url of ["javascript:alert(1)","data:text/html,test","file:///secret","https://user:password@example.com"]) assert.throws(()=>quickLinkUrl(url));
});
test("personal inputs enforce lengths, identifiers and geographic bounds", () => {
  assert.equal(inputText("  hello  ","Text",20),"hello");
  assert.equal(inputText(null,"Optional",20,true),"");
  assert.throws(()=>inputText("x".repeat(21),"Text",20));
  assert.throws(()=>inputText("","Text",20));
  assert.equal(inputId("123"),123);
  for(const id of ["0","-1","1.5","9007199254740992",null]) assert.throws(()=>inputId(id));
  assert.deepEqual(inputLocation("Budapest","47.5","19.04"),{name:"Budapest",latitude:47.5,longitude:19.04});
  for(const [lat,lon] of [[91,0],[0,181],["",0],[NaN,0]]) assert.throws(()=>inputLocation("City",lat,lon));
});
test("new personal tables persist editable links/notes/tasks without touching RSS", () => {
  const database=new DatabaseSync(":memory:");
  try {
    initializeDatabase(database);
    database.exec("INSERT INTO feeds(name,url) VALUES('RSS','https://example.com/rss'); INSERT INTO quick_links(title,url) VALUES('Link','https://example.com'); INSERT INTO notes(title,content) VALUES('Note','First'); INSERT INTO todos(text) VALUES('Task')");
    database.exec("UPDATE notes SET content='Edited'; UPDATE todos SET done=1-done; INSERT INTO weather_location(id,name,latitude,longitude) VALUES(1,'Budapest',47.5,19.04)");
    initializeDatabase(database);
    assert.equal(database.prepare("SELECT content FROM notes").get()?.content,"Edited");
    assert.equal(database.prepare("SELECT done FROM todos").get()?.done,1);
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM feeds").get()?.n,1);
    assert.equal(database.prepare("SELECT name FROM weather_location").get()?.name,"Budapest");
    assert.throws(()=>database.exec("UPDATE todos SET done=2"));
    assert.throws(()=>database.exec("INSERT INTO weather_location(id,name,latitude,longitude) VALUES(2,'Other',0,0)"));
  } finally {database.close();}
});
test("weather values preserve valid zeroes and treat missing data as unknown", () => {
  const result=parseWeather({current:{temperature_2m:0,apparent_temperature:null,relative_humidity_2m:0,wind_speed_10m:0,weather_code:0,is_day:0,time:"2026-01-01T00:00"},daily:{time:["2026-01-01"],temperature_2m_min:[-2],temperature_2m_max:[3],precipitation_probability_max:[null],weather_code:[0]}});
  assert.equal(result.current.temperature,0);
  assert.equal(result.current.feelsLike,null);
  assert.equal(result.current.wind,0);
  assert.equal(result.days[0].rain,null);
  assert.equal(weatherLabel(95),"Zivatar");
  assert.equal(weatherIcon(0,false),"☾");
  assert.throws(()=>parseWeather({}));
});
test("city search ignores malformed provider records", () => {
  const results=parseCities({results:[{id:1,name:"Budapest",latitude:47.5,longitude:19.04,country:"Magyarország"},{id:2,name:"Bad",latitude:200,longitude:0}]});
  assert.equal(results.length,1);
  assert.equal(results[0].detail,"Magyarország");
  assert.deepEqual(parseCities({}),[]);
});
test("saved weather location is converted from SQLite's null prototype into React-safe props", () => {
  const database=new DatabaseSync(":memory:");
  try {
    initializeDatabase(database);
    database.exec("INSERT INTO weather_location(id,name,latitude,longitude) VALUES(1,'Budapest',47.49835,19.04045)");
    const row=database.prepare("SELECT name,latitude,longitude FROM weather_location WHERE id=1").get()!;
    assert.equal(Object.getPrototypeOf(row),null);
    const location=plainSqlRow(row);
    assert.equal(Object.getPrototypeOf(location),Object.prototype);
    assert.deepEqual(location,{name:"Budapest",latitude:47.49835,longitude:19.04045});
    assert.deepEqual(JSON.parse(JSON.stringify(location)),location);
    assert.equal(Object.getPrototypeOf(row),null);
  } finally {database.close();}
});
