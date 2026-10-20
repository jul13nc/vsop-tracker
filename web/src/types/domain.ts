// Domain types shared across the app.

export interface Player {
  id: string;
  display_name: string;
  created_at?: string;
}

/** Payout table: total bet (as string key) -> { rank: euros }. */
export type PayoutTable = Record<string, Record<string, number>>;

export interface ChipType {
  name: string;
  value: number;
  count: number;
}

export interface BlindLevel {
  level: number;
  small: number;
  big: number;
}

export interface Season {
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
  created_at?: string;
}

export type GamedayStatus = "setup" | "live" | "finished" | "validated" | "reopened";

export interface Gameday {
  id: string;
  season_id: string;
  date: string;
  counts_double: boolean;
  status: GamedayStatus;
  created_at?: string;
}

export interface GamedayPlayer {
  gameday_id: string;
  player_id: string;
  rebuys: number;
  first_rebuy_order: number | null;
  eliminated_order: number | null;
  final_rank: number | null;
  points: number | null;
  /** Seating assigned at creation (random placement); null if unset. */
  table_number: number | null;
  seat_number: number | null;
}

export type GameEventType = "rebuy" | "elimination" | "seven_two" | "undo";

export interface GameEvent {
  id: number;
  gameday_id: string;
  seq: number;
  type: GameEventType;
  player_id: string;
  payload: Record<string, unknown> | null;
  created_at?: string;
}

export interface TournamentClock {
  gameday_id: string;
  current_level: number;
  is_running: boolean;
  level_started_at: string | null;
  paused_elapsed_seconds: number;
  updated_at?: string;
}
