export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          changed_by: string | null
          changed_fields: Json | null
          clinic_id: string
          created_at: string
          id: number
          record_id: string
          record_label: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_fields?: Json | null
          clinic_id: string
          created_at?: string
          id?: never
          record_id: string
          record_label?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_fields?: Json | null
          clinic_id?: string
          created_at?: string
          id?: never
          record_id?: string
          record_label?: string | null
          table_name?: string
        }
        Relationships: []
      }
      clinic_invites: {
        Row: {
          claimed_at: string | null
          clinic_id: string
          created_at: string
          email: string
          role: string
        }
        Insert: {
          claimed_at?: string | null
          clinic_id: string
          created_at?: string
          email: string
          role?: string
        }
        Update: {
          claimed_at?: string | null
          clinic_id?: string
          created_at?: string
          email?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_invites_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_members: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          display_name: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          display_name?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          display_name?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          secondary_color: string | null
          slug: string
          staff_pin: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          staff_pin?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          staff_pin?: string | null
        }
        Relationships: []
      }
      dm_appointments: {
        Row: {
          clinic_id: string
          created_at: string
          ends_at: string
          google_event_id: string | null
          id: string
          patient_id: string | null
          practitioner_user_id: string | null
          reason: string | null
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          ends_at: string
          google_event_id?: string | null
          id?: string
          patient_id?: string | null
          practitioner_user_id?: string | null
          reason?: string | null
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          ends_at?: string
          google_event_id?: string | null
          id?: string
          patient_id?: string | null
          practitioner_user_id?: string | null
          reason?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "dm_clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "dm_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          clinic_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          clinic_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          clinic_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dm_audit_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "dm_clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_clinic_members: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          display_name: string
          registration_number: string | null
          role: string
          user_id: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          display_name: string
          registration_number?: string | null
          role: string
          user_id: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          display_name?: string
          registration_number?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_clinic_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "dm_clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_clinics: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          owner_user_id: string
          registration_number: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          registration_number?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          registration_number?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      dm_patients: {
        Row: {
          allergies: string | null
          archived_at: string | null
          clinic_id: string
          created_at: string
          date_of_birth: string | null
          full_name: string
          gender: string | null
          id: string
          patient_number: string
          phone: string
          updated_at: string
        }
        Insert: {
          allergies?: string | null
          archived_at?: string | null
          clinic_id: string
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          gender?: string | null
          id?: string
          patient_number: string
          phone: string
          updated_at?: string
        }
        Update: {
          allergies?: string | null
          archived_at?: string | null
          clinic_id?: string
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          patient_number?: string
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "dm_clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_payments: {
        Row: {
          amount: number
          clinic_id: string
          created_at: string
          id: string
          method: string
          note: string | null
          patient_id: string
          received_at: string
          recorded_by: string
          visit_id: string | null
        }
        Insert: {
          amount: number
          clinic_id: string
          created_at?: string
          id?: string
          method: string
          note?: string | null
          patient_id: string
          received_at?: string
          recorded_by: string
          visit_id?: string | null
        }
        Update: {
          amount?: number
          clinic_id?: string
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          patient_id?: string
          received_at?: string
          recorded_by?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dm_payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "dm_clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "dm_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_payments_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "dm_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_reminders: {
        Row: {
          appointment_id: string
          channel: string
          clinic_id: string
          created_at: string
          error_message: string | null
          id: string
          provider_message_id: string | null
          scheduled_for: string
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          channel?: string
          clinic_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          provider_message_id?: string | null
          scheduled_for: string
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          channel?: string
          clinic_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          provider_message_id?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "dm_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_reminders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "dm_clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_treatment_plans: {
        Row: {
          clinic_id: string
          created_at: string
          diagnosis: string | null
          id: string
          patient_id: string
          quoted_amount: number
          status: string
          tooth_number: string | null
          treatment_name: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          diagnosis?: string | null
          id?: string
          patient_id: string
          quoted_amount?: number
          status?: string
          tooth_number?: string | null
          treatment_name: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          diagnosis?: string | null
          id?: string
          patient_id?: string
          quoted_amount?: number
          status?: string
          tooth_number?: string | null
          treatment_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_treatment_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "dm_clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "dm_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_visit_treatments: {
        Row: {
          created_at: string
          fee: number
          id: string
          status: string
          tooth_number: string | null
          treatment_name: string
          treatment_plan_id: string | null
          visit_id: string
        }
        Insert: {
          created_at?: string
          fee?: number
          id?: string
          status: string
          tooth_number?: string | null
          treatment_name: string
          treatment_plan_id?: string | null
          visit_id: string
        }
        Update: {
          created_at?: string
          fee?: number
          id?: string
          status?: string
          tooth_number?: string | null
          treatment_name?: string
          treatment_plan_id?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_visit_treatments_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "dm_treatment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_visit_treatments_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "dm_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_visits: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          clinical_note: string
          created_at: string
          follow_up_on: string | null
          id: string
          occurred_at: string
          patient_id: string
          practitioner_user_id: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          clinical_note: string
          created_at?: string
          follow_up_on?: string | null
          id?: string
          occurred_at?: string
          patient_id: string
          practitioner_user_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          clinical_note?: string
          created_at?: string
          follow_up_on?: string | null
          id?: string
          occurred_at?: string
          patient_id?: string
          practitioner_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_visits_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "dm_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_visits_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "dm_clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "dm_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          age: string | null
          clinic_id: string
          created_at: string | null
          gender: string | null
          id: number
          name: string
          phone: string | null
          pid: string
        }
        Insert: {
          age?: string | null
          clinic_id: string
          created_at?: string | null
          gender?: string | null
          id?: never
          name: string
          phone?: string | null
          pid: string
        }
        Update: {
          age?: string | null
          clinic_id?: string
          created_at?: string | null
          gender?: string | null
          id?: never
          name?: string
          phone?: string | null
          pid?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          age: string | null
          clinic_id: string
          clinic_share: number | null
          cons_fee: number | null
          consultant: string | null
          created_at: string | null
          diagnosis: string | null
          gender: string | null
          id: number
          lab_cost: number | null
          patient_name: string
          phone: string | null
          remarks: string | null
          treatment: string | null
          visit_date: string | null
        }
        Insert: {
          age?: string | null
          clinic_id: string
          clinic_share?: number | null
          cons_fee?: number | null
          consultant?: string | null
          created_at?: string | null
          diagnosis?: string | null
          gender?: string | null
          id?: never
          lab_cost?: number | null
          patient_name: string
          phone?: string | null
          remarks?: string | null
          treatment?: string | null
          visit_date?: string | null
        }
        Update: {
          age?: string | null
          clinic_id?: string
          clinic_share?: number | null
          cons_fee?: number | null
          consultant?: string | null
          created_at?: string | null
          diagnosis?: string | null
          gender?: string | null
          id?: never
          lab_cost?: number | null
          patient_name?: string
          phone?: string | null
          remarks?: string | null
          treatment?: string | null
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      visits_safe: {
        Row: {
          age: string | null
          clinic_id: string | null
          clinic_share: number | null
          cons_fee: number | null
          consultant: string | null
          created_at: string | null
          diagnosis: string | null
          gender: string | null
          id: number | null
          lab_cost: number | null
          patient_name: string | null
          phone: string | null
          remarks: string | null
          treatment: string | null
          visit_date: string | null
        }
        Insert: {
          age?: string | null
          clinic_id?: string | null
          clinic_share?: never
          cons_fee?: never
          consultant?: string | null
          created_at?: string | null
          diagnosis?: string | null
          gender?: string | null
          id?: number | null
          lab_cost?: never
          patient_name?: string | null
          phone?: string | null
          remarks?: string | null
          treatment?: string | null
          visit_date?: string | null
        }
        Update: {
          age?: string | null
          clinic_id?: string | null
          clinic_share?: never
          cons_fee?: never
          consultant?: string | null
          created_at?: string | null
          diagnosis?: string | null
          gender?: string | null
          id?: number | null
          lab_cost?: never
          patient_name?: string | null
          phone?: string | null
          remarks?: string | null
          treatment?: string | null
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_clinic_with_owner: {
        Args: {
          p_clinic_name: string
          p_doctor_name: string
          p_logo_url: string
          p_staff_pin: string
          p_treatments: string[]
        }
        Returns: string
      }
      get_staff_pin: { Args: never; Returns: string }
      hook_restrict_signup_to_invites: { Args: { event: Json }; Returns: Json }
      join_clinic_with_pin: {
        Args: { p_display_name?: string; p_pin: string }
        Returns: {
          clinic_id: string
          clinic_name: string
        }[]
      }
      my_clinic_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

