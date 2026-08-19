import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { buildConsentPdf } from "./pdf";
import type { ClinicContext, ConsentRecord, ConsentTemplate, DoctorSetting, SignedConsentInput } from "./types";

const DEMO = process.env.NEXT_PUBLIC_CONSENT_DEMO_MODE === "true";

export function consentDemoMode() {
  return DEMO || !isSupabaseConfigured();
}

function client(): SupabaseClient {
  return getSupabaseBrowserClient() as unknown as SupabaseClient;
}

export async function currentSession(): Promise<Session | null> {
  if (consentDemoMode()) return null;
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  return data.session;
}

export async function signInConsent(email: string, password: string) {
  return getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
}

export async function signUpConsent(email: string, password: string, fullName: string) {
  return getSupabaseBrowserClient().auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, requested_role: "owner" } },
  });
}

export async function signOutConsent() {
  return getSupabaseBrowserClient().auth.signOut();
}

export async function createConsentClinic(user: User, name: string, city: string) {
  const { error } = await client().from("dm_clinics").insert({
    owner_user_id: user.id,
    name: name.trim(),
    city: city.trim() || null,
  });
  if (error) throw error;
}

export async function loadConsentContext(user: User): Promise<ClinicContext | null> {
  const supabase = client();
  const { data: membership, error: memberError } = await supabase
    .from("dm_clinic_members")
    .select("clinic_id,role,display_name")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!membership) return null;

  const clinicId = membership.clinic_id as string;
  const [clinicResult, doctorsResult, templatesResult, recordsResult] = await Promise.all([
    supabase.from("dm_clinics").select("id,name,city").eq("id", clinicId).single(),
    supabase.from("dm_consent_doctor_settings").select("*").eq("clinic_id", clinicId).eq("active", true).order("doctor_name"),
    supabase.from("dm_consent_templates").select("*").or(`clinic_id.is.null,clinic_id.eq.${clinicId}`).eq("active", true).order("display_title"),
    supabase.from("dm_consents").select("id,clinic_id,consent_number,template_version,patient_name_snapshot,patient_mobile_snapshot,patient_dob_snapshot,doctor_name_snapshot,doctor_registration_snapshot,doctor_email_snapshot,procedure_key,procedure_name_snapshot,tooth_numbers,procedure_notes,consent_title_snapshot,consent_text_snapshot,locale,acknowledgements,signer_type,signer_name,signer_relationship,status,signed_at,voided_at,void_reason,email_status,email_sent_at,pdf_storage_path,created_at").eq("clinic_id", clinicId).order("created_at", { ascending: false }).limit(250),
  ]);

  if (clinicResult.error) throw clinicResult.error;
  if (doctorsResult.error) throw doctorsResult.error;
  if (templatesResult.error) throw templatesResult.error;
  if (recordsResult.error) throw recordsResult.error;

  return {
    clinicId,
    clinicName: clinicResult.data.name as string,
    city: (clinicResult.data.city as string | null) ?? null,
    role: membership.role as ClinicContext["role"],
    displayName: membership.display_name as string,
    entitlement: "active",
    doctors: (doctorsResult.data ?? []) as DoctorSetting[],
    templates: (templatesResult.data ?? []) as ConsentTemplate[],
    records: (recordsResult.data ?? []) as ConsentRecord[],
  };
}

export function demoContext(): ClinicContext {
  return {
    clinicId: "demo-clinic",
    clinicName: "DentMemo Demo Clinic",
    city: "Goa",
    role: "owner",
    displayName: "Dr. Demo",
    entitlement: "active",
    doctors: [
      { id: "doctor-demo", clinic_id: "demo-clinic", doctor_name: "Dr. Blessin Mathew", registration_number: "GA-1234", email: "doctor@example.com", active: true },
    ],
    templates: [
      {
        id: "template-rct", clinic_id: "demo-clinic", procedure_key: "root_canal", display_title: "Root Canal Treatment",
        consent_text: "The proposed root canal treatment, its purpose, expected benefits, relevant risks, alternatives and the possibility of additional treatment have been explained to me. I have had the opportunity to ask questions and I understand that outcomes cannot be guaranteed.",
        locale: "en-IN", version: 1, approval_status: "approved", active: true,
      },
      {
        id: "template-extraction", clinic_id: "demo-clinic", procedure_key: "extraction", display_title: "Dental Extraction",
        consent_text: "The proposed extraction, expected benefits, common risks, possible complications, alternatives and post-operative instructions have been explained to me. I have had the opportunity to ask questions and agree to proceed.",
        locale: "en-IN", version: 1, approval_status: "approved", active: true,
      },
    ],
    records: [],
  };
}

