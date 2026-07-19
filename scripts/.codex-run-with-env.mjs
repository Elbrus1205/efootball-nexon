import "dotenv/config";
import { spawnSync } from "node:child_process";

const [script, ...args] = process.argv.slice(2);
const result = spawnSync(process.execPath, [script, ...args], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
