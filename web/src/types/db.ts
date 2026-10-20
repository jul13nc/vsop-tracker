// Hand-written DB types matching the Supabase schema (see supabase/migrations).
// Replace with `supabase gen types typescript` output if the schema changes.

import type {
  BlindLevel,
  ChipType,
  GameEventType,
  GamedayStatus,
  PayoutTable,
} from "./domain";

type Timestamps = { created_at: string };

export interface Database {
  public: {
    Tables: {
      players: {
        Row: { id: string; display_name: string } & Timestamps;
        Insert: { id: string; display_name: string; created_at?: string };
        Update: Partial<{ id: string; display_name: string }>;
        Relationships: [];
      };
      seasons: {
        Row: {
          id: string;
          label: string;
          buyin_cents: number;
          payout_table: PayoutTable;
          chip_config: ChipType[];
          points_scheme: number[];
          blind_level_minutes: number;
          rebuy_timeout_minutes: number;
          blind_structure: BlindLevel[];
          is_closed: boolean;
        } & Timestamps;
        Insert: {
          id: string;
          label: string;
          buyin_cents?: number;
          payout_table?: PayoutTable;
          chip_config?: ChipType[];
          points_scheme?: number[];
          blind_level_minutes?: number;
          rebuy_timeout_minutes?: number;
          blind_structure?: BlindLevel[];
          is_closed?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["seasons"]["Insert"]>;
        Relationships: [];
      };
      gamedays: {
        Row: {
          id: string;
          season_id: string;
          date: string;
          counts_double: boolean;
          status: GamedayStatus;
        } & Timestamps;
        Insert: {
          id: string;
          season_id: string;
          date: string;
          counts_double?: boolean;
          status?: GamedayStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["gamedays"]["Insert"]>;
        Relationships: [];
      };
      gameday_players: {
        Row: {
          gameday_id: string;
          player_id: string;
          rebuys: number;
          first_rebuy_order: number | null;
          eliminated_order: number | null;
          final_rank: number | null;
          points: number | null;
          table_number: number | null;
          seat_number: number | null;
        };
        Insert: {
          gameday_id: string;
          player_id: string;
          rebuys?: number;
          first_rebuy_order?: number | null;
          eliminated_order?: number | null;
          final_rank?: number | null;
          points?: number | null;
          table_number?: number | null;
          seat_number?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["gameday_players"]["Insert"]>;
        Relationships: [];
      };
      game_events: {
        Row: {
          id: number;
          gameday_id: string;
          seq: number;
          type: GameEventType;
          player_id: string;
          payload: Record<string, unknown> | null;
        } & Timestamps;
        Insert: {
          gameday_id: string;
          seq: number;
          type: GameEventType;
          player_id: string;
          payload?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["game_events"]["Insert"]>;
        Relationships: [];
      };
      tournament_clock: {
        Row: {
          gameday_id: string;
          current_level: number;
          is_running: boolean;
          level_started_at: string | null;
          paused_elapsed_seconds: number;
          updated_at: string;
        };
        Insert: {
          gameday_id: string;
          current_level?: number;
          is_running?: boolean;
          level_started_at?: string | null;
          paused_elapsed_seconds?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tournament_clock"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      season_standings: {
        Row: {
          season_id: string;
          player_id: string;
          display_name: string;
          total_points: number;
          gamedays_played: number;
          seven_two_count: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
