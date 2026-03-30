import { getTokenForAccount } from "./apify-accounts";

const BASE_URL = "https://api.apify.com/v2";

const POLL_INTERVAL_MS = 5000;
const MAX_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runActorAndGetResults(
  actorId: string,
  input: Record<string, unknown>,
  accountId?: string
): Promise<unknown[]> {
  const token = getTokenForAccount(accountId);
  // Apify API uses ~ instead of / in actor IDs (e.g. apidojo~tiktok-scraper)
  const actorIdForUrl = actorId.replace("/", "~");

  // 1. Start the actor run with waitForFinish=120
  const runUrl = `${BASE_URL}/acts/${actorIdForUrl}/runs?token=${token}&waitForFinish=120`;

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

    const pollUrl = `${BASE_URL}/acts/${actorIdForUrl}/runs/${runId}?token=${token}`;
    const pollResponse = await fetch(pollUrl);

    if (!pollResponse.ok) {
      throw new Error(`Polling failed (${pollResponse.status})`);
    }

    runData = await pollResponse.json();
  }

  // 3. Check final status
  const finalStatus = runData.data?.status;
  if (finalStatus !== "SUCCEEDED") {
    const statusMessage = runData.data?.statusMessage || "";
    const exitCode = runData.data?.exitCode;
    
    // Try to fetch the run log for more details
    let logSnippet = "";
    try {
      const logUrl = `${BASE_URL}/acts/${actorIdForUrl}/runs/${runId}/log?token=${token}`;
      const logResponse = await fetch(logUrl);
      if (logResponse.ok) {
        const fullLog = await logResponse.text();
        // Get last 500 chars of log for error context
        logSnippet = fullLog.slice(-500).trim();
      }
    } catch { /* ignore log fetch errors */ }

    let errorMsg = `Actor run failed with status: ${finalStatus}`;
    if (statusMessage) errorMsg += ` — ${statusMessage}`;
    if (exitCode != null) errorMsg += ` (exit code: ${exitCode})`;
    if (logSnippet) errorMsg += `\n[LOG] ${logSnippet}`;
    
    throw new Error(errorMsg);
  }

  // 4. Fetch dataset items
  const datasetId = runData.data?.defaultDatasetId;
  if (!datasetId) {
    throw new Error("No dataset ID returned from actor run");
  }

  const datasetUrl = `${BASE_URL}/datasets/${datasetId}/items?token=${token}`;
  const datasetResponse = await fetch(datasetUrl);

  if (!datasetResponse.ok) {
    throw new Error(`Dataset fetch failed (${datasetResponse.status})`);
  }

  const items: unknown[] = await datasetResponse.json();
  return items;
}
