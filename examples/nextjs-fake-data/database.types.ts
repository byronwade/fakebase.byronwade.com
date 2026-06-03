export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          first_name: string;
          last_name: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string;
          last_name?: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          title: string;
          excerpt: string;
          author_id: string;
          view_count: number;
          published: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          excerpt: string;
          author_id: string;
          view_count: number;
          published?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          excerpt?: string;
          author_id?: string;
          view_count?: number;
          published?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey";
            columns: ["author_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
