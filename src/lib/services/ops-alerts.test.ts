import assert from "node:assert/strict";
import test from "node:test";
import { buildOperationalDigestLines } from "@/lib/services/ops-alerts";

const healthy = {
  undeliveredTotal: 0,
  undeliveredStuck: 0,
  oldestUndeliveredMinutes: null,
  lastDeliveryMinutesAgo: 2,
  openDisputes: 0,
  overdueMatches: 0,
  pendingApplications: 0,
  oldestPendingApplicationHours: null,
  botOnline: true,
};

test("healthy metrics produce no digest lines", () => {
  assert.deepEqual(buildOperationalDigestLines(healthy), []);
});

test("bot offline surfaces a critical line", () => {
  const lines = buildOperationalDigestLines({ ...healthy, botOnline: false });
  assert.ok(lines.some((line) => line.includes("Telegram-бот недоступен")));
});

test("stuck delivery is critical, not just growth", () => {
  const lines = buildOperationalDigestLines({
    ...healthy,
    undeliveredTotal: 30,
    undeliveredStuck: 5,
    oldestUndeliveredMinutes: 40,
  });
  assert.ok(lines.some((line) => line.includes("доставка уведомлений похоже не запускается")));
  assert.ok(!lines.some((line) => line.includes("Рост неотправленных")));
});

test("high queue without stuck items reports growth", () => {
  const lines = buildOperationalDigestLines({ ...healthy, undeliveredTotal: 25 });
  assert.ok(lines.some((line) => line.includes("Рост неотправленных уведомлений: 25")));
});

test("stale delivery cron (no recent delivery) is critical", () => {
  const lines = buildOperationalDigestLines({ ...healthy, lastDeliveryMinutesAgo: 60 });
  assert.ok(lines.some((line) => line.includes("не запускается")));
});

test("disputes, overdue and applications each add a line", () => {
  const lines = buildOperationalDigestLines({
    ...healthy,
    openDisputes: 2,
    overdueMatches: 3,
    pendingApplications: 4,
    oldestPendingApplicationHours: 10,
  });
  assert.ok(lines.some((line) => line.includes("Открытые спорные матчи: 2")));
  assert.ok(lines.some((line) => line.includes("Просроченные матчи без результата: 3")));
  assert.ok(lines.some((line) => line.includes("Заявки на проверке: 4")));
});
