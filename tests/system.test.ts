import { test } from "node:test";
import assert from "node:assert/strict";
import { cpuUsage, usedPercent, formatBytes, parseDisks } from "../lib/system-types.ts";

test("CPU uses idle and total deltas, not process usage or Windows loadavg", () => {
  assert.equal(cpuUsage({idle:100,total:200}, {idle:150,total:300}), 50);
  assert.equal(cpuUsage({idle:100,total:200}, {idle:200,total:300}), 0);
  assert.equal(cpuUsage({idle:100,total:200}, {idle:100,total:300}), 100);
  assert.equal(cpuUsage({idle:100,total:200}, {idle:100,total:200}), null);
  assert.equal(cpuUsage({idle:100,total:200}, {idle:50,total:100}), null);
});
test("byte formatting and capacity values are bounded", () => {
  assert.equal(formatBytes(1024 ** 3), "1 GiB");
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(-1), "—");
  assert.equal(usedPercent(100, 25), 75);
  assert.equal(usedPercent(0, 0), 0);
  assert.equal(usedPercent(100, -10), 100);
});
test("Windows drive output is validated and supports single/multiple disks", () => {
  assert.deepEqual(parseDisks('{"name":"C:","total":100,"free":40}'), [{name:"C:",total:100,free:40}]);
  assert.equal(parseDisks('[{"name":"D:","total":100,"free":20},{"name":"C:","total":100,"free":30}]')[0].name, "C:");
  assert.deepEqual(parseDisks('[{"name":"bad","total":100,"free":20},{"name":"C:","total":100,"free":200}]'), []);
  assert.deepEqual(parseDisks('[]'), []);
});
