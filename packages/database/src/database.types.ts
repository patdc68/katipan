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
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "attachments_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "attachments_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      attire_group_avoid_colors: {
        Row: {
          attire_group_id: string
          color_hex: string
          created_at: string
          id: string
          name: string | null
          sort_order: number
          updated_at: string
          wedding_id: string
        }
        Insert: {
          attire_group_id: string
          color_hex: string
          created_at?: string
          id?: string
          name?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id: string
        }
        Update: {
          attire_group_id?: string
          color_hex?: string
          created_at?: string
          id?: string
          name?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attire_group_avoid_colors_group_same_wedding_fkey"
            columns: ["wedding_id", "attire_group_id"]
            isOneToOne: false
            referencedRelation: "attire_groups"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      attire_group_entourage_role_targets: {
        Row: {
          attire_group_id: string
          created_at: string
          entourage_role_id: string
          wedding_id: string
        }
        Insert: {
          attire_group_id: string
          created_at?: string
          entourage_role_id: string
          wedding_id: string
        }
        Update: {
          attire_group_id?: string
          created_at?: string
          entourage_role_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attire_group_entourage_role_targets_group_same_wedding_fkey"
            columns: ["wedding_id", "attire_group_id"]
            isOneToOne: false
            referencedRelation: "attire_groups"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "attire_group_entourage_role_targets_role_same_wedding_fkey"
            columns: ["wedding_id", "entourage_role_id"]
            isOneToOne: false
            referencedRelation: "entourage_roles"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      attire_group_guest_targets: {
        Row: {
          attire_group_id: string
          created_at: string
          guest_id: string
          wedding_id: string
        }
        Insert: {
          attire_group_id: string
          created_at?: string
          guest_id: string
          wedding_id: string
        }
        Update: {
          attire_group_id?: string
          created_at?: string
          guest_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attire_group_guest_targets_group_same_wedding_fkey"
            columns: ["wedding_id", "attire_group_id"]
            isOneToOne: false
            referencedRelation: "attire_groups"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "attire_group_guest_targets_guest_same_wedding_fkey"
            columns: ["wedding_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "guest_check_in_state"
            referencedColumns: ["wedding_id", "guest_id"]
          },
          {
            foreignKeyName: "attire_group_guest_targets_guest_same_wedding_fkey"
            columns: ["wedding_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      attire_group_inspiration_attachments: {
        Row: {
          attachment_id: string
          attire_group_id: string
          created_at: string
          sort_order: number
          wedding_id: string
        }
        Insert: {
          attachment_id: string
          attire_group_id: string
          created_at?: string
          sort_order?: number
          wedding_id: string
        }
        Update: {
          attachment_id?: string
          attire_group_id?: string
          created_at?: string
          sort_order?: number
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attire_group_inspiration_attachments_attachment_same_wedding_fk"
            columns: ["wedding_id", "attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "attire_group_inspiration_attachments_group_same_wedding_fkey"
            columns: ["wedding_id", "attire_group_id"]
            isOneToOne: false
            referencedRelation: "attire_groups"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      attire_group_recommended_colors: {
        Row: {
          attire_group_id: string
          color_hex: string
          created_at: string
          id: string
          name: string | null
          sort_order: number
          updated_at: string
          wedding_id: string
        }
        Insert: {
          attire_group_id: string
          color_hex: string
          created_at?: string
          id?: string
          name?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id: string
        }
        Update: {
          attire_group_id?: string
          color_hex?: string
          created_at?: string
          id?: string
          name?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attire_group_recommended_colors_group_same_wedding_fkey"
            columns: ["wedding_id", "attire_group_id"]
            isOneToOne: false
            referencedRelation: "attire_groups"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      attire_groups: {
        Row: {
          created_at: string
          description: string | null
          dress_code_id: string
          id: string
          instructions: string | null
          sort_order: number
          title: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          dress_code_id: string
          id?: string
          instructions?: string | null
          sort_order?: number
          title: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          dress_code_id?: string
          id?: string
          instructions?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attire_groups_dress_code_same_wedding_fkey"
            columns: ["wedding_id", "dress_code_id"]
            isOneToOne: false
            referencedRelation: "wedding_dress_codes"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
          wedding_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          wedding_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "budget_categories_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "budget_categories_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          actual_amount: number | null
          category_id: string
          created_at: string
          description: string | null
          estimated_amount: number
          id: string
          legacy_supplier_actual_amount: number | null
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["budget_item_status"]
          supplier_id: string | null
          updated_at: string
          wedding_id: string
        }
        Insert: {
          actual_amount?: number | null
          category_id: string
          created_at?: string
          description?: string | null
          estimated_amount?: number
          id?: string
          legacy_supplier_actual_amount?: number | null
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["budget_item_status"]
          supplier_id?: string | null
          updated_at?: string
          wedding_id: string
        }
        Update: {
          actual_amount?: number | null
          category_id?: string
          created_at?: string
          description?: string | null
          estimated_amount?: number
          id?: string
          legacy_supplier_actual_amount?: number | null
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["budget_item_status"]
          supplier_id?: string | null
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_category_same_wedding_fkey"
            columns: ["wedding_id", "category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "budget_items_supplier_same_wedding_fkey"
            columns: ["wedding_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_finance_totals"
            referencedColumns: ["wedding_id", "supplier_id"]
          },
          {
            foreignKeyName: "budget_items_supplier_same_wedding_fkey"
            columns: ["wedding_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "budget_items_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "budget_items_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "budget_items_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      dress_code_avoid_colors: {
        Row: {
          color_hex: string
          created_at: string
          dress_code_id: string
          id: string
          name: string | null
          sort_order: number
          updated_at: string
          wedding_id: string
        }
        Insert: {
          color_hex: string
          created_at?: string
          dress_code_id: string
          id?: string
          name?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id: string
        }
        Update: {
          color_hex?: string
          created_at?: string
          dress_code_id?: string
          id?: string
          name?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dress_code_avoid_colors_code_same_wedding_fkey"
            columns: ["wedding_id", "dress_code_id"]
            isOneToOne: false
            referencedRelation: "wedding_dress_codes"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      dress_code_inspiration_attachments: {
        Row: {
          attachment_id: string
          created_at: string
          dress_code_id: string
          sort_order: number
          wedding_id: string
        }
        Insert: {
          attachment_id: string
          created_at?: string
          dress_code_id: string
          sort_order?: number
          wedding_id: string
        }
        Update: {
          attachment_id?: string
          created_at?: string
          dress_code_id?: string
          sort_order?: number
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dress_code_inspiration_attachments_attachment_same_wedding_fkey"
            columns: ["wedding_id", "attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "dress_code_inspiration_attachments_code_same_wedding_fkey"
            columns: ["wedding_id", "dress_code_id"]
            isOneToOne: false
            referencedRelation: "wedding_dress_codes"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      dress_code_recommended_colors: {
        Row: {
          color_hex: string
          created_at: string
          dress_code_id: string
          id: string
          name: string | null
          sort_order: number
          updated_at: string
          wedding_id: string
        }
        Insert: {
          color_hex: string
          created_at?: string
          dress_code_id: string
          id?: string
          name?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id: string
        }
        Update: {
          color_hex?: string
          created_at?: string
          dress_code_id?: string
          id?: string
          name?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dress_code_recommended_colors_code_same_wedding_fkey"
            columns: ["wedding_id", "dress_code_id"]
            isOneToOne: false
            referencedRelation: "wedding_dress_codes"
            referencedColumns: ["wedding_id", "id"]
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
            referencedRelation: "guest_check_in_state"
            referencedColumns: ["wedding_id", "guest_id"]
          },
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
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "entourage_roles_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
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
            referencedRelation: "guest_check_in_state"
            referencedColumns: ["wedding_id", "guest_id"]
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
            referencedRelation: "guest_check_in_state"
            referencedColumns: ["wedding_id", "guest_id"]
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
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "guest_allowances_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
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
      guest_attire_avoid_colors: {
        Row: {
          color_hex: string
          created_at: string
          guest_attire_guidance_id: string
          id: string
          name: string | null
          sort_order: number
          updated_at: string
          wedding_id: string
        }
        Insert: {
          color_hex: string
          created_at?: string
          guest_attire_guidance_id: string
          id?: string
          name?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id: string
        }
        Update: {
          color_hex?: string
          created_at?: string
          guest_attire_guidance_id?: string
          id?: string
          name?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_attire_avoid_colors_guidance_same_wedding_fkey"
            columns: ["wedding_id", "guest_attire_guidance_id"]
            isOneToOne: false
            referencedRelation: "guest_attire_guidance"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      guest_attire_guidance: {
        Row: {
          created_at: string
          guest_id: string
          id: string
          instructions: string
          notes: string | null
          title: string | null
          updated_at: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          guest_id: string
          id?: string
          instructions: string
          notes?: string | null
          title?: string | null
          updated_at?: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          guest_id?: string
          id?: string
          instructions?: string
          notes?: string | null
          title?: string | null
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_attire_guidance_guest_same_wedding_fkey"
            columns: ["wedding_id", "guest_id"]
            isOneToOne: true
            referencedRelation: "guest_check_in_state"
            referencedColumns: ["wedding_id", "guest_id"]
          },
          {
            foreignKeyName: "guest_attire_guidance_guest_same_wedding_fkey"
            columns: ["wedding_id", "guest_id"]
            isOneToOne: true
            referencedRelation: "guests"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      guest_attire_recommended_colors: {
        Row: {
          color_hex: string
          created_at: string
          guest_attire_guidance_id: string
          id: string
          name: string | null
          sort_order: number
          updated_at: string
          wedding_id: string
        }
        Insert: {
          color_hex: string
          created_at?: string
          guest_attire_guidance_id: string
          id?: string
          name?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id: string
        }
        Update: {
          color_hex?: string
          created_at?: string
          guest_attire_guidance_id?: string
          id?: string
          name?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_attire_recommended_colors_guidance_same_wedding_fkey"
            columns: ["wedding_id", "guest_attire_guidance_id"]
            isOneToOne: false
            referencedRelation: "guest_attire_guidance"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      guest_check_in_events: {
        Row: {
          client_event_id: string
          event_sequence: number
          event_type: Database["public"]["Enums"]["guest_check_in_event_type"]
          guest_id: string
          id: string
          occurred_at: string
          recorded_at: string
          recorded_by_user_id: string
          reversal_reason: string | null
          reverses_event_id: string | null
          source: Database["public"]["Enums"]["guest_check_in_source"]
          wedding_id: string
        }
        Insert: {
          client_event_id: string
          event_sequence?: never
          event_type: Database["public"]["Enums"]["guest_check_in_event_type"]
          guest_id: string
          id?: string
          occurred_at?: string
          recorded_at?: string
          recorded_by_user_id: string
          reversal_reason?: string | null
          reverses_event_id?: string | null
          source: Database["public"]["Enums"]["guest_check_in_source"]
          wedding_id: string
        }
        Update: {
          client_event_id?: string
          event_sequence?: never
          event_type?: Database["public"]["Enums"]["guest_check_in_event_type"]
          guest_id?: string
          id?: string
          occurred_at?: string
          recorded_at?: string
          recorded_by_user_id?: string
          reversal_reason?: string | null
          reverses_event_id?: string | null
          source?: Database["public"]["Enums"]["guest_check_in_source"]
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_check_in_events_guest_same_wedding_fkey"
            columns: ["wedding_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "guest_check_in_state"
            referencedColumns: ["wedding_id", "guest_id"]
          },
          {
            foreignKeyName: "guest_check_in_events_guest_same_wedding_fkey"
            columns: ["wedding_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "guest_check_in_events_reversal_same_guest_fkey"
            columns: ["wedding_id", "guest_id", "reverses_event_id"]
            isOneToOne: false
            referencedRelation: "guest_check_in_events"
            referencedColumns: ["wedding_id", "guest_id", "id"]
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
            referencedRelation: "guest_check_in_state"
            referencedColumns: ["wedding_id", "guest_id"]
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
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "guest_groups_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
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
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "guest_households_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
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
            referencedRelation: "guest_check_in_state"
            referencedColumns: ["wedding_id", "guest_id"]
          },
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
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "guests_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
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
      motif_colors: {
        Row: {
          color_hex: string
          created_at: string
          id: string
          motif_id: string
          name: string | null
          sort_order: number
          updated_at: string
          wedding_id: string
        }
        Insert: {
          color_hex: string
          created_at?: string
          id?: string
          motif_id: string
          name?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id: string
        }
        Update: {
          color_hex?: string
          created_at?: string
          id?: string
          motif_id?: string
          name?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "motif_colors_motif_same_wedding_fkey"
            columns: ["wedding_id", "motif_id"]
            isOneToOne: false
            referencedRelation: "wedding_motifs"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      motif_inspiration_attachments: {
        Row: {
          attachment_id: string
          created_at: string
          motif_id: string
          sort_order: number
          wedding_id: string
        }
        Insert: {
          attachment_id: string
          created_at?: string
          motif_id: string
          sort_order?: number
          wedding_id: string
        }
        Update: {
          attachment_id?: string
          created_at?: string
          motif_id?: string
          sort_order?: number
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "motif_inspiration_attachments_attachment_same_wedding_fkey"
            columns: ["wedding_id", "attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "motif_inspiration_attachments_motif_same_wedding_fkey"
            columns: ["wedding_id", "motif_id"]
            isOneToOne: false
            referencedRelation: "wedding_motifs"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          id: string
          idempotency_key: string
          metadata: Json
          read_at: string | null
          recipient_user_id: string
          title: string
          wedding_id: string | null
        }
        Insert: {
          body: string
          category: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          id?: string
          idempotency_key: string
          metadata?: Json
          read_at?: string | null
          recipient_user_id: string
          title: string
          wedding_id?: string | null
        }
        Update: {
          body?: string
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          read_at?: string | null
          recipient_user_id?: string
          title?: string
          wedding_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "notifications_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "notifications_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_receipt_attachments: {
        Row: {
          attachment_id: string
          created_at: string
          payment_id: string
          wedding_id: string
        }
        Insert: {
          attachment_id: string
          created_at?: string
          payment_id: string
          wedding_id: string
        }
        Update: {
          attachment_id?: string
          created_at?: string
          payment_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipt_attachments_attachment_same_wedding_fkey"
            columns: ["wedding_id", "attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "payment_receipt_attachments_payment_same_wedding_fkey"
            columns: ["wedding_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "supplier_payment_transactions"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      planning_task_assignees: {
        Row: {
          assigned_at: string
          assigned_by_user_id: string | null
          membership_id: string
          task_id: string
          wedding_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          membership_id: string
          task_id: string
          wedding_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          membership_id?: string
          task_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_task_assignees_membership_same_wedding_fkey"
            columns: ["wedding_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "wedding_memberships"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "planning_task_assignees_task_same_wedding_fkey"
            columns: ["wedding_id", "task_id"]
            isOneToOne: false
            referencedRelation: "planning_tasks"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      planning_task_dependencies: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          depends_on_task_id: string
          task_id: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          depends_on_task_id: string
          task_id: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          depends_on_task_id?: string
          task_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_task_dependencies_prerequisite_same_wedding_fkey"
            columns: ["wedding_id", "depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "planning_tasks"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "planning_task_dependencies_task_same_wedding_fkey"
            columns: ["wedding_id", "task_id"]
            isOneToOne: false
            referencedRelation: "planning_tasks"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      planning_tasks: {
        Row: {
          category_id: string | null
          completed_at: string | null
          completed_by_user_id: string | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["planning_task_priority"]
          private_notes: string | null
          sort_order: number
          start_date: string | null
          status: Database["public"]["Enums"]["planning_task_status"]
          title: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          category_id?: string | null
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["planning_task_priority"]
          private_notes?: string | null
          sort_order?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["planning_task_status"]
          title: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          category_id?: string | null
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["planning_task_priority"]
          private_notes?: string | null
          sort_order?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["planning_task_status"]
          title?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_tasks_category_same_wedding_fkey"
            columns: ["wedding_id", "category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "planning_tasks_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "planning_tasks_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "planning_tasks_wedding_id_fkey"
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
      seating_assignments: {
        Row: {
          created_at: string
          event_id: string
          guest_id: string
          id: string
          seat_id: string | null
          table_id: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          guest_id: string
          id?: string
          seat_id?: string | null
          table_id: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          guest_id?: string
          id?: string
          seat_id?: string | null
          table_id?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seating_assignments_event_fkey"
            columns: ["wedding_id", "event_id"]
            isOneToOne: false
            referencedRelation: "seating_events"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "seating_assignments_guest_fkey"
            columns: ["wedding_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "guest_check_in_state"
            referencedColumns: ["wedding_id", "guest_id"]
          },
          {
            foreignKeyName: "seating_assignments_guest_fkey"
            columns: ["wedding_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "seating_assignments_seat_fkey"
            columns: ["wedding_id", "event_id", "table_id", "seat_id"]
            isOneToOne: false
            referencedRelation: "seating_seats"
            referencedColumns: ["wedding_id", "event_id", "table_id", "id"]
          },
          {
            foreignKeyName: "seating_assignments_table_fkey"
            columns: ["wedding_id", "event_id", "table_id"]
            isOneToOne: false
            referencedRelation: "seating_tables"
            referencedColumns: ["wedding_id", "event_id", "id"]
          },
        ]
      }
      seating_events: {
        Row: {
          created_at: string
          event_kind: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          visibility: Database["public"]["Enums"]["seating_visibility"]
          wedding_id: string
        }
        Insert: {
          created_at?: string
          event_kind?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["seating_visibility"]
          wedding_id: string
        }
        Update: {
          created_at?: string
          event_kind?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["seating_visibility"]
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seating_events_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "seating_events_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "seating_events_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      seating_seats: {
        Row: {
          created_at: string
          event_id: string
          id: string
          label: string
          sort_order: number
          table_id: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          label: string
          sort_order?: number
          table_id: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          label?: string
          sort_order?: number
          table_id?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seating_seats_table_fkey"
            columns: ["wedding_id", "event_id", "table_id"]
            isOneToOne: false
            referencedRelation: "seating_tables"
            referencedColumns: ["wedding_id", "event_id", "id"]
          },
        ]
      }
      seating_tables: {
        Row: {
          capacity: number
          created_at: string
          event_id: string
          id: string
          name: string
          notes: string | null
          shape: Database["public"]["Enums"]["seating_table_shape"]
          sort_order: number
          table_number: number | null
          updated_at: string
          wedding_id: string
          zone: string | null
        }
        Insert: {
          capacity: number
          created_at?: string
          event_id: string
          id?: string
          name: string
          notes?: string | null
          shape?: Database["public"]["Enums"]["seating_table_shape"]
          sort_order?: number
          table_number?: number | null
          updated_at?: string
          wedding_id: string
          zone?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          notes?: string | null
          shape?: Database["public"]["Enums"]["seating_table_shape"]
          sort_order?: number
          table_number?: number | null
          updated_at?: string
          wedding_id?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seating_tables_event_fkey"
            columns: ["wedding_id", "event_id"]
            isOneToOne: false
            referencedRelation: "seating_events"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      supplier_contract_attachments: {
        Row: {
          attachment_id: string
          created_at: string
          supplier_id: string
          wedding_id: string
        }
        Insert: {
          attachment_id: string
          created_at?: string
          supplier_id: string
          wedding_id: string
        }
        Update: {
          attachment_id?: string
          created_at?: string
          supplier_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contract_attachments_attachment_same_wedding_fkey"
            columns: ["wedding_id", "attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "supplier_contract_attachments_supplier_same_wedding_fkey"
            columns: ["wedding_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_finance_totals"
            referencedColumns: ["wedding_id", "supplier_id"]
          },
          {
            foreignKeyName: "supplier_contract_attachments_supplier_same_wedding_fkey"
            columns: ["wedding_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      supplier_installments: {
        Row: {
          amount: number
          budget_item_id: string | null
          cancelled_at: string | null
          created_at: string
          due_date: string
          id: string
          notes: string | null
          supplier_id: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          amount: number
          budget_item_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          supplier_id: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          amount?: number
          budget_item_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          supplier_id?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_installments_budget_item_same_supplier_fkey"
            columns: ["wedding_id", "budget_item_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["wedding_id", "id", "supplier_id"]
          },
          {
            foreignKeyName: "supplier_installments_supplier_same_wedding_fkey"
            columns: ["wedding_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_finance_totals"
            referencedColumns: ["wedding_id", "supplier_id"]
          },
          {
            foreignKeyName: "supplier_installments_supplier_same_wedding_fkey"
            columns: ["wedding_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "supplier_installments_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "supplier_installments_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "supplier_installments_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payment_transactions: {
        Row: {
          amount: number
          budget_item_id: string | null
          created_at: string
          id: string
          installment_id: string | null
          kind: string
          notes: string | null
          paid_at: string
          payment_method: string | null
          recorded_by_user_id: string | null
          reference_number: string | null
          reverses_transaction_id: string | null
          source: string
          supplier_id: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          amount: number
          budget_item_id?: string | null
          created_at?: string
          id?: string
          installment_id?: string | null
          kind?: string
          notes?: string | null
          paid_at: string
          payment_method?: string | null
          recorded_by_user_id?: string | null
          reference_number?: string | null
          reverses_transaction_id?: string | null
          source?: string
          supplier_id: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          amount?: number
          budget_item_id?: string | null
          created_at?: string
          id?: string
          installment_id?: string | null
          kind?: string
          notes?: string | null
          paid_at?: string
          payment_method?: string | null
          recorded_by_user_id?: string | null
          reference_number?: string | null
          reverses_transaction_id?: string | null
          source?: string
          supplier_id?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payment_transactions_budget_item_same_supplier_fkey"
            columns: ["wedding_id", "budget_item_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["wedding_id", "id", "supplier_id"]
          },
          {
            foreignKeyName: "supplier_payment_transactions_installment_same_supplier_fkey"
            columns: ["wedding_id", "supplier_id", "installment_id"]
            isOneToOne: false
            referencedRelation: "supplier_installment_schedule"
            referencedColumns: ["wedding_id", "supplier_id", "id"]
          },
          {
            foreignKeyName: "supplier_payment_transactions_installment_same_supplier_fkey"
            columns: ["wedding_id", "supplier_id", "installment_id"]
            isOneToOne: false
            referencedRelation: "supplier_installments"
            referencedColumns: ["wedding_id", "supplier_id", "id"]
          },
          {
            foreignKeyName: "supplier_payment_transactions_reversal_fkey"
            columns: ["wedding_id", "supplier_id", "reverses_transaction_id"]
            isOneToOne: false
            referencedRelation: "supplier_payment_transactions"
            referencedColumns: ["wedding_id", "supplier_id", "id"]
          },
          {
            foreignKeyName: "supplier_payment_transactions_supplier_same_wedding_fkey"
            columns: ["wedding_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_finance_totals"
            referencedColumns: ["wedding_id", "supplier_id"]
          },
          {
            foreignKeyName: "supplier_payment_transactions_supplier_same_wedding_fkey"
            columns: ["wedding_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "supplier_payment_transactions_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "supplier_payment_transactions_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "supplier_payment_transactions_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          category: string
          commitment_notes: string | null
          committed_amount: number | null
          committed_on: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          status: Database["public"]["Enums"]["supplier_status"]
          updated_at: string
          website: string | null
          wedding_id: string
        }
        Insert: {
          category: string
          commitment_notes?: string | null
          committed_amount?: number | null
          committed_on?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["supplier_status"]
          updated_at?: string
          website?: string | null
          wedding_id: string
        }
        Update: {
          category?: string
          commitment_notes?: string | null
          committed_amount?: number | null
          committed_on?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["supplier_status"]
          updated_at?: string
          website?: string | null
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "suppliers_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "suppliers_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      task_categories: {
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
            foreignKeyName: "task_categories_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "task_categories_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "task_categories_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_day_item_memberships: {
        Row: {
          created_at: string
          item_id: string
          membership_id: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          membership_id: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          membership_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_day_item_memberships_item_same_wedding_fkey"
            columns: ["wedding_id", "item_id"]
            isOneToOne: false
            referencedRelation: "wedding_day_items"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "wedding_day_item_memberships_member_same_wedding_fkey"
            columns: ["wedding_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "wedding_memberships"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      wedding_day_items: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          place_id: string | null
          scheduled_end: string | null
          scheduled_start: string
          sort_order: number
          status: Database["public"]["Enums"]["wedding_day_item_status"]
          title: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          place_id?: string | null
          scheduled_end?: string | null
          scheduled_start: string
          sort_order?: number
          status?: Database["public"]["Enums"]["wedding_day_item_status"]
          title: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          place_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["wedding_day_item_status"]
          title?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_day_items_place_same_wedding_fkey"
            columns: ["wedding_id", "place_id"]
            isOneToOne: false
            referencedRelation: "wedding_places"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "wedding_day_items_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_day_items_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_day_items_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_dress_codes: {
        Row: {
          created_at: string
          description: string | null
          general_notes: string | null
          id: string
          title: string
          updated_at: string
          venue_advice: string | null
          wedding_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          general_notes?: string | null
          id?: string
          title: string
          updated_at?: string
          venue_advice?: string | null
          wedding_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          general_notes?: string | null
          id?: string
          title?: string
          updated_at?: string
          venue_advice?: string | null
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_dress_codes_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: true
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_dress_codes_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: true
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_dress_codes_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: true
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_invitations_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
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
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_memberships_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_memberships_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_motifs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          notes: string | null
          title: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          title: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          title?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_motifs_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: true
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_motifs_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: true
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_motifs_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: true
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_notification_category_preferences: {
        Row: {
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          enabled: boolean
          updated_at: string
          user_id: string
          wedding_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          enabled?: boolean
          updated_at?: string
          user_id: string
          wedding_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          enabled?: boolean
          updated_at?: string
          user_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_notification_category_preferenc_wedding_id_user_id_fkey"
            columns: ["wedding_id", "user_id"]
            isOneToOne: false
            referencedRelation: "wedding_notification_preferences"
            referencedColumns: ["wedding_id", "user_id"]
          },
        ]
      }
      wedding_notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          notifications_enabled: boolean
          push_enabled: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          timezone: string
          updated_at: string
          user_id: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          notifications_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          timezone?: string
          updated_at?: string
          user_id: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          notifications_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_notification_preferences_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_notification_preferences_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_notification_preferences_wedding_id_fkey"
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
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_people_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_people_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_place_purposes: {
        Row: {
          created_at: string
          guest_notes: string | null
          guest_visible: boolean
          id: string
          place_id: string
          private_notes: string | null
          purpose: Database["public"]["Enums"]["wedding_place_purpose"]
          purpose_label: string | null
          sort_order: number
          updated_at: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          guest_notes?: string | null
          guest_visible?: boolean
          id?: string
          place_id: string
          private_notes?: string | null
          purpose: Database["public"]["Enums"]["wedding_place_purpose"]
          purpose_label?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          guest_notes?: string | null
          guest_visible?: boolean
          id?: string
          place_id?: string
          private_notes?: string | null
          purpose?: Database["public"]["Enums"]["wedding_place_purpose"]
          purpose_label?: string | null
          sort_order?: number
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_place_purposes_place_same_wedding_fkey"
            columns: ["wedding_id", "place_id"]
            isOneToOne: false
            referencedRelation: "wedding_places"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "wedding_place_purposes_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_place_purposes_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_place_purposes_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_places: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by_user_id: string | null
          custom_address: string | null
          custom_latitude: number | null
          custom_longitude: number | null
          custom_name: string | null
          google_place_id: string | null
          google_place_id_refreshed_at: string | null
          guest_notes: string | null
          id: string
          place_type: Database["public"]["Enums"]["wedding_place_type"]
          private_notes: string | null
          source: Database["public"]["Enums"]["wedding_place_source"]
          updated_at: string
          user_label: string | null
          wedding_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          custom_address?: string | null
          custom_latitude?: number | null
          custom_longitude?: number | null
          custom_name?: string | null
          google_place_id?: string | null
          google_place_id_refreshed_at?: string | null
          guest_notes?: string | null
          id?: string
          place_type?: Database["public"]["Enums"]["wedding_place_type"]
          private_notes?: string | null
          source: Database["public"]["Enums"]["wedding_place_source"]
          updated_at?: string
          user_label?: string | null
          wedding_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          custom_address?: string | null
          custom_latitude?: number | null
          custom_longitude?: number | null
          custom_name?: string | null
          google_place_id?: string | null
          google_place_id_refreshed_at?: string | null
          guest_notes?: string | null
          id?: string
          place_type?: Database["public"]["Enums"]["wedding_place_type"]
          private_notes?: string | null
          source?: Database["public"]["Enums"]["wedding_place_source"]
          updated_at?: string
          user_label?: string | null
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_places_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_places_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_places_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_website_sections: {
        Row: {
          audience: Database["public"]["Enums"]["website_section_audience"]
          content: string | null
          created_at: string
          enabled: boolean
          id: string
          section_key: string
          section_type: Database["public"]["Enums"]["website_section_type"]
          sort_order: number
          updated_at: string
          wedding_id: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["website_section_audience"]
          content?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          section_key: string
          section_type: Database["public"]["Enums"]["website_section_type"]
          sort_order?: number
          updated_at?: string
          wedding_id: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["website_section_audience"]
          content?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          section_key?: string
          section_type?: Database["public"]["Enums"]["website_section_type"]
          sort_order?: number
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_website_sections_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_websites"
            referencedColumns: ["wedding_id"]
          },
        ]
      }
      wedding_websites: {
        Row: {
          access_mode: Database["public"]["Enums"]["website_access_mode"]
          created_at: string
          introduction: string | null
          is_published: boolean
          published_at: string | null
          slug: string
          template_key: Database["public"]["Enums"]["website_template"]
          title: string | null
          updated_at: string
          wedding_id: string
        }
        Insert: {
          access_mode?: Database["public"]["Enums"]["website_access_mode"]
          created_at?: string
          introduction?: string | null
          is_published?: boolean
          published_at?: string | null
          slug: string
          template_key?: Database["public"]["Enums"]["website_template"]
          title?: string | null
          updated_at?: string
          wedding_id: string
        }
        Update: {
          access_mode?: Database["public"]["Enums"]["website_access_mode"]
          created_at?: string
          introduction?: string | null
          is_published?: boolean
          published_at?: string | null
          slug?: string
          template_key?: Database["public"]["Enums"]["website_template"]
          title?: string | null
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_websites_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: true
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_websites_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: true
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "wedding_websites_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: true
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      weddings: {
        Row: {
          archived_from_status:
            | Database["public"]["Enums"]["wedding_status"]
            | null
          ceremony_style: Database["public"]["Enums"]["ceremony_style"]
          created_at: string
          created_by_user_id: string | null
          currency_code: string
          deletion_nonce: string | null
          deletion_requested_at: string | null
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
          archived_from_status?:
            | Database["public"]["Enums"]["wedding_status"]
            | null
          ceremony_style?: Database["public"]["Enums"]["ceremony_style"]
          created_at?: string
          created_by_user_id?: string | null
          currency_code?: string
          deletion_nonce?: string | null
          deletion_requested_at?: string | null
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
          archived_from_status?:
            | Database["public"]["Enums"]["wedding_status"]
            | null
          ceremony_style?: Database["public"]["Enums"]["ceremony_style"]
          created_at?: string
          created_by_user_id?: string | null
          currency_code?: string
          deletion_nonce?: string | null
          deletion_requested_at?: string | null
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
      guest_check_in_state: {
        Row: {
          guest_id: string | null
          is_checked_in: boolean | null
          last_recorded_at: string | null
          latest_event_id: string | null
          wedding_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "guests_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
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
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "guest_households_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "guest_households_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_finance_totals: {
        Row: {
          actual_paid: number | null
          committed_amount: number | null
          overdue_balance: number | null
          remaining_commitment: number | null
          scheduled_amount: number | null
          supplier_id: string | null
          unscheduled_paid: number | null
          wedding_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "suppliers_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "suppliers_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_installment_schedule: {
        Row: {
          amount: number | null
          budget_item_id: string | null
          cancelled_at: string | null
          created_at: string | null
          due_date: string | null
          id: string | null
          notes: string | null
          paid_amount: number | null
          status: string | null
          supplier_id: string | null
          unpaid_balance: number | null
          updated_at: string | null
          wedding_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_installments_budget_item_same_supplier_fkey"
            columns: ["wedding_id", "budget_item_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["wedding_id", "id", "supplier_id"]
          },
          {
            foreignKeyName: "supplier_installments_supplier_same_wedding_fkey"
            columns: ["wedding_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_finance_totals"
            referencedColumns: ["wedding_id", "supplier_id"]
          },
          {
            foreignKeyName: "supplier_installments_supplier_same_wedding_fkey"
            columns: ["wedding_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "supplier_installments_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_budget_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "supplier_installments_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "wedding_payment_totals"
            referencedColumns: ["wedding_id"]
          },
          {
            foreignKeyName: "supplier_installments_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_budget_totals: {
        Row: {
          active_item_count: number | null
          actual_total: number | null
          currency_code: string | null
          estimated_total: number | null
          manual_actual_total: number | null
          supplier_actual_total: number | null
          wedding_id: string | null
        }
        Relationships: []
      }
      wedding_payment_totals: {
        Row: {
          committed_total: number | null
          currency_code: string | null
          overdue_total: number | null
          paid_total: number | null
          pending_total: number | null
          remaining_commitment: number | null
          scheduled_total: number | null
          uncommitted_supplier_count: number | null
          unscheduled_paid_total: number | null
          wedding_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_coordinator_invitation: {
        Args: { p_raw_token: string }
        Returns: {
          invitation_id: string
          membership_id: string
          membership_role: Database["public"]["Enums"]["wedding_membership_role"]
          wedding_id: string
        }[]
      }
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
      activate_wedding: {
        Args: { p_wedding_id: string }
        Returns: {
          archived_from_status:
            | Database["public"]["Enums"]["wedding_status"]
            | null
          ceremony_style: Database["public"]["Enums"]["ceremony_style"]
          created_at: string
          created_by_user_id: string | null
          currency_code: string
          deletion_nonce: string | null
          deletion_requested_at: string | null
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
        SetofOptions: {
          from: "*"
          to: "weddings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_existing_person_as_guest: {
        Args: {
          p_household_id: string
          p_person_id: string
          p_wedding_id: string
        }
        Returns: string
      }
      add_planning_task_dependency: {
        Args: { p_depends_on_task_id: string; p_task_id: string }
        Returns: boolean
      }
      archive_wedding: {
        Args: { p_wedding_id: string }
        Returns: {
          archived_from_status:
            | Database["public"]["Enums"]["wedding_status"]
            | null
          ceremony_style: Database["public"]["Enums"]["ceremony_style"]
          created_at: string
          created_by_user_id: string | null
          currency_code: string
          deletion_nonce: string | null
          deletion_requested_at: string | null
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
        SetofOptions: {
          from: "*"
          to: "weddings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_wedding_place: { Args: { p_place_id: string }; Returns: string }
      assign_planning_task: {
        Args: { p_membership_id: string; p_task_id: string }
        Returns: boolean
      }
      change_coordinator_role: {
        Args: {
          p_new_role: Database["public"]["Enums"]["wedding_membership_role"]
          p_target_membership_id: string
          p_wedding_id: string
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "wedding_memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      change_planning_task_status: {
        Args: {
          p_status: Database["public"]["Enums"]["planning_task_status"]
          p_task_id: string
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
      claim_notification_deliveries: {
        Args: { p_limit?: number }
        Returns: {
          body: string
          channel: Database["public"]["Enums"]["notification_delivery_channel"]
          claim_token: string
          notification_id: string
          outbox_id: string
          recipient_user_id: string
          title: string
        }[]
      }
      complete_wedding: {
        Args: { p_wedding_id: string }
        Returns: {
          archived_from_status:
            | Database["public"]["Enums"]["wedding_status"]
            | null
          ceremony_style: Database["public"]["Enums"]["ceremony_style"]
          created_at: string
          created_by_user_id: string | null
          currency_code: string
          deletion_nonce: string | null
          deletion_requested_at: string | null
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
        SetofOptions: {
          from: "*"
          to: "weddings"
          isOneToOne: true
          isSetofReturn: false
        }
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
      create_budget_item: {
        Args: {
          p_actual_amount?: number
          p_category_id: string
          p_description?: string
          p_estimated_amount?: number
          p_name: string
          p_notes?: string
          p_status?: Database["public"]["Enums"]["budget_item_status"]
          p_supplier_id: string
          p_wedding_id: string
        }
        Returns: string
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
      create_custom_wedding_place: {
        Args: {
          p_custom_address?: string
          p_custom_latitude?: number
          p_custom_longitude?: number
          p_custom_name: string
          p_guest_notes?: string
          p_place_type?: Database["public"]["Enums"]["wedding_place_type"]
          p_private_notes?: string
          p_user_label?: string
          p_wedding_id: string
        }
        Returns: string
      }
      create_google_wedding_place: {
        Args: {
          p_google_place_id: string
          p_guest_notes?: string
          p_place_type?: Database["public"]["Enums"]["wedding_place_type"]
          p_private_notes?: string
          p_user_label?: string
          p_wedding_id: string
        }
        Returns: string
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
      create_planning_task: {
        Args: {
          p_category_id: string
          p_description: string
          p_due_date: string
          p_priority: Database["public"]["Enums"]["planning_task_priority"]
          p_private_notes: string
          p_sort_order: number
          p_start_date: string
          p_title: string
          p_wedding_id: string
        }
        Returns: string
      }
      create_seating_event: {
        Args: {
          p_event_kind?: string
          p_name: string
          p_sort_order?: number
          p_wedding_id: string
        }
        Returns: string
      }
      create_seating_seat: {
        Args: { p_label: string; p_sort_order?: number; p_table_id: string }
        Returns: string
      }
      create_seating_table: {
        Args: {
          p_capacity: number
          p_event_id: string
          p_name: string
          p_notes?: string
          p_shape?: Database["public"]["Enums"]["seating_table_shape"]
          p_sort_order?: number
          p_table_number?: number
          p_zone?: string
        }
        Returns: string
      }
      create_supplier: {
        Args: {
          p_category: string
          p_contact_name?: string
          p_email?: string
          p_name: string
          p_notes?: string
          p_phone?: string
          p_status?: Database["public"]["Enums"]["supplier_status"]
          p_website?: string
          p_wedding_id: string
        }
        Returns: string
      }
      create_supplier_installment: {
        Args: {
          p_amount: number
          p_budget_item_id: string
          p_due_date: string
          p_notes?: string
          p_supplier_id: string
          p_wedding_id: string
        }
        Returns: string
      }
      delete_seating_seat: { Args: { p_seat_id: string }; Returns: undefined }
      delete_seating_table: { Args: { p_table_id: string }; Returns: undefined }
      enqueue_notification: {
        Args: {
          p_body: string
          p_category: Database["public"]["Enums"]["notification_category"]
          p_idempotency_key: string
          p_metadata?: Json
          p_recipient_user_id: string
          p_title: string
          p_wedding_id: string
        }
        Returns: string
      }
      finalize_wedding_deletion: {
        Args: { p_nonce: string; p_wedding_id: string }
        Returns: boolean
      }
      finish_notification_delivery: {
        Args: {
          p_claim_token: string
          p_error_code?: string
          p_outbox_id: string
          p_sent: boolean
        }
        Returns: boolean
      }
      get_guest_pass: { Args: { p_guest_id: string }; Returns: Json }
      get_wedding_notification_preferences: {
        Args: { p_wedding_id: string }
        Returns: Json
      }
      guest_pass_lookup: {
        Args: { p_token: string; p_wedding_id: string }
        Returns: Json
      }
      guest_submit_rsvp: {
        Args: {
          p_dietary_notes?: string
          p_guest_id: string
          p_meal_choice?: string
          p_response_notes?: string
          p_slug: string
          p_status: Database["public"]["Enums"]["guest_rsvp_status"]
          p_token: string
        }
        Returns: Json
      }
      guest_wedding_guide: {
        Args: { p_slug: string; p_token?: string }
        Returns: Json
      }
      issue_coordinator_invitation: {
        Args: {
          p_intended_role: Database["public"]["Enums"]["wedding_membership_role"]
          p_invited_email?: string
          p_wedding_id: string
        }
        Returns: {
          invitation_expires_at: string
          invitation_id: string
          raw_token: string
        }[]
      }
      issue_guest_pass: { Args: { p_guest_id: string }; Returns: Json }
      issue_household_website_token: {
        Args: { p_expires_at?: string; p_household_id: string }
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
      link_payment_receipt_attachment: {
        Args: { p_attachment_id: string; p_payment_id: string }
        Returns: boolean
      }
      link_supplier_contract_attachment: {
        Args: { p_attachment_id: string; p_supplier_id: string }
        Returns: boolean
      }
      list_wedding_deletion_objects: {
        Args: { p_nonce: string; p_wedding_id: string }
        Returns: {
          object_path: string
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
      mark_google_wedding_place_refreshed: {
        Args: { p_place_id: string }
        Returns: string
      }
      mark_household_invitation_sent: {
        Args: { p_household_id: string }
        Returns: string
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      mark_wedding_notifications_read: {
        Args: { p_wedding_id: string }
        Returns: number
      }
      mute_wedding_notifications: {
        Args: { p_muted: boolean; p_wedding_id: string }
        Returns: {
          created_at: string
          email_enabled: boolean
          notifications_enabled: boolean
          push_enabled: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          timezone: string
          updated_at: string
          user_id: string
          wedding_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wedding_notification_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      prepare_self_account_deletion: { Args: never; Returns: boolean }
      promote_wedding_member_to_owner: {
        Args: { p_target_membership_id: string; p_wedding_id: string }
        Returns: {
          membership_id: string
          membership_role: Database["public"]["Enums"]["wedding_membership_role"]
          wedding_id: string
        }[]
      }
      publish_wedding_website: {
        Args: { p_publish: boolean; p_wedding_id: string }
        Returns: {
          access_mode: Database["public"]["Enums"]["website_access_mode"]
          created_at: string
          introduction: string | null
          is_published: boolean
          published_at: string | null
          slug: string
          template_key: Database["public"]["Enums"]["website_template"]
          title: string | null
          updated_at: string
          wedding_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wedding_websites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_supplier_payment: {
        Args: {
          p_amount: number
          p_budget_item_id: string
          p_installment_id: string
          p_notes?: string
          p_paid_at: string
          p_payment_method?: string
          p_reference_number?: string
          p_supplier_id: string
          p_wedding_id: string
        }
        Returns: string
      }
      release_guest_allowance_claim: {
        Args: { p_allowance_id: string; p_guest_id: string }
        Returns: undefined
      }
      remove_planning_task_dependency: {
        Args: { p_depends_on_task_id: string; p_task_id: string }
        Returns: boolean
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
      remove_wedding_place_purpose: {
        Args: {
          p_place_id: string
          p_purpose: Database["public"]["Enums"]["wedding_place_purpose"]
        }
        Returns: boolean
      }
      request_wedding_deletion: {
        Args: { p_confirm_name: string; p_wedding_id: string }
        Returns: string
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
      restore_wedding: {
        Args: { p_wedding_id: string }
        Returns: {
          archived_from_status:
            | Database["public"]["Enums"]["wedding_status"]
            | null
          ceremony_style: Database["public"]["Enums"]["ceremony_style"]
          created_at: string
          created_by_user_id: string | null
          currency_code: string
          deletion_nonce: string | null
          deletion_requested_at: string | null
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
        SetofOptions: {
          from: "*"
          to: "weddings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reverse_supplier_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: string
      }
      revoke_guest_pass: { Args: { p_guest_id: string }; Returns: boolean }
      revoke_household_website_token: {
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
      rotate_guest_pass: { Args: { p_guest_id: string }; Returns: Json }
      seat_guest: {
        Args: {
          p_event_id: string
          p_guest_id: string
          p_seat_id?: string
          p_table_id: string
        }
        Returns: string
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
      set_seating_visibility: {
        Args: {
          p_event_id: string
          p_visibility: Database["public"]["Enums"]["seating_visibility"]
        }
        Returns: undefined
      }
      set_supplier_commitment: {
        Args: {
          p_amount: number
          p_committed_on?: string
          p_notes?: string
          p_supplier_id: string
        }
        Returns: string
      }
      set_wedding_notification_category: {
        Args: {
          p_category: Database["public"]["Enums"]["notification_category"]
          p_enabled: boolean
          p_wedding_id: string
        }
        Returns: {
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          enabled: boolean
          updated_at: string
          user_id: string
          wedding_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wedding_notification_category_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_wedding_notification_preferences: {
        Args: {
          p_email_enabled?: boolean
          p_notifications_enabled?: boolean
          p_push_enabled?: boolean
          p_quiet_hours_enabled?: boolean
          p_quiet_hours_end?: string
          p_quiet_hours_start?: string
          p_timezone?: string
          p_wedding_id: string
        }
        Returns: {
          created_at: string
          email_enabled: boolean
          notifications_enabled: boolean
          push_enabled: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          timezone: string
          updated_at: string
          user_id: string
          wedding_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wedding_notification_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_wedding_place_purpose: {
        Args: {
          p_guest_notes?: string
          p_guest_visible?: boolean
          p_place_id: string
          p_private_notes?: string
          p_purpose: Database["public"]["Enums"]["wedding_place_purpose"]
          p_purpose_label?: string
          p_sort_order?: number
        }
        Returns: string
      }
      unassign_planning_task: {
        Args: { p_membership_id: string; p_task_id: string }
        Returns: boolean
      }
      unseat_guest: {
        Args: { p_event_id: string; p_guest_id: string }
        Returns: undefined
      }
      update_budget_item: {
        Args: {
          p_actual_amount: number
          p_budget_item_id: string
          p_category_id: string
          p_description: string
          p_estimated_amount: number
          p_name: string
          p_notes: string
          p_status: Database["public"]["Enums"]["budget_item_status"]
          p_supplier_id: string
        }
        Returns: string
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
      update_planning_task: {
        Args: {
          p_category_id: string
          p_description: string
          p_due_date: string
          p_priority: Database["public"]["Enums"]["planning_task_priority"]
          p_private_notes: string
          p_sort_order: number
          p_start_date: string
          p_task_id: string
          p_title: string
        }
        Returns: string
      }
      update_seating_event: {
        Args: {
          p_event_id: string
          p_event_kind: string
          p_name: string
          p_sort_order: number
        }
        Returns: undefined
      }
      update_seating_seat: {
        Args: { p_label: string; p_seat_id: string; p_sort_order: number }
        Returns: undefined
      }
      update_seating_table: {
        Args: {
          p_capacity: number
          p_name: string
          p_notes: string
          p_shape: Database["public"]["Enums"]["seating_table_shape"]
          p_sort_order: number
          p_table_id: string
          p_table_number: number
          p_zone: string
        }
        Returns: undefined
      }
      update_supplier: {
        Args: {
          p_category: string
          p_contact_name: string
          p_email: string
          p_name: string
          p_notes: string
          p_phone: string
          p_status: Database["public"]["Enums"]["supplier_status"]
          p_supplier_id: string
          p_website: string
        }
        Returns: string
      }
      update_wedding_place_context: {
        Args: {
          p_custom_address: string
          p_custom_latitude: number
          p_custom_longitude: number
          p_custom_name: string
          p_guest_notes: string
          p_place_id: string
          p_place_type: Database["public"]["Enums"]["wedding_place_type"]
          p_private_notes: string
          p_user_label: string
        }
        Returns: string
      }
      wedding_day_check_in: {
        Args: {
          p_client_event_id?: string
          p_guest_id?: string
          p_household_id?: string
          p_occurred_at?: string
          p_qr_token?: string
          p_wedding_id: string
        }
        Returns: Json
      }
      wedding_day_dashboard: { Args: { p_wedding_id: string }; Returns: Json }
      wedding_day_reverse_check_in: {
        Args: {
          p_client_event_id?: string
          p_guest_id: string
          p_occurred_at?: string
          p_reason?: string
          p_wedding_id: string
        }
        Returns: Json
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
      budget_item_status: "PLANNED" | "CONFIRMED" | "CANCELLED" | "ARCHIVED"
      ceremony_style:
        | "RELIGIOUS"
        | "CIVIL"
        | "SYMBOLIC"
        | "SECULAR"
        | "DESTINATION"
        | "OTHER"
        | "UNDECIDED"
      guest_allowance_type: "PLUS_ONE" | "CHILD"
      guest_check_in_event_type: "CHECK_IN" | "REVERSAL"
      guest_check_in_source: "QR" | "MANUAL" | "OFFLINE_SYNC"
      guest_rsvp_status: "NO_RESPONSE" | "ATTENDING" | "DECLINED"
      household_invitation_delivery_status: "NOT_SENT" | "SENT"
      household_rsvp_progress:
        | "NO_RESPONSE"
        | "PARTIALLY_RESPONDED"
        | "RESPONDED"
      notification_category:
        | "PLANNING_TASK"
        | "RSVP"
        | "GUEST_UPDATE"
        | "PAYMENT_DUE"
        | "WEDDING_DAY"
        | "MEMBERSHIP"
        | "SYSTEM"
      notification_delivery_channel: "EMAIL" | "PUSH"
      notification_delivery_status:
        | "PENDING"
        | "CLAIMED"
        | "SENT"
        | "FAILED"
        | "SKIPPED"
      planning_task_priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"
      planning_task_status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
      seating_table_shape: "ROUND" | "RECTANGULAR" | "SQUARE" | "OVAL" | "OTHER"
      seating_visibility: "HIDDEN" | "TABLE_ONLY" | "TABLE_AND_SEAT"
      supplier_payment_status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED"
      supplier_status:
        | "PROSPECT"
        | "CONTACTED"
        | "BOOKED"
        | "COMPLETED"
        | "CANCELLED"
      website_access_mode: "ANYONE_WITH_LINK" | "INVITED_GUESTS_ONLY"
      website_section_audience: "PUBLIC" | "INVITED" | "PERSONALIZED" | "HIDDEN"
      website_section_type:
        | "INTRO"
        | "PLACES"
        | "DRESS_CODE"
        | "RSVP"
        | "CUSTOM"
      website_template:
        | "SAMPAGUITA"
        | "LUNTIAN"
        | "FILIPINIANA"
        | "MODERN_LOVE"
        | "AFTER_DARK"
      wedding_day_item_status:
        | "UPCOMING"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "DELAYED"
        | "SKIPPED"
        | "CANCELLED"
      wedding_invitation_status: "PENDING" | "ACCEPTED" | "REVOKED"
      wedding_membership_role:
        | "OWNER"
        | "FULL_COORDINATOR"
        | "DAY_OF_COORDINATOR"
        | "GUEST_COORDINATOR"
      wedding_membership_status: "ACTIVE" | "LEFT" | "REMOVED"
      wedding_origin: "COUPLE_CREATED" | "COORDINATOR_CREATED"
      wedding_ownership_mode: "COORDINATOR_MANAGED" | "COUPLE_OWNED"
      wedding_place_purpose:
        | "CEREMONY"
        | "RECEPTION"
        | "ACCOMMODATION"
        | "PRENUP"
        | "GETTING_READY"
        | "REHEARSAL"
        | "AFTER_PARTY"
        | "TRANSPORT"
        | "OTHER"
      wedding_place_source: "GOOGLE_PLACES" | "CUSTOM"
      wedding_place_type:
        | "CHURCH_RELIGIOUS"
        | "GARDEN"
        | "BEACH"
        | "RESORT"
        | "HOTEL"
        | "EVENT_SPACE"
        | "RESTAURANT"
        | "PRIVATE_ESTATE"
        | "HOME"
        | "CIVIL_VENUE"
        | "DESTINATION"
        | "OTHER"
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
      budget_item_status: ["PLANNED", "CONFIRMED", "CANCELLED", "ARCHIVED"],
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
      guest_check_in_event_type: ["CHECK_IN", "REVERSAL"],
      guest_check_in_source: ["QR", "MANUAL", "OFFLINE_SYNC"],
      guest_rsvp_status: ["NO_RESPONSE", "ATTENDING", "DECLINED"],
      household_invitation_delivery_status: ["NOT_SENT", "SENT"],
      household_rsvp_progress: [
        "NO_RESPONSE",
        "PARTIALLY_RESPONDED",
        "RESPONDED",
      ],
      notification_category: [
        "PLANNING_TASK",
        "RSVP",
        "GUEST_UPDATE",
        "PAYMENT_DUE",
        "WEDDING_DAY",
        "MEMBERSHIP",
        "SYSTEM",
      ],
      notification_delivery_channel: ["EMAIL", "PUSH"],
      notification_delivery_status: [
        "PENDING",
        "CLAIMED",
        "SENT",
        "FAILED",
        "SKIPPED",
      ],
      planning_task_priority: ["LOW", "NORMAL", "HIGH", "URGENT"],
      planning_task_status: ["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      seating_table_shape: ["ROUND", "RECTANGULAR", "SQUARE", "OVAL", "OTHER"],
      seating_visibility: ["HIDDEN", "TABLE_ONLY", "TABLE_AND_SEAT"],
      supplier_payment_status: ["PENDING", "PAID", "OVERDUE", "CANCELLED"],
      supplier_status: [
        "PROSPECT",
        "CONTACTED",
        "BOOKED",
        "COMPLETED",
        "CANCELLED",
      ],
      website_access_mode: ["ANYONE_WITH_LINK", "INVITED_GUESTS_ONLY"],
      website_section_audience: ["PUBLIC", "INVITED", "PERSONALIZED", "HIDDEN"],
      website_section_type: ["INTRO", "PLACES", "DRESS_CODE", "RSVP", "CUSTOM"],
      website_template: [
        "SAMPAGUITA",
        "LUNTIAN",
        "FILIPINIANA",
        "MODERN_LOVE",
        "AFTER_DARK",
      ],
      wedding_day_item_status: [
        "UPCOMING",
        "IN_PROGRESS",
        "COMPLETED",
        "DELAYED",
        "SKIPPED",
        "CANCELLED",
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
      wedding_place_purpose: [
        "CEREMONY",
        "RECEPTION",
        "ACCOMMODATION",
        "PRENUP",
        "GETTING_READY",
        "REHEARSAL",
        "AFTER_PARTY",
        "TRANSPORT",
        "OTHER",
      ],
      wedding_place_source: ["GOOGLE_PLACES", "CUSTOM"],
      wedding_place_type: [
        "CHURCH_RELIGIOUS",
        "GARDEN",
        "BEACH",
        "RESORT",
        "HOTEL",
        "EVENT_SPACE",
        "RESTAURANT",
        "PRIVATE_ESTATE",
        "HOME",
        "CIVIL_VENUE",
        "DESTINATION",
        "OTHER",
      ],
      wedding_status: ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"],
    },
  },
} as const
