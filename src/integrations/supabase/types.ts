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
      account_deletion_requests: {
        Row: {
          anonymized_fields: string[] | null
          completed_at: string | null
          created_at: string
          email: string | null
          founder_note: string | null
          id: string
          phone: string | null
          reason: string | null
          retained_fields: string[] | null
          retention_basis: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anonymized_fields?: string[] | null
          completed_at?: string | null
          created_at?: string
          email?: string | null
          founder_note?: string | null
          id?: string
          phone?: string | null
          reason?: string | null
          retained_fields?: string[] | null
          retention_basis?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anonymized_fields?: string[] | null
          completed_at?: string | null
          created_at?: string
          email?: string | null
          founder_note?: string | null
          id?: string
          phone?: string | null
          reason?: string | null
          retained_fields?: string[] | null
          retention_basis?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      addresses: {
        Row: {
          city: string
          created_at: string
          directions: string | null
          district: string
          id: string
          is_default: boolean
          label: string
          phone: string
          recipient_name: string
          street: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          created_at?: string
          directions?: string | null
          district: string
          id?: string
          is_default?: boolean
          label: string
          phone: string
          recipient_name: string
          street: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          directions?: string | null
          district?: string
          id?: string
          is_default?: boolean
          label?: string
          phone?: string
          recipient_name?: string
          street?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          restaurant_id: string | null
          sender_id: string | null
          target_type: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          restaurant_id?: string | null
          sender_id?: string | null
          target_type: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          restaurant_id?: string | null
          sender_id?: string | null
          target_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_messages_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      advertisements: {
        Row: {
          action_type: Database["public"]["Enums"]["advertisement_action_type"]
          action_value: string
          click_count: number
          client_name: string
          client_phone: string
          created_at: string
          display_order: number
          end_date: string
          id: string
          image_url: string
          impression_count: number
          is_active: boolean
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          action_type?: Database["public"]["Enums"]["advertisement_action_type"]
          action_value?: string
          click_count?: number
          client_name?: string
          client_phone?: string
          created_at?: string
          display_order?: number
          end_date?: string
          id?: string
          image_url: string
          impression_count?: number
          is_active?: boolean
          start_date?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["advertisement_action_type"]
          action_value?: string
          click_count?: number
          client_name?: string
          client_phone?: string
          created_at?: string
          display_order?: number
          end_date?: string
          id?: string
          image_url?: string
          impression_count?: number
          is_active?: boolean
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string
          id: string
          is_active: boolean
          label: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          label: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          label?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_errors: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          last_seen_at: string
          message: string
          occurrences: number
          path: string | null
          resolved: boolean
          source: string
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          message: string
          occurrences?: number
          path?: string | null
          resolved?: boolean
          source?: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          message?: string
          occurrences?: number
          path?: string | null
          resolved?: boolean
          source?: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      assistant_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          proposal: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          proposal?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          proposal?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          correlation_id: string | null
          created_at: string
          detail: Json
          entity: string
          entity_id: string | null
          id: string
          reason: string | null
          status: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          correlation_id?: string | null
          created_at?: string
          detail?: Json
          entity: string
          entity_id?: string | null
          id?: string
          reason?: string | null
          status?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          correlation_id?: string | null
          created_at?: string
          detail?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          reason?: string | null
          status?: string
        }
        Relationships: []
      }
      business_applications: {
        Row: {
          address: string
          applicant_user_id: string
          category: string
          city: string
          closes_at: string | null
          contact_email: string
          contact_person: string
          contact_phone: string
          cover_image_url: string | null
          created_at: string
          cuisines: string[]
          delivery_fee: number
          delivery_minutes: number
          district: string
          founder_note: string | null
          id: string
          is_open_manual: boolean
          latitude: number
          longitude: number
          maps_url: string | null
          min_order: number
          name: string
          opens_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sector: string
          slug: string
          status: string
          tagline: string
          updated_at: string
        }
        Insert: {
          address: string
          applicant_user_id: string
          category: string
          city: string
          closes_at?: string | null
          contact_email: string
          contact_person: string
          contact_phone: string
          cover_image_url?: string | null
          created_at?: string
          cuisines?: string[]
          delivery_fee?: number
          delivery_minutes?: number
          district: string
          founder_note?: string | null
          id?: string
          is_open_manual?: boolean
          latitude: number
          longitude: number
          maps_url?: string | null
          min_order?: number
          name: string
          opens_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sector?: string
          slug: string
          status?: string
          tagline: string
          updated_at?: string
        }
        Update: {
          address?: string
          applicant_user_id?: string
          category?: string
          city?: string
          closes_at?: string | null
          contact_email?: string
          contact_person?: string
          contact_phone?: string
          cover_image_url?: string | null
          created_at?: string
          cuisines?: string[]
          delivery_fee?: number
          delivery_minutes?: number
          district?: string
          founder_note?: string | null
          id?: string
          is_open_manual?: boolean
          latitude?: number
          longitude?: number
          maps_url?: string | null
          min_order?: number
          name?: string
          opens_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sector?: string
          slug?: string
          status?: string
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_documents: {
        Row: {
          created_at: string
          doc_kind: string
          document_no: string | null
          expires_at: string | null
          id: string
          restaurant_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          doc_kind: string
          document_no?: string | null
          expires_at?: string | null
          id?: string
          restaurant_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          doc_kind?: string
          document_no?: string | null
          expires_at?: string | null
          id?: string
          restaurant_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_documents_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      business_media: {
        Row: {
          created_at: string
          id: string
          kind: string
          position: number
          restaurant_id: string
          storage_path: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          position?: number
          restaurant_id: string
          storage_path?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          position?: number
          restaurant_id?: string
          storage_path?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_media_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          effective_from: string
          effective_to: string | null
          fee_type: string
          fixed_amount: number
          id: string
          is_optional: boolean
          rate_percent: number
          sector: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          effective_from?: string
          effective_to?: string | null
          fee_type: string
          fixed_amount?: number
          id?: string
          is_optional?: boolean
          rate_percent?: number
          sector?: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          effective_from?: string
          effective_to?: string | null
          fee_type?: string
          fixed_amount?: number
          id?: string
          is_optional?: boolean
          rate_percent?: number
          sector?: string
          version?: number
        }
        Relationships: []
      }
      communication_consents: {
        Row: {
          channel: string
          created_at: string
          granted: boolean
          id: string
          iys_status: string
          source: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          granted: boolean
          id?: string
          iys_status?: string
          source?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          granted?: boolean
          id?: string
          iys_status?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      complaint_events: {
        Row: {
          actor_id: string
          actor_role: string
          complaint_id: string
          created_at: string
          id: string
          message: string | null
          new_status: string | null
        }
        Insert: {
          actor_id: string
          actor_role: string
          complaint_id: string
          created_at?: string
          id?: string
          message?: string | null
          new_status?: string | null
        }
        Update: {
          actor_id?: string
          actor_role?: string
          complaint_id?: string
          created_at?: string
          id?: string
          message?: string | null
          new_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_events_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          body: string
          created_at: string
          id: string
          order_id: string | null
          platform_due_at: string | null
          restaurant_id: string | null
          seller_due_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          order_id?: string | null
          platform_due_at?: string | null
          restaurant_id?: string | null
          seller_due_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          order_id?: string | null
          platform_due_at?: string | null
          restaurant_id?: string | null
          seller_due_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          details: string | null
          id: string
          reason: string
          reporter_id: string
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      data_processors: {
        Row: {
          data_categories: string[]
          id: string
          location: string | null
          name: string
          purpose: string
          role: string
          transfer_mechanism: string | null
          transfer_status: string
          updated_at: string
        }
        Insert: {
          data_categories: string[]
          id: string
          location?: string | null
          name: string
          purpose: string
          role?: string
          transfer_mechanism?: string | null
          transfer_status?: string
          updated_at?: string
        }
        Update: {
          data_categories?: string[]
          id?: string
          location?: string | null
          name?: string
          purpose?: string
          role?: string
          transfer_mechanism?: string | null
          transfer_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_otp_guard: {
        Row: {
          code_hash: string | null
          email_hash: string
          expires_at: string | null
          failed_attempts: number
          last_sent_at: string | null
          locked_until: string | null
          sends_in_window: number
          updated_at: string
          window_started_at: string
        }
        Insert: {
          code_hash?: string | null
          email_hash: string
          expires_at?: string | null
          failed_attempts?: number
          last_sent_at?: string | null
          locked_until?: string | null
          sends_in_window?: number
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          code_hash?: string | null
          email_hash?: string
          expires_at?: string | null
          failed_attempts?: number
          last_sent_at?: string | null
          locked_until?: string | null
          sends_in_window?: number
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      fcm_tokens: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      founder_backup_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      legal_acceptances: {
        Row: {
          acceptance_type: string
          accepted_at: string
          context: string
          doc_type: string
          document_id: string | null
          id: string
          ip_hash: string | null
          user_agent: string | null
          user_id: string
          version: number
        }
        Insert: {
          acceptance_type: string
          accepted_at?: string
          context?: string
          doc_type: string
          document_id?: string | null
          id?: string
          ip_hash?: string | null
          user_agent?: string | null
          user_id: string
          version: number
        }
        Update: {
          acceptance_type?: string
          accepted_at?: string
          context?: string
          doc_type?: string
          document_id?: string | null
          id?: string
          ip_hash?: string | null
          user_agent?: string | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          audience: string
          content: string
          created_at: string
          created_by: string | null
          doc_type: string
          effective_at: string | null
          id: string
          lawyer_reviewed: boolean
          published_by: string | null
          requires_reacceptance: boolean
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          audience?: string
          content: string
          created_at?: string
          created_by?: string | null
          doc_type: string
          effective_at?: string | null
          id?: string
          lawyer_reviewed?: boolean
          published_by?: string | null
          requires_reacceptance?: boolean
          status?: string
          title: string
          updated_at?: string
          version: number
        }
        Update: {
          audience?: string
          content?: string
          created_at?: string
          created_by?: string | null
          doc_type?: string
          effective_at?: string | null
          id?: string
          lawyer_reviewed?: boolean
          published_by?: string | null
          requires_reacceptance?: boolean
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      maps_config: {
        Row: {
          allowed_referrers: string | null
          api_key: string | null
          id: string
          updated_at: string
        }
        Insert: {
          allowed_referrers?: string | null
          api_key?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          allowed_referrers?: string | null
          api_key?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          restaurant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          barcode: string | null
          category_id: string | null
          created_at: string
          description: string | null
          external_id: string | null
          id: string
          image_url: string | null
          is_available: boolean
          is_popular: boolean
          name: string
          price: number
          restaurant_id: string
          source: string | null
          stock_quantity: number
          synced_at: string | null
          unit: string | null
          updated_at: string
          vat_rate: number | null
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_popular?: boolean
          name: string
          price: number
          restaurant_id: string
          source?: string | null
          stock_quantity?: number
          synced_at?: string | null
          unit?: string | null
          updated_at?: string
          vat_rate?: number | null
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_popular?: boolean
          name?: string
          price?: number
          restaurant_id?: string
          source?: string | null
          stock_quantity?: number
          synced_at?: string | null
          unit?: string | null
          updated_at?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          source_id: string | null
          source_type: string
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          source_id?: string | null
          source_type: string
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          source_id?: string | null
          source_type?: string
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      oauth_code_relay: {
        Row: {
          code: string
          created_at: string
          state_hash: string
        }
        Insert: {
          code: string
          created_at?: string
          state_hash: string
        }
        Update: {
          code?: string
          created_at?: string
          state_hash?: string
        }
        Relationships: []
      }
      order_fee_lines: {
        Row: {
          amount: number
          base_amount: number
          created_at: string
          fee_type: string
          id: string
          order_id: string
          restaurant_id: string
          rule_id: string | null
        }
        Insert: {
          amount: number
          base_amount: number
          created_at?: string
          fee_type: string
          id?: string
          order_id: string
          restaurant_id: string
          rule_id?: string | null
        }
        Update: {
          amount?: number
          base_amount?: number
          created_at?: string
          fee_type?: string
          id?: string
          order_id?: string
          restaurant_id?: string
          rule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_fee_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_fee_lines_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_fee_lines_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string | null
          name: string
          order_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name: string
          order_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name?: string
          order_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_vendor_alerts: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          order_id: string
          read_at: string | null
          restaurant_id: string
          sent_at: string | null
          title: string
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          id?: string
          order_id: string
          read_at?: string | null
          restaurant_id: string
          sent_at?: string | null
          title: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          order_id?: string
          read_at?: string | null
          restaurant_id?: string
          sent_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_vendor_alerts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_vendor_alerts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          city: string
          created_at: string
          delivery_fee: number
          directions: string | null
          district: string
          id: string
          idempotency_key: string | null
          legal_versions: Json | null
          note: string | null
          payment_method: string
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          pre_information: Json | null
          recipient_name: string
          restaurant_id: string
          seller_snapshot: Json | null
          status: Database["public"]["Enums"]["order_status"]
          street: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          city: string
          created_at?: string
          delivery_fee?: number
          directions?: string | null
          district: string
          id?: string
          idempotency_key?: string | null
          legal_versions?: Json | null
          note?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone: string
          pre_information?: Json | null
          recipient_name: string
          restaurant_id: string
          seller_snapshot?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          street: string
          subtotal: number
          total: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          delivery_fee?: number
          directions?: string | null
          district?: string
          id?: string
          idempotency_key?: string | null
          legal_versions?: Json | null
          note?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string
          pre_information?: Json | null
          recipient_name?: string
          restaurant_id?: string
          seller_snapshot?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          street?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      page_manager_roles: {
        Row: {
          city: string
          created_at: string
          district: string
          granted_by: string | null
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          created_at?: string
          district: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          district?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          idempotency_key: string
          kind: string
          order_id: string
          provider: string
          provider_transaction_id: string | null
          raw_event_hash: string | null
          settlement_status: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          idempotency_key: string
          kind: string
          order_id: string
          provider: string
          provider_transaction_id?: string | null
          raw_event_hash?: string | null
          settlement_status?: string
          status: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          kind?: string
          order_id?: string
          provider?: string
          provider_transaction_id?: string | null
          raw_event_hash?: string | null
          settlement_status?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_identity: {
        Row: {
          address: string | null
          authorized_person: string | null
          brand_name: string | null
          email: string | null
          id: string
          kep_address: string | null
          kvkk_contact: string | null
          legal_name: string | null
          mersis_no: string | null
          phone: string | null
          tax_no: string | null
          tax_office: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          authorized_person?: string | null
          brand_name?: string | null
          email?: string | null
          id?: string
          kep_address?: string | null
          kvkk_contact?: string | null
          legal_name?: string | null
          mersis_no?: string | null
          phone?: string | null
          tax_no?: string | null
          tax_office?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          authorized_person?: string | null
          brand_name?: string | null
          email?: string | null
          id?: string
          kep_address?: string | null
          kvkk_contact?: string | null
          legal_name?: string | null
          mersis_no?: string | null
          phone?: string | null
          tax_no?: string | null
          tax_office?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_catalog: {
        Row: {
          barcode: string
          brand: string | null
          created_at: string
          default_vat_rate: number | null
          first_seen_restaurant_id: string | null
          image_url: string | null
          name: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          barcode: string
          brand?: string | null
          created_at?: string
          default_vat_rate?: number | null
          first_seen_restaurant_id?: string | null
          image_url?: string | null
          name: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string
          brand?: string | null
          created_at?: string
          default_vat_rate?: number | null
          first_seen_restaurant_id?: string | null
          image_url?: string | null
          name?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_catalog_first_seen_restaurant_id_fkey"
            columns: ["first_seen_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_imports: {
        Row: {
          actor_id: string | null
          created_at: string
          created_count: number
          file_name: string | null
          id: string
          restaurant_id: string
          skipped: Json | null
          skipped_count: number
          source: string
          total_rows: number
          updated_count: number
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          created_count?: number
          file_name?: string | null
          id?: string
          restaurant_id: string
          skipped?: Json | null
          skipped_count?: number
          source?: string
          total_rows?: number
          updated_count?: number
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          created_count?: number
          file_name?: string | null
          id?: string
          restaurant_id?: string
          skipped?: Json | null
          skipped_count?: number
          source?: string
          total_rows?: number
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_imports_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          phone_verified: boolean
          terms_accepted: boolean
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          phone_verified?: boolean
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          phone_verified?: boolean
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          evidence_path: string | null
          id: string
          order_id: string
          order_item_id: string | null
          reason: string
          requested_amount: number | null
          restaurant_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          evidence_path?: string | null
          id?: string
          order_id: string
          order_item_id?: string | null
          reason: string
          requested_amount?: number | null
          restaurant_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          evidence_path?: string | null
          id?: string
          order_id?: string
          order_item_id?: string | null
          reason?: string
          requested_amount?: number | null
          restaurant_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      request_rate_limit: {
        Row: {
          bucket_key: string
          hit_count: number
          reset_at: string
          updated_at: string
        }
        Insert: {
          bucket_key: string
          hit_count?: number
          reset_at: string
          updated_at?: string
        }
        Update: {
          bucket_key?: string
          hit_count?: number
          reset_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_sync_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          last_used_at: string | null
          restaurant_id: string
          revoked_at: string | null
          token_hash: string
          token_prefix: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          last_used_at?: string | null
          restaurant_id: string
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          last_used_at?: string | null
          restaurant_id?: string
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_sync_tokens_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          agreement_accepted_at: string | null
          agreement_version: number | null
          category: string
          city: string | null
          closes_at: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          cover_image_url: string | null
          created_at: string
          cuisines: string[]
          delivery_fee: number
          delivery_minutes: number
          delivery_type: string
          display_order: number | null
          district: string | null
          id: string
          is_active: boolean
          is_open_manual: boolean
          latitude: number | null
          legal_entity_type: string | null
          legal_name: string | null
          logo_url: string | null
          longitude: number | null
          maps_url: string | null
          mersis_no: string | null
          min_order: number
          name: string
          opens_at: string | null
          pairing_code: string | null
          pairing_code_expires_at: string | null
          rating: number
          review_count: number
          sector: string
          slug: string
          suspended_reason: string | null
          tagline: string | null
          tax_no: string | null
          tax_office: string | null
          updated_at: string
          verification_note: string | null
          verification_status: string
        }
        Insert: {
          address?: string | null
          agreement_accepted_at?: string | null
          agreement_version?: number | null
          category: string
          city?: string | null
          closes_at?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          cuisines?: string[]
          delivery_fee?: number
          delivery_minutes?: number
          delivery_type?: string
          display_order?: number | null
          district?: string | null
          id?: string
          is_active?: boolean
          is_open_manual?: boolean
          latitude?: number | null
          legal_entity_type?: string | null
          legal_name?: string | null
          logo_url?: string | null
          longitude?: number | null
          maps_url?: string | null
          mersis_no?: string | null
          min_order?: number
          name: string
          opens_at?: string | null
          pairing_code?: string | null
          pairing_code_expires_at?: string | null
          rating?: number
          review_count?: number
          sector?: string
          slug: string
          suspended_reason?: string | null
          tagline?: string | null
          tax_no?: string | null
          tax_office?: string | null
          updated_at?: string
          verification_note?: string | null
          verification_status?: string
        }
        Update: {
          address?: string | null
          agreement_accepted_at?: string | null
          agreement_version?: number | null
          category?: string
          city?: string | null
          closes_at?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          cuisines?: string[]
          delivery_fee?: number
          delivery_minutes?: number
          delivery_type?: string
          display_order?: number | null
          district?: string | null
          id?: string
          is_active?: boolean
          is_open_manual?: boolean
          latitude?: number | null
          legal_entity_type?: string | null
          legal_name?: string | null
          logo_url?: string | null
          longitude?: number | null
          maps_url?: string | null
          mersis_no?: string | null
          min_order?: number
          name?: string
          opens_at?: string | null
          pairing_code?: string | null
          pairing_code_expires_at?: string | null
          rating?: number
          review_count?: number
          sector?: string
          slug?: string
          suspended_reason?: string | null
          tagline?: string | null
          tax_no?: string | null
          tax_office?: string | null
          updated_at?: string
          verification_note?: string | null
          verification_status?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_name: string
          comment: string | null
          created_at: string
          hidden_reason: string | null
          id: string
          is_hidden: boolean
          rating: number
          restaurant_id: string
          seller_reply: string | null
          seller_reply_at: string | null
          updated_at: string
          user_id: string
          verified_order_id: string | null
        }
        Insert: {
          author_name?: string
          comment?: string | null
          created_at?: string
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean
          rating: number
          restaurant_id: string
          seller_reply?: string | null
          seller_reply_at?: string | null
          updated_at?: string
          user_id: string
          verified_order_id?: string | null
        }
        Update: {
          author_name?: string
          comment?: string | null
          created_at?: string
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean
          rating?: number
          restaurant_id?: string
          seller_reply?: string | null
          seller_reply_at?: string | null
          updated_at?: string
          user_id?: string
          verified_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_verified_order_id_fkey"
            columns: ["verified_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      security_incidents: {
        Row: {
          affected_count_estimate: number | null
          affected_system: string
          authority_notified_at: string | null
          closed_at: string | null
          created_at: string
          data_categories: string[]
          detected_at: string
          id: string
          measures: string | null
          notification_assessment: string | null
          occurred_at: string | null
          responsible_admin: string | null
          status: string
          subjects_notified_at: string | null
          updated_at: string
        }
        Insert: {
          affected_count_estimate?: number | null
          affected_system: string
          authority_notified_at?: string | null
          closed_at?: string | null
          created_at?: string
          data_categories?: string[]
          detected_at?: string
          id?: string
          measures?: string | null
          notification_assessment?: string | null
          occurred_at?: string | null
          responsible_admin?: string | null
          status?: string
          subjects_notified_at?: string | null
          updated_at?: string
        }
        Update: {
          affected_count_estimate?: number | null
          affected_system?: string
          authority_notified_at?: string | null
          closed_at?: string | null
          created_at?: string
          data_categories?: string[]
          detected_at?: string
          id?: string
          measures?: string | null
          notification_assessment?: string | null
          occurred_at?: string | null
          responsible_admin?: string | null
          status?: string
          subjects_notified_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_areas: {
        Row: {
          city: string
          created_at: string
          district: string
          id: string
          is_active: boolean
          position: number
          updated_at: string
        }
        Insert: {
          city: string
          created_at?: string
          district: string
          id?: string
          is_active?: boolean
          position?: number
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          district?: string
          id?: string
          is_active?: boolean
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          accent_color: string
          background_color: string
          banner_url: string | null
          brand_name: string
          created_at: string
          favicon_url: string | null
          footer_delivery_hours: string
          footer_tagline: string
          founder_contact_email: string
          founder_contact_phone: string
          hero_badge: string
          hero_subtitle: string
          hero_title: string
          hero_title_accent: string
          id: string
          layout_variant: string
          logo_url: string | null
          primary_color: string
          secondary_color: string
          theme_mode: string
          typography: Json
          updated_at: string
          warm_color: string
        }
        Insert: {
          accent_color?: string
          background_color?: string
          banner_url?: string | null
          brand_name?: string
          created_at?: string
          favicon_url?: string | null
          footer_delivery_hours?: string
          footer_tagline?: string
          founder_contact_email?: string
          founder_contact_phone?: string
          hero_badge?: string
          hero_subtitle?: string
          hero_title?: string
          hero_title_accent?: string
          id?: string
          layout_variant?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          theme_mode?: string
          typography?: Json
          updated_at?: string
          warm_color?: string
        }
        Update: {
          accent_color?: string
          background_color?: string
          banner_url?: string | null
          brand_name?: string
          created_at?: string
          favicon_url?: string | null
          footer_delivery_hours?: string
          footer_tagline?: string
          founder_contact_email?: string
          founder_contact_phone?: string
          hero_badge?: string
          hero_subtitle?: string
          hero_title?: string
          hero_title_accent?: string
          id?: string
          layout_variant?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          theme_mode?: string
          typography?: Json
          updated_at?: string
          warm_color?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_assignments: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_assignments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_send_marketing: {
        Args: { _channel: string; _user_id: string }
        Returns: boolean
      }
      cancel_customer_order: {
        Args: { p_order_id: string; p_user_id: string }
        Returns: Json
      }
      consume_email_otp: {
        Args: { p_code_hash: string; p_email_hash: string; p_now?: string }
        Returns: string
      }
      consume_request_rate_limit: {
        Args: {
          p_bucket_key: string
          p_limit: number
          p_now?: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      delete_my_review: {
        Args: { p_restaurant_id: string }
        Returns: undefined
      }
      expire_stale_advertisements: { Args: never; Returns: number }
      get_active_banners: {
        Args: never
        Returns: {
          action_type: Database["public"]["Enums"]["advertisement_action_type"]
          action_value: string
          display_order: number
          id: string
          image_url: string
          title: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_menu_items: {
        Args: { p_restaurant_id: string; p_rows: Json }
        Returns: {
          created_count: number
          updated_count: number
        }[]
      }
      import_menu_items_by_name: {
        Args: { p_restaurant_id: string; p_rows: Json }
        Returns: {
          created_count: number
          updated_count: number
        }[]
      }
      increment_menu_item_stock: {
        Args: { p_delta: number; p_id: string }
        Returns: undefined
      }
      is_page_manager: { Args: { _user_id: string }; Returns: boolean }
      is_vendor_of: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      issue_email_otp: {
        Args: { p_code_hash: string; p_email_hash: string; p_now?: string }
        Returns: Json
      }
      manages_region: {
        Args: { _city: string; _district: string; _user_id: string }
        Returns: boolean
      }
      place_customer_order: {
        Args: {
          p_city: string
          p_directions: string
          p_district: string
          p_idempotency_key: string
          p_items: Json
          p_note: string
          p_phone: string
          p_recipient_name: string
          p_restaurant_id: string
          p_street: string
          p_user_id: string
        }
        Returns: Json
      }
      redeem_restaurant_pairing_code: {
        Args: { p_code: string; p_user_id: string }
        Returns: {
          restaurant_id: string
          restaurant_name: string
        }[]
      }
      register_email_otp_failure: {
        Args: { p_email_hash: string; p_now?: string }
        Returns: number
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_review: {
        Args: { p_comment: string; p_rating: number; p_restaurant_id: string }
        Returns: undefined
      }
      track_advertisement: {
        Args: { p_id: string; p_type: string }
        Returns: undefined
      }
      vendor_restaurant_id: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      advertisement_action_type: "phone" | "internal_route" | "external_link"
      app_role: "admin" | "user" | "founder" | "vendor"
      order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "on_the_way"
        | "delivered"
        | "cancelled"
      payment_status: "unpaid" | "paid" | "failed" | "refunded"
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
      advertisement_action_type: ["phone", "internal_route", "external_link"],
      app_role: ["admin", "user", "founder", "vendor"],
      order_status: [
        "pending",
        "confirmed",
        "preparing",
        "on_the_way",
        "delivered",
        "cancelled",
      ],
      payment_status: ["unpaid", "paid", "failed", "refunded"],
    },
  },
} as const
