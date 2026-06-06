import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDate, formatMoscowDateTimeLocalInput, parseMoscowDateTimeLocal } from "@/lib/utils";

test("parses tournament datetime-local values as Moscow time", () => {
  const date = parseMoscowDateTimeLocal("2026-06-06T12:00");

  assert.equal(date.toISOString(), "2026-06-06T09:00:00.000Z");
  assert.equal(formatDate(date), "6 июн. 2026, 12:00");
  assert.equal(formatMoscowDateTimeLocalInput(date), "2026-06-06T12:00");
});
