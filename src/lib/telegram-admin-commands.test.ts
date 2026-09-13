import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "@prisma/client";
import {
  buildTelegramAdminCommandsText,
  isTelegramAdminRole,
  telegramAdminCommands,
} from "./telegram-admin-commands";

test("all site administration roles can open the admin command list", () => {
  for (const role of [UserRole.FOUNDER, UserRole.ORGANIZER, UserRole.ADMIN, UserRole.JUDGE, UserRole.TRAINEE]) {
    assert.equal(isTelegramAdminRole(role), true);
  }

  assert.equal(isTelegramAdminRole(UserRole.PLAYER), false);
  assert.equal(isTelegramAdminRole(undefined), false);
  assert.equal(isTelegramAdminRole(null), false);
});

test("admin command list contains every currently available admin command", () => {
  const text = buildTelegramAdminCommandsText();

  for (const command of telegramAdminCommands) {
    assert.match(text, new RegExp(command.command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(text, new RegExp(command.description));
  }
});
