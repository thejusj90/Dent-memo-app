export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      clinics: Table<{ id:string; name:string; city:string|null; owner_user_id:string; created_at:string }>;
      clinic_members: Table<{ clinic_id:string; user_id:string; role:"owner"|"dentist"|"consultant"|"assistant"; full_name:string; registration_number:string|null; active:boolean; created_at:string }>;
      patients: Table<{ id:string; clinic_id:string; patient_number:string; full_name:string; phone:string; date_of_birth:string|null; gender:string|null; allergies:string|null; archived_at:string|null; created_at:string; updated_at:string }>;
      appointments: Table<{ id:string; clinic_id:string; patient_id:string|null; practitioner_user_id:string|null; starts_at:string; ends_at:string; status:"scheduled"|"confirmed"|"arrived"|"in_progress"|"completed"|"cancelled"|"no_show"; reason:string|null; google_event_id:string|null; reminder_status:string|null; created_at:string; updated_at:string }>;
      treatment_plans: Table<{ id:string; clinic_id:string; patient_id:string; tooth_number:string|null; treatment_name:string; diagnosis:string|null; status:"planned"|"in_progress"|"completed"|"cancelled"; quoted_amount:number; created_at:string; updated_at:string }>;
      visits: Table<{ id:string; clinic_id:string; patient_id:string; appointment_id:string|null; practitioner_user_id:string; occurred_at:string; clinical_note:string; follow_up_on:string|null; created_at:string; updated_at:string }>;
      visit_treatments: Table<{ id:string; visit_id:string; treatment_plan_id:string|null; tooth_number:string|null; treatment_name:string; status:string; fee:number; created_at:string }>;
      payments: Table<{ id:string; clinic_id:string; patient_id:string; visit_id:string|null; amount:number; method:"cash"|"upi"|"card"|"bank_transfer"|"other"; received_at:string; recorded_by:string; note:string|null; created_at:string }>;
      reminders: Table<{ id:string; clinic_id:string; appointment_id:string; channel:"whatsapp"; scheduled_for:string; status:"pending"|"sent"|"failed"|"cancelled"; provider_message_id:string|null; error_message:string|null; created_at:string; updated_at:string }>;
      audit_log: Table<{ id:string; clinic_id:string; actor_user_id:string|null; action:string; entity_type:string; entity_id:string|null; metadata:Json; created_at:string }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

