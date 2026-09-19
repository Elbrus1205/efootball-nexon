import assert from "node:assert/strict";
import { test } from "node:test";
import { getRatingPageNumbers, getRatingsPagination, ratingPageHref } from "./ratings-pagination";

test("ratings pages contain ten players with stable global positions", () => {
  const players = Array.from({ length: 47 }, (_, index) => index + 1);
  for (const page of [1, 2, 3, 4, 5]) {
    const pagination = getRatingsPagination(players.length, String(page));
    const visible = players.slice(pagination.offset, pagination.end);
    assert.equal(visible.length, page === 5 ? 7 : 10);
    assert.equal(visible[0], (page - 1) * 10 + 1);
    assert.equal(visible.includes(24), page === 3);
  }
});

test("ratings pagination clamps boundaries and rejects malformed query parameters", () => {
  for (const input of [undefined, "", "-2", "0", "1.5", "2abc", "Infinity", "9007199254740992", ["2", "3"]]) {
    assert.equal(getRatingsPagination(47, input).page, 1);
  }
  assert.deepEqual(getRatingsPagination(0, "5"), { page: 1, totalPages: 1, offset: 0, end: 0 });
  assert.deepEqual(getRatingsPagination(47, "99"), { page: 5, totalPages: 5, offset: 40, end: 47 });
  assert.equal(getRatingsPagination(20, "3").totalPages, 2);
});

test("page navigation remains bounded for large ratings and includes current and end pages", () => {
  for (const total of [1, 2, 5, 6, 100, 1000000]) {
    for (const page of [1, Math.ceil(total / 2), total]) {
      const items = getRatingPageNumbers(page, total);
      const numbers = items.filter((item): item is number => typeof item === "number");
      assert.ok(items.length <= 7);
      assert.equal(numbers[0], 1);
      assert.equal(numbers.at(-1), total);
      assert.ok(numbers.includes(page));
      assert.deepEqual(numbers, [...new Set(numbers)].sort((a, b) => a - b));
    }
  }
});

test("page links preserve the selected period and encode season identifiers", () => {
  assert.equal(ratingPageHref(null, 2), "/ratings?season=all&page=2");
  assert.equal(ratingPageHref("autumn", 1), "/ratings?season=autumn");
  const url = new URL(ratingPageHref("summer & autumn", 3), "https://example.com");
  assert.equal(url.searchParams.get("season"), "summer & autumn");
  assert.equal(url.searchParams.get("page"), "3");
});
