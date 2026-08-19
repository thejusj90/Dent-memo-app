export type ConsentStatus = "draft" | "ready_for_signature" | "signed" | "voided";

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

export type ClinicContext = {
  clinicId: string;
  clinicName: string;
  city: string | null;
  role: "owner" | "dentist" | "consultant" | "assistant";
  displayName: string;
  entitlement: "trial" | "active" | "past_due" | "cancelled" | "expired" | "none";
  doctors: DoctorSetting[];
  templates: ConsentTemplate[];
  records: ConsentRecord[];
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
