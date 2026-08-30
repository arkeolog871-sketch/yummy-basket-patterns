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
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          detail: Json
          entity: string
          entity_id: string | null
          id: string
          status: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity: string
          entity_id?: string | null
          id?: string
          status?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          status?: string
        }
        Relationships: []
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
      device_push_tokens: {
        Row: {
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_broadcasts: {
        Row: {
          audience: string
          body: string
          completed_at: string | null
          created_at: string
          created_by: string
          failure_count: number
          id: string
          idempotency_key: string
          restaurant_id: string | null
          status: string
          success_count: number
          target_count: number
          target_user_id: string | null
          title: string
        }
        Insert: {
          audience: string
          body: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          failure_count?: number
          id?: string
          idempotency_key: string
          restaurant_id?: string | null
          status?: string
          success_count?: number
          target_count?: number
          target_user_id?: string | null
          title: string
        }
        Update: {
          audience?: string
          body?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          failure_count?: number
          id?: string
          idempotency_key?: string
          restaurant_id?: string | null
          status?: string
          success_count?: number
          target_count?: number
          target_user_id?: string | null
          title?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          body: string
          created_at: string
          dedup_key: string
          id: string
          kind: string
          order_id: string | null
          read_at: string | null
          restaurant_id: string | null
          route: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          dedup_key: string
          id?: string
          kind: string
          order_id?: string | null
          read_at?: string | null
          restaurant_id?: string | null
          route?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          dedup_key?: string
          id?: string
          kind?: string
          order_id?: string | null
          read_at?: string | null
          restaurant_id?: string | null
          route?: string | null
          title?: string
          user_id?: string
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
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          is_popular: boolean
          name: string
          price: number
          restaurant_id: string
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_popular?: boolean
          name: string
          price: number
          restaurant_id: string
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_popular?: boolean
          name?: string
          price?: number
          restaurant_id?: string
          stock_quantity?: number
          updated_at?: string
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
          note: string | null
          payment_method: string
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          recipient_name: string
          restaurant_id: string
          status: Database["public"]["Enums"]["order_status"]
          street: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          created_at?: string
          delivery_fee?: number
          directions?: string | null
          district: string
          id?: string
          idempotency_key?: string | null
          note?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone: string
          recipient_name: string
          restaurant_id: string
          status?: Database["public"]["Enums"]["order_status"]
          street: string
          subtotal: number
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          delivery_fee?: number
          directions?: string | null
          district?: string
          id?: string
          idempotency_key?: string | null
          note?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string
          recipient_name?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          street?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
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
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          terms_accepted: boolean
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
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
      restaurants: {
        Row: {
          address: string | null
          category: string
          city: string | null
          closes_at: string | null
          contact_email: string | null
          contact_phone: string | null
          cover_image_url: string | null
          created_at: string
          cuisines: string[]
          delivery_fee: number
          delivery_minutes: number
          district: string | null
          id: string
          is_active: boolean
          is_open_manual: boolean
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          maps_url: string | null
          min_order: number
          name: string
          opens_at: string | null
          rating: number
          review_count: number
          sector: string
          slug: string
          tagline: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          category: string
          city?: string | null
          closes_at?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          cuisines?: string[]
          delivery_fee?: number
          delivery_minutes?: number
          district?: string | null
          id?: string
          is_active?: boolean
          is_open_manual?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          maps_url?: string | null
          min_order?: number
          name: string
          opens_at?: string | null
          rating?: number
          review_count?: number
          sector?: string
          slug: string
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string
          city?: string | null
          closes_at?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          cuisines?: string[]
          delivery_fee?: number
          delivery_minutes?: number
          district?: string | null
          id?: string
          is_active?: boolean
          is_open_manual?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          maps_url?: string | null
          min_order?: number
          name?: string
          opens_at?: string | null
          rating?: number
          review_count?: number
          sector?: string
          slug?: string
          tagline?: string | null
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
        }
        Insert: {
          accent_color?: string
          background_color?: string
          banner_url?: string | null
          brand_name?: string
          created_at?: string
          favicon_url?: string | null
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
        }
        Update: {
          accent_color?: string
          background_color?: string
          banner_url?: string | null
          brand_name?: string
          created_at?: string
          favicon_url?: string | null
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
      is_vendor_of: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      issue_email_otp: {
        Args: { p_code_hash: string; p_email_hash: string; p_now?: string }
        Returns: Json
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
      register_email_otp_failure: {
        Args: { p_email_hash: string; p_now?: string }
        Returns: number
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
