import { getSupabaseBrowserClient } from "./client";

export type ClinicRole = "owner" | "dentist" | "consultant" | "assistant";

export async function getCurrentMembership() {
  const supabase = getSupabaseBrowserClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("dm_clinic_members")
    .select("clinic_id,role,display_name,dm_clinics(id,name,city,timezone)")
    .eq("user_id", auth.user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createClinic(input: {
  name: string;
  city: string;
  registrationNumber?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("Sign in before creating a clinic.");

  const { data, error } = await supabase
    .from("dm_clinics")
    .insert({
      owner_user_id: auth.user.id,
      name: input.name.trim(),
      city: input.city.trim() || null,
      registration_number: input.registrationNumber?.trim() || null,
    })
    .select("id,name,city,timezone")
    .single();
  if (error) throw error;
  return data;
}

export async function listPatients(clinicId: string, search = "") {
  const supabase = getSupabaseBrowserClient();
  let query = supabase
    .from("dm_patients")
    .select("id,patient_number,full_name,phone,date_of_birth,gender,allergies,created_at")
    .eq("clinic_id", clinicId)
    .is("archived_at", null)
    .order("full_name");
  if (search.trim()) query = query.ilike("full_name", `%${search.trim()}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createPatient(input: {
  clinicId: string;
  patientNumber: string;
  fullName: string;
  phone: string;
  dateOfBirth?: string;
  gender?: string;
  allergies?: string;
}) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("dm_patients")
    .insert({
      clinic_id: input.clinicId,
      patient_number: input.patientNumber,
      full_name: input.fullName.trim(),
      phone: input.phone.trim(),
      date_of_birth: input.dateOfBirth || null,
      gender: input.gender || null,
      allergies: input.allergies?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listAppointments(clinicId: string, from: string, to: string) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("dm_appointments")
    .select("*,dm_patients(id,full_name,phone)")
    .eq("clinic_id", clinicId)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at");
  if (error) throw error;
  return data;
}

export async function createAppointment(input: {
  clinicId: string;
  patientId?: string;
  practitionerUserId?: string;
  startsAt: string;
  endsAt: string;
  reason?: string;
}) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("dm_appointments")
    .insert({
      clinic_id: input.clinicId,
      patient_id: input.patientId || null,
      practitioner_user_id: input.practitionerUserId || null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      reason: input.reason?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listFollowUps(clinicId: string, throughDate: string) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("dm_visits")
    .select("id,patient_id,follow_up_on,clinical_note,dm_patients(id,full_name,phone)")
    .eq("clinic_id", clinicId)
    .not("follow_up_on", "is", null)
    .lte("follow_up_on", throughDate)
    .order("follow_up_on");
  if (error) throw error;
  return data;
}
