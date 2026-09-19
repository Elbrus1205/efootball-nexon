import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

test("random scores stay disabled for the entire request and reject rapid repeat clicks", async () => {
  let saving = false;
  let requests = 0;
  let refreshes = 0;
  const inFlight = { current: false };
  let finish: (response: Response) => void = () => { throw new Error("Request not started"); };
  const notices: string[] = [];
  const modules: Record<string, unknown> = {
    "react/jsx-runtime": jsxRuntime,
    // React 18 transitions track synchronous rendering, not a fetch promise.
    react: {
      useTransition: () => [false, (callback: () => void) => callback()],
      useState: () => [saving, (value: boolean) => { saving = value; }],
      useRef: () => inFlight,
    },
    "next/navigation": { useRouter: () => ({ refresh: () => { refreshes++; } }) },
    "lucide-react": { Dices: "svg" },
    "@/components/ui/button": { Button: "button" },
    sonner: { toast: { success: () => notices.push("success"), warning: () => notices.push("warning"), error: () => notices.push("error") } },
  };
  const exports: Record<string, unknown> = {};
  const compiled = ts.transpileModule(readFileSync("src/components/admin/random-scores-button.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(compiled, {
    exports,
    require: (name: string) => { assert.ok(name in modules, `Unexpected dependency ${name}`); return modules[name]; },
    fetch: () => { requests++; return new Promise<Response>((resolve) => { finish = resolve; }); },
  });
  const render = exports.RandomScoresButton as (props: { tournamentId: string }) => {
    props: { disabled: boolean; onClick: () => Promise<void> };
  };
  const button = render({ tournamentId: "cup" });
  const request = button.props.onClick();
  await button.props.onClick();
  assert.equal(requests, 1);
  assert.equal(render({ tournamentId: "cup" }).props.disabled, true);
  finish(Response.json({ warning: "Счёт сохранён, проверьте сетку." }));
  await request;
  assert.equal(render({ tournamentId: "cup" }).props.disabled, false);
  assert.equal(refreshes, 1);
  assert.deepEqual(notices, ["warning"]);
});
