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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      wedding_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          expires_at: string
          id: string
          intended_role: Database["public"]["Enums"]["wedding_membership_role"]
          invited_email: string | null
          revoked_at: string | null
          status: Database["public"]["Enums"]["wedding_invitation_status"]
          target_person_id: string | null
          updated_at: string
          wedding_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          created_by_user_id: string
          expires_at: string
          id?: string
          intended_role: Database["public"]["Enums"]["wedding_membership_role"]
          invited_email?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["wedding_invitation_status"]
          target_person_id?: string | null
          updated_at?: string
          wedding_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string
          expires_at?: string
          id?: string
          intended_role?: Database["public"]["Enums"]["wedding_membership_role"]
          invited_email?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["wedding_invitation_status"]
          target_person_id?: string | null
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_invitations_target_person_same_wedding_fkey"
            columns: ["wedding_id", "target_person_id"]
            isOneToOne: false
            referencedRelation: "wedding_people"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "wedding_invitations_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_memberships: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["wedding_membership_role"]
          status: Database["public"]["Enums"]["wedding_membership_status"]
          updated_at: string
          user_id: string | null
          wedding_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          joined_at?: string
          role: Database["public"]["Enums"]["wedding_membership_role"]
          status?: Database["public"]["Enums"]["wedding_membership_status"]
          updated_at?: string
          user_id?: string | null
          wedding_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["wedding_membership_role"]
          status?: Database["public"]["Enums"]["wedding_membership_status"]
          updated_at?: string
          user_id?: string | null
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_memberships_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_partners: {
        Row: {
          created_at: string
          joined_workspace_at: string | null
          partner_order: number
          person_id: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          joined_workspace_at?: string | null
          partner_order: number
          person_id: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          joined_workspace_at?: string | null
          partner_order?: number
          person_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_partners_person_same_wedding_fkey"
            columns: ["wedding_id", "person_id"]
            isOneToOne: true
            referencedRelation: "wedding_people"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      wedding_people: {
        Row: {
          created_at: string
          display_name: string
          first_name: string | null
          id: string
          last_name: string | null
          linked_user_id: string | null
          updated_at: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          linked_user_id?: string | null
          updated_at?: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          linked_user_id?: string | null
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_people_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      weddings: {
        Row: {
          ceremony_style: Database["public"]["Enums"]["ceremony_style"]
          created_at: string
          created_by_user_id: string | null
          display_name: string | null
          estimated_guest_count: number | null
          general_location: string | null
          id: string
          origin: Database["public"]["Enums"]["wedding_origin"]
          ownership_mode: Database["public"]["Enums"]["wedding_ownership_mode"]
          status: Database["public"]["Enums"]["wedding_status"]
          timezone: string | null
          updated_at: string
          wedding_date: string | null
        }
        Insert: {
          ceremony_style?: Database["public"]["Enums"]["ceremony_style"]
          created_at?: string
          created_by_user_id?: string | null
          display_name?: string | null
          estimated_guest_count?: number | null
          general_location?: string | null
          id?: string
          origin: Database["public"]["Enums"]["wedding_origin"]
          ownership_mode: Database["public"]["Enums"]["wedding_ownership_mode"]
          status?: Database["public"]["Enums"]["wedding_status"]
          timezone?: string | null
          updated_at?: string
          wedding_date?: string | null
        }
        Update: {
          ceremony_style?: Database["public"]["Enums"]["ceremony_style"]
          created_at?: string
          created_by_user_id?: string | null
          display_name?: string | null
          estimated_guest_count?: number | null
          general_location?: string | null
          id?: string
          origin?: Database["public"]["Enums"]["wedding_origin"]
          ownership_mode?: Database["public"]["Enums"]["wedding_ownership_mode"]
          status?: Database["public"]["Enums"]["wedding_status"]
          timezone?: string | null
          updated_at?: string
          wedding_date?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_wedding_invitation: {
        Args: { p_raw_token: string }
        Returns: {
          already_accepted: boolean
          invitation_id: string
          membership_id: string
          ownership_transitioned: boolean
          person_id: string
          wedding_id: string
        }[]
      }
      create_coordinator_managed_wedding: {
        Args: {
          p_ceremony_style?: Database["public"]["Enums"]["ceremony_style"]
          p_estimated_guest_count?: number
          p_general_location?: string
          p_partner_1_display_name: string
          p_partner_2_display_name: string
          p_timezone?: string
          p_wedding_date?: string
          p_wedding_display_name: string
        }
        Returns: {
          partner_1_person_id: string
          partner_2_person_id: string
          wedding_id: string
        }[]
      }
      create_couple_wedding: {
        Args: {
          p_ceremony_style?: Database["public"]["Enums"]["ceremony_style"]
          p_current_partner_display_name: string
          p_estimated_guest_count?: number
          p_general_location?: string
          p_second_partner_display_name?: string
          p_timezone?: string
          p_wedding_date?: string
          p_wedding_display_name: string
        }
        Returns: {
          current_person_id: string
          membership_id: string
          second_partner_person_id: string
          wedding_id: string
        }[]
      }
      issue_partner_owner_invitation: {
        Args: {
          p_invited_email?: string
          p_target_person_id: string
          p_wedding_id: string
        }
        Returns: {
          invitation_expires_at: string
          invitation_id: string
          raw_token: string
        }[]
      }
      leave_wedding: {
        Args: { p_wedding_id: string }
        Returns: {
          ended_at: string
          membership_id: string
          membership_status: Database["public"]["Enums"]["wedding_membership_status"]
          wedding_id: string
        }[]
      }
      promote_wedding_member_to_owner: {
        Args: { p_target_membership_id: string; p_wedding_id: string }
        Returns: {
          membership_id: string
          membership_role: Database["public"]["Enums"]["wedding_membership_role"]
          wedding_id: string
        }[]
      }
      remove_wedding_member: {
        Args: { p_target_membership_id: string; p_wedding_id: string }
        Returns: {
          ended_at: string
          membership_id: string
          membership_status: Database["public"]["Enums"]["wedding_membership_status"]
          wedding_id: string
        }[]
      }
      revoke_wedding_invitation: {
        Args: { p_invitation_id: string }
        Returns: {
          invitation_id: string
          invitation_status: Database["public"]["Enums"]["wedding_invitation_status"]
          wedding_id: string
        }[]
      }
    }
    Enums: {
      ceremony_style:
        | "RELIGIOUS"
        | "CIVIL"
        | "SYMBOLIC"
        | "SECULAR"
        | "DESTINATION"
        | "OTHER"
        | "UNDECIDED"
      wedding_invitation_status: "PENDING" | "ACCEPTED" | "REVOKED"
      wedding_membership_role:
        | "OWNER"
        | "FULL_COORDINATOR"
        | "DAY_OF_COORDINATOR"
        | "GUEST_COORDINATOR"
      wedding_membership_status: "ACTIVE" | "LEFT" | "REMOVED"
      wedding_origin: "COUPLE_CREATED" | "COORDINATOR_CREATED"
      wedding_ownership_mode: "COORDINATOR_MANAGED" | "COUPLE_OWNED"
      wedding_status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ceremony_style: [
        "RELIGIOUS",
        "CIVIL",
        "SYMBOLIC",
        "SECULAR",
        "DESTINATION",
        "OTHER",
        "UNDECIDED",
      ],
      wedding_invitation_status: ["PENDING", "ACCEPTED", "REVOKED"],
      wedding_membership_role: [
        "OWNER",
        "FULL_COORDINATOR",
        "DAY_OF_COORDINATOR",
        "GUEST_COORDINATOR",
      ],
      wedding_membership_status: ["ACTIVE", "LEFT", "REMOVED"],
      wedding_origin: ["COUPLE_CREATED", "COORDINATOR_CREATED"],
      wedding_ownership_mode: ["COORDINATOR_MANAGED", "COUPLE_OWNED"],
      wedding_status: ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"],
    },
  },
} as const
