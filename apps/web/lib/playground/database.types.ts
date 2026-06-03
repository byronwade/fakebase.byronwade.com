/**
 * Supabase-style Database type definitions for the Fakebase playground.
 *
 * Represents a simple blog schema: users + posts.
 * Generated format mirrors what `supabase gen types typescript` produces.
 */

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          updated_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          title: string;
          body: string;
          user_id: string;
          published: boolean;
          slug: string | null;
          tags: string[] | null;
          view_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body: string;
          user_id: string;
          published?: boolean;
          slug?: string | null;
          tags?: string[] | null;
          view_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          body?: string;
          user_id?: string;
          published?: boolean;
          slug?: string | null;
          tags?: string[] | null;
          view_count?: number;
          updated_at?: string;
        };
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          body?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