export async function saveDoctor(clinicId: string, input: { doctorName: string; registrationNumber: string; email: string }) {
  const { error } = await client().from("dm_consent_doctor_settings").insert({
    clinic_id: clinicId,
    doctor_name: input.doctorName.trim(),
    registration_number: input.registrationNumber.trim() || null,
    email: input.email.trim().toLowerCase(),
    active: true,
  });
  if (error) throw error;
}

export async function approveTemplateForClinic(clinicId: string, template: ConsentTemplate) {
  if (consentDemoMode()) return;
  const supabase = client();
  const { data: authData, error: authError } = await getSupabaseBrowserClient().auth.getUser();
  if (authError || !authData.user) throw authError || new Error("Authentication required");

  if (template.clinic_id === clinicId) {
    const { error } = await supabase.from("dm_consent_templates").update({ approval_status: "approved" }).eq("id", template.id).eq("clinic_id", clinicId);
    if (error) throw error;
    return;
  }

  const { data: existing, error: existingError } = await supabase.from("dm_consent_templates").select("id").eq("clinic_id", clinicId).eq("source_template_id", template.id).maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabase.from("dm_consent_templates").update({ approval_status: "approved", active: true }).eq("id", existing.id).eq("clinic_id", clinicId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("dm_consent_templates").insert({
    clinic_id: clinicId,
    source_template_id: template.id,
    procedure_key: template.procedure_key,
    display_title: template.display_title,
    consent_text: template.consent_text,
    locale: template.locale,
    version: 1,
    approval_status: "approved",
    active: true,
    created_by: authData.user.id,
  });
  if (error) throw error;
}

export async function saveSignedConsent(input: SignedConsentInput): Promise<{ record: ConsentRecord; pdf: Uint8Array; emailError?: string }> {
  const id = crypto.randomUUID();
  const consentNumber = `DC-${new Date().getFullYear()}-${id.slice(0, 8).toUpperCase()}`;
  const signedAt = new Date();
  const pdf = buildConsentPdf(input, consentNumber, signedAt);

  if (consentDemoMode()) {
    return {
      record: {
        id,
        clinic_id: input.clinicId,
        consent_number: consentNumber,
        template_version: input.template.version,
        patient_name_snapshot: input.patientName,
        patient_mobile_snapshot: input.patientMobile || null,
        patient_dob_snapshot: input.patientDob || null,
        doctor_name_snapshot: input.doctor.doctor_name,
        doctor_registration_snapshot: input.doctor.registration_number,
        doctor_email_snapshot: input.doctor.email,
        procedure_key: input.template.procedure_key,
        procedure_name_snapshot: input.template.display_title,
        tooth_numbers: input.toothNumbers || null,
        procedure_notes: input.procedureNotes || null,
        consent_title_snapshot: input.template.display_title,
        consent_text_snapshot: input.template.consent_text,
        locale: input.template.locale,
        acknowledgements: input.acknowledgements,
        signer_type: input.signerType,
        signer_name: input.signerName,
        signer_relationship: input.signerType === "guardian" ? input.signerRelationship : null,
        status: "signed",
        signed_at: signedAt.toISOString(),
        email_status: "pending",
        pdf_storage_path: null,
        created_at: signedAt.toISOString(),
      },
      pdf,
    };
  }

  const supabase = client();
  const storagePath = `${input.clinicId}/${id}/signed-consent.pdf`;
  const upload = await getSupabaseBrowserClient().storage.from("dm-consent-documents").upload(
    storagePath,
    new Blob([pdf as BlobPart], { type: "application/pdf" }),
    { contentType: "application/pdf", upsert: false },
  );
  if (upload.error) throw upload.error;

  const { data, error } = await supabase.from("dm_consents").insert({
    id,
    clinic_id: input.clinicId,
    consent_number: consentNumber,
    template_id: input.template.id,
    template_version: input.template.version,
    patient_name_snapshot: input.patientName.trim(),
    patient_mobile_snapshot: input.patientMobile.trim() || null,
    patient_dob_snapshot: input.patientDob || null,
    doctor_setting_id: input.doctor.id,
    doctor_name_snapshot: input.doctor.doctor_name,
    doctor_registration_snapshot: input.doctor.registration_number,
    doctor_email_snapshot: input.doctor.email,
    procedure_key: input.template.procedure_key,
    procedure_name_snapshot: input.template.display_title,
    tooth_numbers: input.toothNumbers.trim() || null,
    procedure_notes: input.procedureNotes.trim() || null,
    consent_title_snapshot: input.template.display_title,
    consent_text_snapshot: input.template.consent_text,
    locale: input.template.locale,
    acknowledgements: input.acknowledgements,
    signer_type: input.signerType,
    signer_name: input.signerName.trim(),
    signer_relationship: input.signerType === "guardian" ? input.signerRelationship.trim() || null : null,
    signature_strokes: input.signature,
    status: "signed",
    signed_at: signedAt.toISOString(),
    pdf_storage_path: storagePath,
    email_status: "pending",
  }).select("id,clinic_id,consent_number,template_version,patient_name_snapshot,patient_mobile_snapshot,patient_dob_snapshot,doctor_name_snapshot,doctor_registration_snapshot,doctor_email_snapshot,procedure_key,procedure_name_snapshot,tooth_numbers,procedure_notes,consent_title_snapshot,consent_text_snapshot,locale,acknowledgements,signer_type,signer_name,signer_relationship,status,signed_at,voided_at,void_reason,email_status,email_sent_at,pdf_storage_path,created_at").single();
  if (error) throw error;

  let emailError: string | undefined;
  const emailResult = await getSupabaseBrowserClient().functions.invoke("consent-email", { body: { consentId: id } });
  if (emailResult.error) emailError = emailResult.error.message;

  const record = data as ConsentRecord;
  if (emailError) record.email_status = "failed";
  else {
    record.email_status = "sent";
    record.email_sent_at = new Date().toISOString();
  }
  return { record, pdf, emailError };
}

export async function resendConsentEmail(consentId: string) {
  if (consentDemoMode()) return { ok: true };
  const result = await getSupabaseBrowserClient().functions.invoke("consent-email", { body: { consentId } });
  if (result.error) throw result.error;
  return result.data as { ok: boolean; providerMessageId?: string | null };
}

export async function downloadStoredConsent(record: ConsentRecord) {
  if (!record.pdf_storage_path) throw new Error("Stored PDF is not available for this record.");
  const { data, error } = await getSupabaseBrowserClient().storage.from("dm-consent-documents").download(record.pdf_storage_path);
  if (error || !data) throw error || new Error("Could not download the PDF.");
  return new Uint8Array(await data.arrayBuffer());
}

export async function voidSignedConsent(record: ConsentRecord, reason: string) {
  if (record.status !== "signed") throw new Error("Only signed consents can be voided.");
  if (reason.trim().length < 3) throw new Error("Enter a reason for voiding this consent.");
  if (consentDemoMode()) {
    return { ...record, status: "voided" as const, voided_at: new Date().toISOString(), void_reason: reason.trim() };
  }

  const { data, error } = await client().from("dm_consents").update({
    status: "voided",
    voided_at: new Date().toISOString(),
    void_reason: reason.trim(),
  }).eq("id", record.id).eq("clinic_id", record.clinic_id).select("id,clinic_id,consent_number,template_version,patient_name_snapshot,patient_mobile_snapshot,patient_dob_snapshot,doctor_name_snapshot,doctor_registration_snapshot,doctor_email_snapshot,procedure_key,procedure_name_snapshot,tooth_numbers,procedure_notes,consent_title_snapshot,consent_text_snapshot,locale,acknowledgements,signer_type,signer_name,signer_relationship,status,signed_at,voided_at,void_reason,email_status,email_sent_at,pdf_storage_path,created_at").single();
  if (error) throw error;
  return data as ConsentRecord;
}
