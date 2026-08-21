import { createSupabaseContext } from "npm:@supabase/server";

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
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function publishableKey() {
  const modern = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (parsed?.default) return String(parsed.default);
      const first = Object.values(parsed || {})[0];
      if (first) return String(first);
    } catch (_) {}
  }
  return Deno.env.get("SUPABASE_ANON_KEY") || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("CONSENT_FROM_EMAIL") || Deno.env.get("* CONSENT_FROM_EMAIL");
  if (!resendKey || !fromEmail) {
    console.error("Consent email config missing", {
      resend: Boolean(resendKey),
      from: Boolean(fromEmail),
    });
    return json({ error: "Consent email service is not configured" }, 503);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    console.error("Consent email missing bearer token");
    return json({ error: "Sign in again before sending email" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publicKey = publishableKey();
  if (!supabaseUrl || !publicKey) {
    console.error("Supabase function environment missing URL/publishable key");
    return json({ error: "Authentication service is not configured" }, 503);
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      Authorization: authHeader,
      apikey: publicKey,
    },
  });
  if (!userResponse.ok) {
    const detail = (await userResponse.text()).slice(0, 300);
    console.error("Consent email user-token validation failed", userResponse.status, detail);
    return json({ error: "Your session expired. Sign in again and retry." }, 401);
  }

  const user = await userResponse.json();
  const userId = String(user?.id || "");
  if (!userId) return json({ error: "Invalid session" }, 401);

  const { data: ctx, error: contextError } = await createSupabaseContext(req, { auth: "none" });
  if (contextError || !ctx?.supabaseAdmin) {
    console.error("Consent email admin context failed", contextError?.message || "unknown");
    return json({ error: "Email service could not access the secure record" }, 500);
  }
  const admin = ctx.supabaseAdmin;

  let consentId = "";
  try {
    const body = await req.json();
    consentId = String(body?.consentId || "");
  } catch (_) {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!/^[0-9a-f-]{36}$/i.test(consentId)) return json({ error: "Invalid consent ID" }, 400);

  const { data: consent, error: consentError } = await admin
    .from("dm_consents")
    .select("id,clinic_id,consent_number,procedure_name_snapshot,doctor_email_snapshot,pdf_storage_path,status")
    .eq("id", consentId)
    .maybeSingle();
  if (consentError || !consent) return json({ error: "Consent not found" }, 404);

  const { data: membership, error: membershipError } = await admin
    .from("dm_clinic_members")
    .select("display_name")
    .eq("clinic_id", consent.clinic_id)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (membershipError || !membership) {
    console.error("Consent email clinic membership denied", userId, consent.clinic_id);
    return json({ error: "You do not have access to this clinic consent" }, 403);
  }

  if (consent.status !== "signed") return json({ error: "Only signed consents can be emailed" }, 409);
  if (!consent.doctor_email_snapshot || !consent.pdf_storage_path) {
    return json({ error: "Doctor email or PDF is missing" }, 409);
  }

  const { data: clinic } = await admin
    .from("dm_clinics")
    .select("name")
    .eq("id", consent.clinic_id)
    .maybeSingle();
  const clinicName = clinic?.name || "Dental clinic";

  const { data: file, error: downloadError } = await admin.storage
    .from("dm-consent-documents")
    .download(consent.pdf_storage_path);
  if (downloadError || !file) {
    console.error("Consent PDF download failed", downloadError?.message || "missing file");
    return json({ error: "Signed PDF could not be loaded" }, 500);
  }

  const pdfBytes = new Uint8Array(await file.arrayBuffer());
  const attemptId = crypto.randomUUID();
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `dentmemo-consent-${consent.id}-${attemptId}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [consent.doctor_email_snapshot],
      subject: `Signed dental consent • ${consent.consent_number}`,
      text: [
        `A dental consent form from ${clinicName} has been completed.`,
        "",
        `Consent ID: ${consent.consent_number}`,
        `Procedure: ${consent.procedure_name_snapshot}`,
        "",
        "The signed consent PDF is attached. A secure backup remains in DentMemo Consent for retrieval if this email is deleted.",
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
    console.error("Resend delivery failed", resendResponse.status, detail);
    await admin.from("dm_consents").update({ email_status: "failed" }).eq("id", consent.id);
    await admin.from("dm_consent_audit_events").insert({
      clinic_id: consent.clinic_id,
      consent_id: consent.id,
      event_type: "email_failed",
      actor_user_id: userId,
      actor_display_name: membership.display_name || null,
      entity_type: "consent",
      entity_id: consent.id,
      metadata: { provider: "resend", status: resendResponse.status, attempt_id: attemptId },
    });
    return json({ error: "Email delivery failed", providerStatus: resendResponse.status, detail }, 502);
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
    actor_user_id: userId,
    actor_display_name: membership.display_name || null,
    entity_type: "consent",
    entity_id: consent.id,
    metadata: { provider: "resend", provider_message_id: provider?.id || null, attempt_id: attemptId },
  });

  return json({ ok: true, providerMessageId: provider?.id || null, attemptId });
});
