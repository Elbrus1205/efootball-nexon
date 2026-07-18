const baseUrl = (process.env.WARMUP_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const routes = ["/", "/faq", "/players", "/tournaments", "/ratings"];

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitUntilReady() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await delay(500);
  }
  throw new Error(`Server did not become ready at ${baseUrl}`);
}

await waitUntilReady();

for (const route of routes) {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: { "user-agent": "nexon-startup-cache-warmup/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  await response.arrayBuffer();
  if (!response.ok) throw new Error(`Warm-up failed for ${route}: HTTP ${response.status}`);
}

console.log(`Public route cache warmed: ${routes.join(", ")}`);
