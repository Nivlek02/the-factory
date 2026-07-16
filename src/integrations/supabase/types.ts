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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_version: {
        Row: {
          id: string
          updated_at: string
          updated_by: string | null
          version: string
        }
        Insert: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          version: string
        }
        Update: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          version?: string
        }
        Relationships: []
      }
      factory_projects: {
        Row: {
          client: string
          created_at: string
          data: Json
          description: string
          due_date: string | null
          id: string
          name: string
          priority: string
          state: string
          updated_at: string
        }
        Insert: {
          client?: string
          created_at?: string
          data?: Json
          description?: string
          due_date?: string | null
          id: string
          name: string
          priority?: string
          state?: string
          updated_at?: string
        }
        Update: {
          client?: string
          created_at?: string
          data?: Json
          description?: string
          due_date?: string | null
          id?: string
          name?: string
          priority?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          author: string
          content: string
          created_at: string
          id: string
          is_adjustment_request: boolean
          task_id: string
          user_id: string | null
        }
        Insert: {
          author: string
          content: string
          created_at?: string
          id?: string
          is_adjustment_request?: boolean
          task_id: string
          user_id?: string | null
        }
        Update: {
          author?: string
          content?: string
          created_at?: string
          id?: string
          is_adjustment_request?: boolean
          task_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: Database["public"]["Enums"]["task_assigned_role"]
          assigned_to_name: string | null
          attachments: Json | null
          board: string
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          folder_url: string | null
          history: Json | null
          id: string
          priority: string | null
          reopened_count: number
          status: Database["public"]["Enums"]["task_status"]
          task_number: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to: Database["public"]["Enums"]["task_assigned_role"]
          assigned_to_name?: string | null
          attachments?: Json | null
          board: string
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          folder_url?: string | null
          history?: Json | null
          id?: string
          priority?: string | null
          reopened_count?: number
          status?: Database["public"]["Enums"]["task_status"]
          task_number?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: Database["public"]["Enums"]["task_assigned_role"]
          assigned_to_name?: string | null
          attachments?: Json | null
          board?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          folder_url?: string | null
          history?: Json | null
          id?: string
          priority?: string | null
          reopened_count?: number
          status?: Database["public"]["Enums"]["task_status"]
          task_number?: number | null
          thumbnail_url?: string | null
          title?: string
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
      usuarios_roles: {
        Row: {
          created_at: string
          debe_cambiar_password: boolean
          email: string
          id: string
          nombre_completo: string
          rol: string
          updated_at: string
          user_id: string | null
          usuario: string
        }
        Insert: {
          created_at?: string
          debe_cambiar_password?: boolean
          email: string
          id?: string
          nombre_completo: string
          rol: string
          updated_at?: string
          user_id?: string | null
          usuario: string
        }
        Update: {
          created_at?: string
          debe_cambiar_password?: boolean
          email?: string
          id?: string
          nombre_completo?: string
          rol?: string
          updated_at?: string
          user_id?: string | null
          usuario?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "mercadeo" | "disenador" | "copy" | "manager" | "seo"
      task_assigned_role:
        | "designer_1"
        | "designer_2"
        | "copy_1"
        | "copy_2"
        | "unassigned"
        | "sm_1"
        | "sm_2"
        | "seo_1"
        | "seo_2"
      task_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "in_review"
        | "draft"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["mercadeo", "disenador", "copy", "manager", "seo"],
      task_assigned_role: [
        "designer_1",
        "designer_2",
        "copy_1",
        "copy_2",
        "unassigned",
        "sm_1",
        "sm_2",
        "seo_1",
        "seo_2",
      ],
      task_status: [
        "pending",
        "in_progress",
        "completed",
        "in_review",
        "draft",
      ],
    },
  },
} as const
