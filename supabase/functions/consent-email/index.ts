const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Email delivery was intentionally removed from DentMemo Consent.
  // Keep this endpoint as a compatibility no-op for older cached clients so
  // their legacy retry queues clear without sending any message.
  return json({
    ok: true,
    emailFeatureRemoved: true,
    message: "Signed consent PDFs are stored in DentMemo Consent for in-platform retrieval and download.",
  });
});
