
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "entries": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"is_late_entry": boolean,"item_number": string,"performer_name": string,"position": number,"routine_title": string,"section_id": string,"status": Database["public"]['Enums']["entry_status"],"studio_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"is_late_entry"?: boolean,"item_number": string,"performer_name": string,"position"?: number,"routine_title"?: string,"section_id": string,"status"?: Database["public"]['Enums']["entry_status"],"studio_name"?: string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"is_late_entry"?: boolean,"item_number"?: string,"performer_name"?: string,"position"?: number,"routine_title"?: string,"section_id"?: string,"status"?: Database["public"]['Enums']["entry_status"],"studio_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "entries_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entries_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    }
                  ]
                },"event_sessions": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"name": string,"position": number,"session_date": string | null,"starts_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"name": string,"position"?: number,"session_date"?: string | null,"starts_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"name"?: string,"position"?: number,"session_date"?: string | null,"starts_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_sessions_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "contact_email": string,"contact_phone": string,"created_at": string,"description": string,"ends_on": string,"entries_close_on": string | null,"entries_open_on": string | null,"id": string,"music_due_on": string | null,"name": string,"organisation_id": string,"starts_on": string,"status": Database["public"]['Enums']["event_status"],"venue_address": string,"venue_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_email"?: string,"contact_phone"?: string,"created_at"?: string,"description"?: string,"ends_on": string,"entries_close_on"?: string | null,"entries_open_on"?: string | null,"id"?: string,"music_due_on"?: string | null,"name": string,"organisation_id": string,"starts_on": string,"status"?: Database["public"]['Enums']["event_status"],"venue_address"?: string,"venue_name"?: string
                  }
                  Update: {
                    "contact_email"?: string,"contact_phone"?: string,"created_at"?: string,"description"?: string,"ends_on"?: string,"entries_close_on"?: string | null,"entries_open_on"?: string | null,"id"?: string,"music_due_on"?: string | null,"name"?: string,"organisation_id"?: string,"starts_on"?: string,"status"?: Database["public"]['Enums']["event_status"],"venue_address"?: string,"venue_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_organisation_id_fkey"
      columns: ["organisation_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    }
                  ]
                },"organisation_members": {
                  Row: {
                    "created_at": string,"organisation_id": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"organisation_id": string,"role"?: Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"organisation_id"?: string,"role"?: Database["public"]['Enums']["org_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organisation_members_organisation_id_fkey"
      columns: ["organisation_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organisation_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organisations": {
                  Row: {
                    "contact_email": string | null,"created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_email"?: string | null,"created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "contact_email"?: string | null,"created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string,"id": string,"is_platform_admin": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"full_name"?: string,"id": string,"is_platform_admin"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"is_platform_admin"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"sections": {
                  Row: {
                    "age_group": string,"code": string,"created_at": string,"entry_fee_cents": number,"event_id": string,"genre": string,"id": string,"name": string,"position": number,"session_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "age_group"?: string,"code": string,"created_at"?: string,"entry_fee_cents"?: number,"event_id": string,"genre"?: string,"id"?: string,"name": string,"position"?: number,"session_id"?: string | null
                  }
                  Update: {
                    "age_group"?: string,"code"?: string,"created_at"?: string,"entry_fee_cents"?: number,"event_id"?: string,"genre"?: string,"id"?: string,"name"?: string,"position"?: number,"session_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sections_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sections_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "event_sessions"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_late_entry":
{ Args: { "p_item_number": string,"p_performer_name": string,"p_routine_title": string,"p_studio_name": string,"sec": string }; Returns: string
                           },
"add_organisation_member":
{ Args: { "member_email": string,"member_role": Database["public"]['Enums']["org_role"],"org": string }; Returns: undefined
                           },
"can_manage_event":
{ Args: { "ev": string }; Returns: boolean
                           },
"import_program":
{ Args: { "ev": string,"rows": Json }; Returns: number
                           },
"is_event_published":
{ Args: { "ev": string }; Returns: boolean
                           },
"is_org_member":
{ Args: { "org": string }; Returns: boolean
                           },
"is_org_owner":
{ Args: { "org": string }; Returns: boolean
                           },
"is_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"move_entry":
{ Args: { "direction": string,"entry": string }; Returns: undefined
                           }
          }
          Enums: {
            "entry_status": "entered"|"scratched","event_status": "draft"|"published","org_role": "owner"|"staff"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "entry_status": ["entered", "scratched"],"event_status": ["draft", "published"],"org_role": ["owner", "staff"]
          }
        }
} as const
