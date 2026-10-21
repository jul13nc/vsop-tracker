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
        Relationships: [{
          foreignKeyName: "gamedays_season_id_fkey";
          columns: ["season_id"];
          isOneToOne: false;
          referencedRelation: "seasons";
          referencedColumns: ["id"];
        }];
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
        Relationships: [{
          foreignKeyName: "gameday_players_gameday_id_fkey";
          columns: ["gameday_id"];
          isOneToOne: false;
          referencedRelation: "gamedays";
          referencedColumns: ["id"];
        }, {
          foreignKeyName: "gameday_players_player_id_fkey";
          columns: ["player_id"];
          isOneToOne: false;
          referencedRelation: "players";
          referencedColumns: ["id"];
        }];
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
        Relationships: [{
          foreignKeyName: "game_events_gameday_id_fkey";
          columns: ["gameday_id"];
          isOneToOne: false;
          referencedRelation: "gamedays";
          referencedColumns: ["id"];
        }];
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
    Functions: {
      append_game_event: {
        Args: {
          p_gameday_id: string;
          p_type: GameEventType;
          p_player_id: string;
          p_payload: Record<string, unknown> | null;
        };
        Returns: Database["public"]["Tables"]["game_events"]["Row"];
      };
      undo_game_event: {
        Args: { p_gameday_id: string };
        Returns: undefined;
      };
      save_gameday_results: {
        Args: {
          p_gameday_id: string;
          p_expected_seq: number;
          p_results: { player_id: string; final_rank: number }[];
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
