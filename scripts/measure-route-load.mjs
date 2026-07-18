const baseUrl = (process.env.PERF_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const concurrency = Number.parseInt(process.env.PERF_CONCURRENCY ?? "20", 10);
const requestsPerRoute = Number.parseInt(process.env.PERF_REQUESTS ?? "60", 10);
const maximumP95Ms = Number.parseInt(process.env.PERF_MAX_P95_MS ?? "2500", 10);
const authCookie = process.env.PERF_AUTH_COOKIE?.trim();
const routes = (process.env.PERF_ROUTES ?? "/,/faq,/players,/tournaments,/ratings")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);

if (![concurrency, requestsPerRoute, maximumP95Ms].every((value) => Number.isFinite(value) && value > 0)) {
  throw new Error("PERF_CONCURRENCY, PERF_REQUESTS and PERF_MAX_P95_MS must be positive integers");
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

async function measure(route) {
  const durations = [];
  const errors = [];
  let nextRequest = 0;

  async function worker() {
    while (nextRequest < requestsPerRoute) {
      nextRequest += 1;
      const startedAt = performance.now();
      try {
        const response = await fetch(`${baseUrl}${route}`, {
          headers: {
            accept: "text/html",
            "user-agent": "nexon-read-only-load-check/1.0",
            ...(authCookie ? { cookie: authCookie } : {}),
          },
          redirect: "manual",
          signal: AbortSignal.timeout(30_000),
        });
        await response.arrayBuffer();
        durations.push(performance.now() - startedAt);
        if (response.status >= 400) errors.push(response.status);
      } catch (error) {
        durations.push(performance.now() - startedAt);
        errors.push(error instanceof Error ? error.name : "request-error");
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, requestsPerRoute) }, () => worker()));
  return {
    route,
    requests: durations.length,
    errors: errors.length,
    p50Ms: Math.round(percentile(durations, 0.5)),
    p95Ms: Math.round(percentile(durations, 0.95)),
    maxMs: Math.round(Math.max(...durations)),
  };
}

const results = [];
for (const route of routes) results.push(await measure(route));
console.table(results);

const failed = results.filter((result) => result.errors > 0 || result.p95Ms > maximumP95Ms);
if (failed.length) {
  process.exitCode = 1;
  console.error(`Performance budget failed: p95 must be <= ${maximumP95Ms} ms and errors must be 0.`);
}
