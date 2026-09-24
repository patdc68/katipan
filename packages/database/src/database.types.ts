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
      attachments: {
        Row: {
          available_at: string | null
          bucket_id: string
          checksum_sha256: string | null
          content_type: string
          created_at: string
          deleted_at: string | null
          id: string
          object_path: string
          original_filename: string
          size_bytes: number | null
          status: Database["public"]["Enums"]["attachment_status"]
          updated_at: string
          uploaded_by_user_id: string | null
          visibility: Database["public"]["Enums"]["attachment_visibility"]
          wedding_id: string
        }
        Insert: {
          available_at?: string | null
          bucket_id?: string
          checksum_sha256?: string | null
          content_type: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          object_path: string
          original_filename: string
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["attachment_status"]
          updated_at?: string
          uploaded_by_user_id?: string | null
          visibility: Database["public"]["Enums"]["attachment_visibility"]
          wedding_id: string
        }
        Update: {
          available_at?: string | null
          bucket_id?: string
          checksum_sha256?: string | null
          content_type?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          object_path?: string
          original_filename?: string
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["attachment_status"]
          updated_at?: string
          uploaded_by_user_id?: string | null
          visibility?: Database["public"]["Enums"]["attachment_visibility"]
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      entourage_assignments: {
        Row: {
          created_at: string
          guest_id: string
          id: string
          role_id: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          guest_id: string
          id?: string
          role_id: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          guest_id?: string
          id?: string
          role_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entourage_assignments_guest_same_wedding_fkey"
            columns: ["wedding_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "entourage_assignments_role_same_wedding_fkey"
            columns: ["wedding_id", "role_id"]
            isOneToOne: false
            referencedRelation: "entourage_roles"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      entourage_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          preset_key: string | null
          sort_order: number
          updated_at: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          preset_key?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          preset_key?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entourage_roles_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_allowance_claims: {
        Row: {
          allowance_id: string
          claimed_at: string
          guest_id: string
          wedding_id: string
        }
        Insert: {
          allowance_id: string
          claimed_at?: string
          guest_id: string
          wedding_id: string
        }
        Update: {
          allowance_id?: string
          claimed_at?: string
          guest_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_allowance_claims_allowance_same_wedding_fkey"
            columns: ["wedding_id", "allowance_id"]
            isOneToOne: false
            referencedRelation: "guest_allowances"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "guest_allowance_claims_guest_same_wedding_fkey"
            columns: ["wedding_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      guest_allowances: {
        Row: {
          allowance_type: Database["public"]["Enums"]["guest_allowance_type"]
          created_at: string
          household_id: string
          id: string
          max_count: number
          sponsor_guest_id: string | null
          updated_at: string
          wedding_id: string
        }
        Insert: {
          allowance_type: Database["public"]["Enums"]["guest_allowance_type"]
          created_at?: string
          household_id: string
          id?: string
          max_count: number
          sponsor_guest_id?: string | null
          updated_at?: string
          wedding_id: string
        }
        Update: {
          allowance_type?: Database["public"]["Enums"]["guest_allowance_type"]
          created_at?: string
          household_id?: string
          id?: string
          max_count?: number
          sponsor_guest_id?: string | null
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_allowances_household_same_wedding_fkey"
            columns: ["wedding_id", "household_id"]
            isOneToOne: false
            referencedRelation: "guest_household_rsvp_progress"
            referencedColumns: ["wedding_id", "household_id"]
          },
          {
            foreignKeyName: "guest_allowances_household_same_wedding_fkey"
            columns: ["wedding_id", "household_id"]
            isOneToOne: false
            referencedRelation: "guest_households"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "guest_allowances_sponsor_same_wedding_fkey"
            columns: ["wedding_id", "sponsor_guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "guest_allowances_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_group_memberships: {
        Row: {
          created_at: string
          guest_group_id: string
          guest_id: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          guest_group_id: string
          guest_id: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          guest_group_id?: string
          guest_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_group_memberships_group_same_wedding_fkey"
            columns: ["wedding_id", "guest_group_id"]
            isOneToOne: false
            referencedRelation: "guest_groups"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "guest_group_memberships_guest_same_wedding_fkey"
            columns: ["wedding_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      guest_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_groups_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_households: {
        Row: {
          created_at: string
          delivery_status: Database["public"]["Enums"]["household_invitation_delivery_status"]
          display_name: string
          id: string
          notes: string | null
          sent_at: string | null
          updated_at: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["household_invitation_delivery_status"]
          display_name: string
          id?: string
          notes?: string | null
          sent_at?: string | null
          updated_at?: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["household_invitation_delivery_status"]
          display_name?: string
          id?: string
          notes?: string | null
          sent_at?: string | null
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_households_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_rsvps: {
        Row: {
          created_at: string
          dietary_notes: string | null
          guest_id: string
          meal_choice: string | null
          responded_at: string | null
          response_notes: string | null
          status: Database["public"]["Enums"]["guest_rsvp_status"]
          updated_at: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          dietary_notes?: string | null
          guest_id: string
          meal_choice?: string | null
          responded_at?: string | null
          response_notes?: string | null
          status?: Database["public"]["Enums"]["guest_rsvp_status"]
          updated_at?: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          dietary_notes?: string | null
          guest_id?: string
          meal_choice?: string | null
          responded_at?: string | null
          response_notes?: string | null
          status?: Database["public"]["Enums"]["guest_rsvp_status"]
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_rsvps_guest_same_wedding_fkey"
            columns: ["wedding_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      guests: {
        Row: {
          accessibility_assistance_note: string | null
          created_at: string
          household_id: string
          id: string
          internal_notes: string | null
          person_id: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          accessibility_assistance_note?: string | null
          created_at?: string
          household_id: string
          id?: string
          internal_notes?: string | null
          person_id: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          accessibility_assistance_note?: string | null
          created_at?: string
          household_id?: string
          id?: string
          internal_notes?: string | null
          person_id?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_household_same_wedding_fkey"
            columns: ["wedding_id", "household_id"]
            isOneToOne: false
            referencedRelation: "guest_household_rsvp_progress"
            referencedColumns: ["wedding_id", "household_id"]
          },
          {
            foreignKeyName: "guests_household_same_wedding_fkey"
            columns: ["wedding_id", "household_id"]
            isOneToOne: false
            referencedRelation: "guest_households"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "guests_person_same_wedding_fkey"
            columns: ["wedding_id", "person_id"]
            isOneToOne: true
            referencedRelation: "wedding_people"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "guests_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
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
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          linked_user_id: string | null
          phone: string | null
          updated_at: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          linked_user_id?: string | null
          phone?: string | null
          updated_at?: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          linked_user_id?: string | null
          phone?: string | null
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
      guest_household_rsvp_progress: {
        Row: {
          attending_guests: number | null
          declined_guests: number | null
          household_id: string | null
          progress:
            | Database["public"]["Enums"]["household_rsvp_progress"]
            | null
          responded_guests: number | null
          total_guests: number | null
          wedding_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_households_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
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
      add_existing_person_as_guest: {
        Args: {
          p_household_id: string
          p_person_id: string
          p_wedding_id: string
        }
        Returns: string
      }
      claim_guest_allowance: {
        Args: { p_allowance_id: string; p_guest_id: string }
        Returns: {
          allowance_id: string
          claimed_at: string
          guest_id: string
          wedding_id: string
        }[]
      }
      confirm_attachment_uploaded: {
        Args: {
          p_attachment_id: string
          p_checksum_sha256?: string
          p_size_bytes: number
        }
        Returns: {
          attachment_id: string
          attachment_status: Database["public"]["Enums"]["attachment_status"]
          available_at: string
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
      create_guest: {
        Args: {
          p_accessibility_assistance_note?: string
          p_display_name: string
          p_email?: string
          p_first_name?: string
          p_household_id: string
          p_internal_notes?: string
          p_last_name?: string
          p_phone?: string
          p_wedding_id: string
        }
        Returns: {
          guest_id: string
          person_id: string
        }[]
      }
      create_guest_household: {
        Args: { p_display_name: string; p_notes?: string; p_wedding_id: string }
        Returns: string
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
      mark_attachment_deleted: {
        Args: { p_attachment_id: string }
        Returns: {
          attachment_id: string
          attachment_status: Database["public"]["Enums"]["attachment_status"]
          deleted_at: string
        }[]
      }
      mark_household_invitation_sent: {
        Args: { p_household_id: string }
        Returns: string
      }
      promote_wedding_member_to_owner: {
        Args: { p_target_membership_id: string; p_wedding_id: string }
        Returns: {
          membership_id: string
          membership_role: Database["public"]["Enums"]["wedding_membership_role"]
          wedding_id: string
        }[]
      }
      release_guest_allowance_claim: {
        Args: { p_allowance_id: string; p_guest_id: string }
        Returns: undefined
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
      reserve_attachment: {
        Args: {
          p_content_type: string
          p_original_filename: string
          p_visibility: Database["public"]["Enums"]["attachment_visibility"]
          p_wedding_id: string
        }
        Returns: {
          attachment_id: string
          bucket_id: string
          object_path: string
        }[]
      }
      reset_household_invitation_delivery: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      revoke_wedding_invitation: {
        Args: { p_invitation_id: string }
        Returns: {
          invitation_id: string
          invitation_status: Database["public"]["Enums"]["wedding_invitation_status"]
          wedding_id: string
        }[]
      }
      set_guest_rsvp: {
        Args: {
          p_dietary_notes?: string
          p_guest_id: string
          p_meal_choice?: string
          p_response_notes?: string
          p_status: Database["public"]["Enums"]["guest_rsvp_status"]
        }
        Returns: {
          guest_id: string
          responded_at: string
          status: Database["public"]["Enums"]["guest_rsvp_status"]
          wedding_id: string
        }[]
      }
      update_guest_person: {
        Args: {
          p_display_name: string
          p_email?: string
          p_first_name?: string
          p_guest_id: string
          p_last_name?: string
          p_phone?: string
          p_wedding_id: string
        }
        Returns: string
      }
    }
    Enums: {
      attachment_status: "PENDING_UPLOAD" | "AVAILABLE" | "DELETED"
      attachment_visibility:
        | "PUBLIC"
        | "GUEST_VISIBLE"
        | "WEDDING_MEMBER_PRIVATE"
        | "OWNER_PRIVATE"
        | "FINANCIAL_PRIVATE"
      ceremony_style:
        | "RELIGIOUS"
        | "CIVIL"
        | "SYMBOLIC"
        | "SECULAR"
        | "DESTINATION"
        | "OTHER"
        | "UNDECIDED"
      guest_allowance_type: "PLUS_ONE" | "CHILD"
      guest_rsvp_status: "NO_RESPONSE" | "ATTENDING" | "DECLINED"
      household_invitation_delivery_status: "NOT_SENT" | "SENT"
      household_rsvp_progress:
        | "NO_RESPONSE"
        | "PARTIALLY_RESPONDED"
        | "RESPONDED"
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
      attachment_status: ["PENDING_UPLOAD", "AVAILABLE", "DELETED"],
      attachment_visibility: [
        "PUBLIC",
        "GUEST_VISIBLE",
        "WEDDING_MEMBER_PRIVATE",
        "OWNER_PRIVATE",
        "FINANCIAL_PRIVATE",
      ],
      ceremony_style: [
        "RELIGIOUS",
        "CIVIL",
        "SYMBOLIC",
        "SECULAR",
        "DESTINATION",
        "OTHER",
        "UNDECIDED",
      ],
      guest_allowance_type: ["PLUS_ONE", "CHILD"],
      guest_rsvp_status: ["NO_RESPONSE", "ATTENDING", "DECLINED"],
      household_invitation_delivery_status: ["NOT_SENT", "SENT"],
      household_rsvp_progress: [
        "NO_RESPONSE",
        "PARTIALLY_RESPONDED",
        "RESPONDED",
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
