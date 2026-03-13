const APIFY_TOKEN = process.env.APIFY_TOKEN!;
const BASE_URL = "https://api.apify.com/v2";

const POLL_INTERVAL_MS = 5000;
const MAX_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runActorAndGetResults(
  actorId: string,
  input: Record<string, unknown>
): Promise<unknown[]> {
  // Apify API uses ~ instead of / in actor IDs (e.g. apidojo~tiktok-scraper)
  const actorIdForUrl = actorId.replace("/", "~");

  // 1. Start the actor run with waitForFinish=120
  const runUrl = `${BASE_URL}/acts/${actorIdForUrl}/runs?token=${APIFY_TOKEN}&waitForFinish=120`;

  const runResponse = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!runResponse.ok) {
    const text = await runResponse.text();
    throw new Error(`Apify run request failed (${runResponse.status}): ${text}`);
  }

  let runData = await runResponse.json();
  const runId = runData.data?.id;

  if (!runId) {
    throw new Error("Apify did not return a run ID");
  }

  // 2. If not finished, poll until done
  const startTime = Date.now();

  while (runData.data?.status === "RUNNING" || runData.data?.status === "READY") {
    if (Date.now() - startTime > MAX_TIMEOUT_MS) {
      throw new Error("TIMEOUT: o actor não terminou em 5 minutos.");
    }

    await sleep(POLL_INTERVAL_MS);

    const pollUrl = `${BASE_URL}/acts/${actorIdForUrl}/runs/${runId}?token=${APIFY_TOKEN}`;
    const pollResponse = await fetch(pollUrl);

    if (!pollResponse.ok) {
      throw new Error(`Polling failed (${pollResponse.status})`);
    }

    runData = await pollResponse.json();
  }

  // 3. Check final status
  const finalStatus = runData.data?.status;
  if (finalStatus !== "SUCCEEDED") {
    throw new Error(`Actor run failed with status: ${finalStatus}`);
  }

  // 4. Fetch dataset items
  const datasetId = runData.data?.defaultDatasetId;
  if (!datasetId) {
    throw new Error("No dataset ID returned from actor run");
  }

  const datasetUrl = `${BASE_URL}/datasets/${datasetId}/items?token=${APIFY_TOKEN}`;
  const datasetResponse = await fetch(datasetUrl);

  if (!datasetResponse.ok) {
    throw new Error(`Dataset fetch failed (${datasetResponse.status})`);
  }

  const items: unknown[] = await datasetResponse.json();
  return items;
}
