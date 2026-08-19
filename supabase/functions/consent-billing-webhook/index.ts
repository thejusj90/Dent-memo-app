import { createClient } from "npm:@supabase/supabase-js@2.112.3";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i += 1) result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return result === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Webhook is not configured" }, 503);
  }

  const signature = req.headers.get("x-razorpay-signature") || "";
  const rawBody = await req.text();
  const expected = await hmacHex(webhookSecret, rawBody);
  if (!signature || !constantTimeEqual(signature.toLowerCase(), expected.toLowerCase())) {
    return json({ error: "Invalid webhook signature" }, 401);
  }

  let payload: Record<string, any>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const event = String(payload.event || "");
  const subscription = payload?.payload?.subscription?.entity;
  if (!subscription?.id) return json({ ok: true, ignored: true });

  const clinicId = String(subscription?.notes?.clinic_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(clinicId)) {
    return json({ error: "Subscription is missing a valid clinic_id note" }, 400);
  }

  const map: Record<string, "active" | "past_due" | "cancelled" | "expired"> = {
    "subscription.activated": "active",
    "subscription.charged": "active",
    "subscription.resumed": "active",
    "subscription.paused": "past_due",
    "subscription.halted": "past_due",
    "subscription.cancelled": "cancelled",
    "subscription.completed": "expired",
  };
  const status = map[event];
  if (!status) return json({ ok: true, ignored: true, event });

  const currentPeriodEnd = subscription.current_end
    ? new Date(Number(subscription.current_end) * 1000).toISOString()
    : null;

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { error } = await admin.from("dm_product_entitlements").upsert({
    clinic_id: clinicId,
    product_key: "consent",
    status,
    billing_provider: "razorpay",
    provider_subscription_id: String(subscription.id),
    current_period_end: currentPeriodEnd,
  }, { onConflict: "clinic_id,product_key" });

  if (error) return json({ error: "Could not update entitlement" }, 500);
  return json({ ok: true, status });
});
