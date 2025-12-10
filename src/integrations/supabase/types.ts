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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bundles: {
        Row: {
          agent_price: number
          created_at: string
          id: string
          is_active: boolean | null
          master_agent_price: number
          name: string
          product_id: string
          units: number
          updated_at: string
        }
        Insert: {
          agent_price: number
          created_at?: string
          id?: string
          is_active?: boolean | null
          master_agent_price: number
          name: string
          product_id: string
          units?: number
          updated_at?: string
        }
        Update: {
          agent_price?: number
          created_at?: string
          id?: string
          is_active?: boolean | null
          master_agent_price?: number
          name?: string
          product_id?: string
          units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundles_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          id: string
          product_id: string
          quantity: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      master_agent_relationships: {
        Row: {
          agent_id: string
          created_at: string | null
          id: string
          master_agent_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          id?: string
          master_agent_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          id?: string
          master_agent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_agent_relationships_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_agent_relationships_master_agent_id_fkey"
            columns: ["master_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_orders: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          order_number: string
          product_id: string
          quantity: number
          status: string
          total_price: number
          transaction_id: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          order_number: string
          product_id: string
          quantity: number
          status?: string
          total_price: number
          transaction_id?: string | null
          unit_price: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          order_number?: string
          product_id?: string
          quantity?: number
          status?: string
          total_price?: number
          transaction_id?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      pricing_config: {
        Row: {
          created_at: string | null
          id: string
          price: number
          product_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          price: number
          product_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          price?: number
          product_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_config_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_cost: number
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          sku: string | null
          updated_at: string | null
        }
        Insert: {
          base_cost: number
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          sku?: string | null
          updated_at?: string | null
        }
        Update: {
          base_cost?: number
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          sku?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          delivery_address: string | null
          email: string
          full_name: string | null
          id: string
          idstaff: string | null
          is_active: boolean | null
          phone: string | null
          phone_number: string | null
          updated_at: string | null
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_address?: string | null
          email: string
          full_name?: string | null
          id: string
          idstaff?: string | null
          is_active?: boolean | null
          phone?: string | null
          phone_number?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_address?: string | null
          email?: string
          full_name?: string | null
          id?: string
          idstaff?: string | null
          is_active?: boolean | null
          phone?: string | null
          phone_number?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      rewards_config: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          min_quantity: number
          month: number
          reward_description: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_quantity: number
          month?: number
          reward_description: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          year?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_quantity?: number
          month?: number
          reward_description?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      stock_in_hq: {
        Row: {
          created_at: string
          date: string
          description: string | null
          id: string
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          product_id: string
          quantity: number
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_in_hq_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_in_hq_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          buyer_id: string
          created_at: string | null
          id: string
          product_id: string
          quantity: number
          seller_id: string | null
          total_price: number
          transaction_type: string
          unit_price: number
        }
        Insert: {
          buyer_id: string
          created_at?: string | null
          id?: string
          product_id: string
          quantity: number
          seller_id?: string | null
          total_price: number
          transaction_type: string
          unit_price: number
        }
        Update: {
          buyer_id?: string
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          seller_id?: string | null
          total_price?: number
          transaction_type?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "hq" | "master_agent" | "agent" | "branch" | "logistic" | "marketer"
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
      app_role: ["hq", "master_agent", "agent", "branch", "logistic", "marketer"],
    },
  },
} as const
