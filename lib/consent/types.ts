export type ConsentStatus = "draft" | "ready_for_signature" | "signed" | "voided";
export type ClinicRole = "owner" | "dentist" | "consultant" | "assistant";

export type SignaturePoint = { x: number; y: number };
export type SignatureStroke = { points: SignaturePoint[] };

export type DoctorSetting = {
  id: string;
  clinic_id: string;
  doctor_name: string;
  registration_number: string | null;
  email: string;
  active: boolean;
};

export type ConsentTemplate = {
  id: string;
  clinic_id: string | null;
  source_template_id?: string | null;
  procedure_key: string;
  display_title: string;
  consent_text: string;
  locale: string;
  version: number;
  approval_status: "needs_review" | "approved";
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ConsentRecord = {
  id: string;
  clinic_id: string;
  consent_number: string;
  template_version?: number;
  patient_name_snapshot: string;
  patient_mobile_snapshot: string | null;
  patient_dob_snapshot?: string | null;
  doctor_name_snapshot: string;
  doctor_registration_snapshot?: string | null;
  doctor_email_snapshot?: string | null;
  procedure_key?: string;
  procedure_name_snapshot: string;
  tooth_numbers: string | null;
  procedure_notes?: string | null;
  consent_title_snapshot?: string;
  consent_text_snapshot?: string;
  locale?: string;
  acknowledgements?: string[];
  signer_type?: "patient" | "guardian";
  signer_name?: string;
  signer_relationship?: string | null;
  status: ConsentStatus;
  signed_at: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  email_status: "pending" | "sent" | "failed";
  email_sent_at?: string | null;
  pdf_storage_path: string | null;
  created_at: string;
};

export type AuditEvent = {
  id: string;
  clinic_id: string;
  consent_id: string | null;
  event_type: string;
  actor_user_id: string | null;
  actor_display_name: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ClinicMember = {
  user_id: string;
  role: ClinicRole;
  display_name: string;
  active: boolean;
};

export type ClinicContext = {
  clinicId: string;
  clinicName: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  clinicEmail: string | null;
  logoPath: string | null;
  logoUrl: string | null;
  role: ClinicRole;
  displayName: string;
  entitlement: "active";
  doctors: DoctorSetting[];
  templates: ConsentTemplate[];
  records: ConsentRecord[];
  audit: AuditEvent[];
  members: ClinicMember[];
};

export type SignedConsentInput = {
  clinicId: string;
  clinicName: string;
  patientName: string;
  patientMobile: string;
  patientDob: string;
  doctor: DoctorSetting;
  template: ConsentTemplate;
  procedureNotes: string;
  toothNumbers: string;
  acknowledgements: string[];
  signerType: "patient" | "guardian";
  signerName: string;
  signerRelationship: string;
  signature: SignatureStroke[];
};
