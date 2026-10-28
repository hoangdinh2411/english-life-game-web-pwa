const apiKey = process.env.RENDER_API_KEY;
const serviceId = process.env.RENDER_SERVICE_ID;
const commitId = process.env.RENDER_COMMIT_SHA;
if (!apiKey || !serviceId || !commitId)
  throw new Error(
    "RENDER_API_KEY, RENDER_SERVICE_ID and RENDER_COMMIT_SHA are required.",
  );

const headers = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};
const baseUrl = "https://api.render.com/v1";
const response = await fetch(
  `${baseUrl}/services/${encodeURIComponent(serviceId)}/deploys`,
  {
    method: "POST",
    headers,
    body: JSON.stringify({ clearCache: "do_not_clear", commitId }),
  },
);
if (!response.ok)
  throw new Error(
    `Render deploy request failed (${response.status}): ${await response.text()}`,
  );
const deploy = await response.json();
const deployId = deploy.id ?? deploy.deploy?.id;
if (!deployId)
  throw new Error("Render deploy response did not include a deploy id.");

const deadline = Date.now() + 15 * 60 * 1000;
const terminal = new Set([
  "live",
  "build_failed",
  "deactivated",
  "canceled",
  "cancelled",
  "update_failed",
]);
while (Date.now() < deadline) {
  const statusResponse = await fetch(
    `${baseUrl}/services/${encodeURIComponent(serviceId)}/deploys/${encodeURIComponent(deployId)}`,
    { headers },
  );
  if (!statusResponse.ok)
    throw new Error(
      `Render deploy status failed (${statusResponse.status}): ${await statusResponse.text()}`,
    );
  const status = await statusResponse.json();
  const state = status.status ?? status.deploy?.status;
  console.log(JSON.stringify({ serviceId, deployId, status: state }));
  if (state === "live") process.exit(0);
  if (terminal.has(state))
    throw new Error(`Render deployment ended with ${state}.`);
  await new Promise((resolve) => globalThis.setTimeout(resolve, 10_000));
}
throw new Error("Timed out waiting for Render deployment to become live.");
