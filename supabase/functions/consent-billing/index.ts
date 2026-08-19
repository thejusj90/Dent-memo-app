import { createClient } from "npm:@supabase/supabase-js@2.112.3";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
  const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  const planId = Deno.env.get("RAZORPAY_CONSENT_PLAN_ID");
  const planName = Deno.env.get("CONSENT_PLAN_NAME") || "DentMemo Consent";
  const priceDisplay = Deno.env.get("CONSENT_PRICE_DISPLAY") || "Configured in Razorpay";
  const totalCount = Number(Deno.env.get("RAZORPAY_CONSENT_TOTAL_COUNT") || "120");

  if (!supabaseUrl || !anonKey || !razorpayKeyId || !razorpayKeySecret || !planId) {
    return json({ error: "Consent billing is not configured" }, 503);
  }

  let clinicId = "";
  try {
    const body = await req.json();
    clinicId = String(body?.clinicId || "");
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!/^[0-9a-f-]{36}$/i.test(clinicId)) return json({ error: "Invalid clinic ID" }, 400);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Invalid session" }, 401);

  const { data: membership, error: memberError } = await userClient
    .from("dm_clinic_members")
    .select("role")
    .eq("clinic_id", clinicId)
    .eq("user_id", userData.user.id)
    .eq("active", true)
    .maybeSingle();
  if (memberError || !membership) return json({ error: "Clinic access denied" }, 403);
  if (membership.role !== "owner") return json({ error: "Only the clinic owner can manage billing" }, 403);

  const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
  const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: planId,
      total_count: Number.isFinite(totalCount) && totalCount > 0 ? totalCount : 120,
      customer_notify: 1,
      notes: {
        clinic_id: clinicId,
        product_key: "consent",
        owner_user_id: userData.user.id,
      },
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    return json({ error: "Could not create Razorpay subscription", detail }, 502);
  }

  const subscription = await response.json();
  return json({
    keyId: razorpayKeyId,
    subscriptionId: subscription.id,
    planName,
    priceDisplay,
  });
});
