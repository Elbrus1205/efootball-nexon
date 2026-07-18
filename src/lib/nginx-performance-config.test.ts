import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("Nginx keeps ordinary upstream connections alive", () => {
  const http = readFileSync(path.join(process.cwd(), "deploy", "nginx", "http-cache.conf"), "utf8");
  const locations = readFileSync(path.join(process.cwd(), "deploy", "nginx", "server-locations.conf"), "utf8");

  assert.match(http, /map \$http_upgrade \$nexon_connection_upgrade \{[\s\S]+""\s+"";/);
  assert.match(locations, /location ~[\s\S]+proxy_set_header Connection "";/);
});
