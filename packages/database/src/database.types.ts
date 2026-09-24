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
      [_ in never]: never
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
