export type Metric = {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  sample_size: number;
  eligible_sample_size: number;
  benchmark?: number | null;
  delta?: number | null;
};

export type TeamMetadata = {
  team_id: string;
  team_name: string;
  league: string;
  year: number;
  matches: number;
  snapshot?: string;
};

export type Metadata = {
  data_status: {
    matches: number;
    raw_rows: number;
    source_files: number;
    rejected_rows: number;
    last_imported_at: string | null;
  };
  leagues: {
    league: string;
    year: number;
    matches: number;
    match_snapshot?: string | null;
  }[];
  splits: { league: string; year: number; split: string }[];
  teams: TeamMetadata[];
  default_selection?: {
    league: string;
    year: number;
    team_id: string;
    comparison_team_id: string;
  };
};

export type MatchTeam = {
  team_id: string;
  team_name: string;
  side: 'BLUE' | 'RED';
  result: number;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  gold_diff_at_15: number | null;
  first_blood: boolean | null;
  first_tower: boolean | null;
  first_dragon: boolean | null;
  first_herald: boolean | null;
  first_baron: boolean | null;
  dragons: number | null;
  heralds: number | null;
  barons: number | null;
  towers: number | null;
  reading: string;
};

export type MatchPlayer = {
  participant_id: number;
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  side: 'BLUE' | 'RED';
  role: string;
  champion: string;
  result: number;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  total_cs: number | null;
  total_gold: number | null;
  damage_to_champions: number | null;
  vision_score: number | null;
  gold_diff_at_15: number | null;
};

export type MatchDraftAction = {
  team_id: string;
  team_name: string;
  side: 'BLUE' | 'RED';
  action_type: 'PICK' | 'BAN';
  action_slot: number;
  champion: string;
  role: string | null;
};

export type MatchDetail = {
  game_id: string;
  league: string;
  year: number;
  split: string | null;
  playoffs: boolean | null;
  played_at: string | null;
  game_number: number | null;
  patch: string | null;
  duration_seconds: number | null;
  data_completeness: string | null;
  quality_status: string;
  teams: MatchTeam[];
  players: MatchPlayer[];
  draft: MatchDraftAction[];
};

export type MatchSummary = {
  game_id: string;
  played_at: string | null;
  split: string | null;
  game_number: number | null;
  patch: string | null;
  duration_seconds: number | null;
  team_id: string;
  team_name: string;
  opponent_id: string;
  opponent_name: string;
  side: 'BLUE' | 'RED';
  result: number;
  kills: number | null;
  deaths: number | null;
  gold_diff_at_15: number | null;
};

export type MatchBundle = {
  league: string;
  year: number;
  matches: MatchDetail[];
};

export type Player = {
  player_id: string;
  player_name: string;
  role: string;
  metrics: Metric[];
};
export type DraftChampion = { champion: string; metrics: Metric[] };
export type Trend = {
  week: string;
  matches: number;
  win_rate: number | null;
  gold_diff_at_15: number | null;
  kills_per_game: number | null;
};
export type Overview = {
  filters: {
    league: string;
    year: number;
    team_id: string;
    team_name: string;
    split: string | null;
  };
  team_metrics: Metric[];
  players: Player[];
  draft: DraftChampion[];
  trends: Trend[];
};
