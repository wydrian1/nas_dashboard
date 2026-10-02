type Rule = { allow: boolean; path: string };
type Group = { agents: string[]; rules: Rule[]; delay: number };

export function robotsPermission(source: string, path: string): { allowed: boolean; delayMs: number } {
  const groups: Group[] = [];
  let current: Group = {agents:[],rules:[],delay:0};
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    const colon = line.indexOf(":");
    if (colon<0) continue;
    const key=line.slice(0,colon).toLowerCase(), value=line.slice(colon+1).trim();
    if (key==="user-agent") {
      if (current.rules.length || current.delay) {groups.push(current);current={agents:[],rules:[],delay:0};}
      current.agents.push(value.toLowerCase());
    } else if (current.agents.length && ["allow","disallow"].includes(key) && value) {
      current.rules.push({allow:key==="allow",path:value});
    } else if (key==="crawl-delay" && current.agents.length && Number.isFinite(Number(value))) current.delay=Math.max(0,Number(value));
  }
  groups.push(current);
  const specific=groups.filter(group=>group.agents.some(agent=>agent!=="*" && "wydrianmonitor".includes(agent)));
  const selected=specific.length ? specific : groups.filter(group=>group.agents.includes("*"));
  let matched: Rule | undefined;
  for (const rule of selected.flatMap(group=>group.rules)) {
    const expression=rule.path.replace(/[.+?^{}()|[\]\\]/g,"\\$&").replace(/\*/g,".*");
    if (!new RegExp(`^${expression}`).test(path)) continue;
    if (!matched || rule.path.length>matched.path.length || (rule.path.length===matched.path.length && rule.allow)) matched=rule;
  }
  return {allowed:matched ? matched.allow : true,delayMs:Math.max(1500,...selected.map(group=>group.delay*1000))};
}
