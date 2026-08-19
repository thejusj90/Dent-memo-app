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

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("CONSENT_FROM_EMAIL");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendKey || !fromEmail) {
    return json({ error: "Consent email service is not configured" }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Invalid session" }, 401);

  let consentId = "";
  try {
    const body = await req.json();
    consentId = String(body?.consentId || "");
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!/^[0-9a-f-]{36}$/i.test(consentId)) return json({ error: "Invalid consent ID" }, 400);

  const { data: consent, error: consentError } = await userClient
    .from("dm_consents")
    .select("id,clinic_id,consent_number,procedure_name_snapshot,doctor_email_snapshot,pdf_storage_path,status")
    .eq("id", consentId)
    .single();
  if (consentError || !consent) return json({ error: "Consent not found" }, 404);
  if (consent.status !== "signed") return json({ error: "Only signed consents can be emailed" }, 409);
  if (!consent.doctor_email_snapshot || !consent.pdf_storage_path) {
    return json({ error: "Doctor email or PDF is missing" }, 409);
  }

  const { data: file, error: downloadError } = await admin.storage
    .from("dm-consent-documents")
    .download(consent.pdf_storage_path);
  if (downloadError || !file) return json({ error: "Signed PDF could not be loaded" }, 500);

  const pdfBytes = new Uint8Array(await file.arrayBuffer());
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `dentmemo-consent-${consent.id}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [consent.doctor_email_snapshot],
      subject: `Signed dental consent • ${consent.consent_number}`,
      text: [
        "A dental consent form has been completed.",
        "",
        `Consent ID: ${consent.consent_number}`,
        `Procedure: ${consent.procedure_name_snapshot}`,
        "",
        "The signed consent PDF is attached.",
        "",
        "DentMemo Consent",
      ].join("\n"),
      attachments: [{
        filename: `${consent.consent_number}.pdf`,
        content: bytesToBase64(pdfBytes),
      }],
    }),
  });

  if (!resendResponse.ok) {
    const detail = (await resendResponse.text()).slice(0, 500);
    await admin.from("dm_consents").update({ email_status: "failed" }).eq("id", consent.id);
    await admin.from("dm_consent_audit_events").insert({
      clinic_id: consent.clinic_id,
      consent_id: consent.id,
      event_type: "email_failed",
      actor_user_id: userData.user.id,
      metadata: { provider: "resend", status: resendResponse.status, detail },
    });
    return json({ error: "Email delivery failed" }, 502);
  }

  const provider = await resendResponse.json().catch(() => ({}));
  await admin.from("dm_consents").update({
    email_status: "sent",
    email_sent_at: new Date().toISOString(),
  }).eq("id", consent.id);
  await admin.from("dm_consent_audit_events").insert({
    clinic_id: consent.clinic_id,
    consent_id: consent.id,
    event_type: "email_sent",
    actor_user_id: userData.user.id,
    metadata: { provider: "resend", provider_message_id: provider?.id || null },
  });

  return json({ ok: true, providerMessageId: provider?.id || null });
});
