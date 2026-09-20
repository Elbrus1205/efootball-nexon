import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { ProfileStatusTone } from "@prisma/client";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import * as content from "./content";

type Element = { props: { entries?: { id: string; title: string; blocks: content.FaqBlock[] }[]; children?: Element | Element[] } };

async function pageEntries(rows: { id: string; title: string; answer: string; category: string; contentJson: string | null; attachments: [] }[]) {
  const page = readFileSync(new URL("../../app/faq/page.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(page, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports: { default?: () => Promise<Element> } = {};
  const component = () => null;
  runInNewContext(compiled.outputText, {
    exports,
    require: (name: string): unknown => {
      switch (name) {
        case "react/jsx-runtime": return jsxRuntime;
        case "next/link": return { default: component };
        case "lucide-react": return { ArrowUpRight: component, LifeBuoy: component };
        case "@prisma/client": return { ProfileStatusTone };
        case "@/components/faq/faq.module.css": return { default: {} };
        case "@/components/faq/faq-search": return { FaqSearch: component };
        case "@/lib/profile-status-style": return { profileStatusClassName: () => "" };
        case "@/lib/faq/content": return content;
        case "@/lib/services/reliability": return {
          RELIABILITY_MAX_SCORE: 100, RELIABILITY_REGISTRATION_THRESHOLD: 70,
          RELIABILITY_RECOVERY_SCORE_CAP: 80, RELIABILITY_RESTRICTION_DAYS: 30,
        };
        case "@/lib/db": return { db: { faqItem: { findMany: async (query: { where: { isPublished: boolean } }) => {
          assert.equal(query.where.isPublished, true);
          return rows;
        } } } };
        default: throw new Error(`Unexpected page dependency: ${name}`);
      }
    },
  });
  assert.ok(exports.default);
  const root = await exports.default();
  const children = root.props.children;
  assert.ok(Array.isArray(children));
  const entries = children.find((child) => child.props.entries)?.props.entries;
  assert.ok(entries);
  return entries;
}

test("public FAQ only shows database questions, with the current admin text and media", async () => {
  const blocks: content.FaqBlock[] = [
    { type: "text", text: "Updated by the administrator" },
    { type: "image", url: "/uploads/security.png", caption: "Security settings" },
  ];
  const entries = await pageEntries([{
    id: "static-secure-account", title: "Updated security question", category: "Security",
    answer: "Legacy answer", contentJson: JSON.stringify(blocks), attachments: [],
  }]);
  assert.equal(entries.length, 1, "Code-only questions must not bypass the admin-managed list");
  assert.equal(entries[0].title, "Updated security question");
  assert.deepEqual(entries[0].blocks, blocks);
});

test("hiding or deleting all database questions leaves no hardcoded public copies", async () => {
  assert.equal((await pageEntries([])).length, 0);
});
