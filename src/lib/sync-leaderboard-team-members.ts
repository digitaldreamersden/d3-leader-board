import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { executeWithRetry } from "@/lib/execute-with-retry";

const DEFAULT_BATCH_SIZE = 75;
const DEFAULT_MAX_ATTEMPTS_PER_BATCH = 5;

/** Row payload for `public.leaderboard_team_members` (DB generates id + created_at). */
export type LeaderboardTeamMemberUpsertRow = Readonly<{
  name: string;
  email: string;
  team: string;
}>;

export type LeaderboardTeamsSyncTeam = Readonly<{
  name: string;
  members: ReadonlyArray<{ name: string; email: string }>;
}>;

export type LeaderboardTeamsSyncOutcome = Readonly<{
  rowCount: number;
  batchCount: number;
}>;

function resolveTeamTableName(): string {
  const fromEnv: string | undefined = import.meta.env.VITE_SUPABASE_TEAM_TABLE;
  const trimmed: string = (fromEnv ?? "leaderboard_team_members").trim();
  return trimmed.length > 0 ? trimmed : "leaderboard_team_members";
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Builds unique rows keyed by normalized email (last occurrence wins within the list).
 */
export function executeBuildLeaderboardTeamMemberRows(
  teams: ReadonlyArray<LeaderboardTeamsSyncTeam>,
): LeaderboardTeamMemberUpsertRow[] {
  const byEmail: Map<string, LeaderboardTeamMemberUpsertRow> = new Map();
  for (const team of teams) {
    const teamName: string = team.name.trim();
    if (!teamName) {
      continue;
    }
    for (const member of team.members) {
      const emailKey: string = normalizeEmail(member.email);
      if (!emailKey) {
        continue;
      }
      const name: string = member.name.trim();
      if (!name) {
        continue;
      }
      byEmail.set(emailKey, { name, email: emailKey, team: teamName });
    }
  }
  return Array.from(byEmail.values());
}

function chunkArray<T>(items: ReadonlyArray<T>, chunkSize: number): T[][] {
  if (chunkSize <= 0) {
    return [Array.from(items)];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Upserts all rows in batches with per-batch retries (safe for 200+ members).
 */
export async function executeSyncLeaderboardTeamMembers(
  teams: ReadonlyArray<LeaderboardTeamsSyncTeam>,
  options: Readonly<{
    batchSize?: number;
    maxAttemptsPerBatch?: number;
  }> = {},
): Promise<LeaderboardTeamsSyncOutcome> {
  const rows: LeaderboardTeamMemberUpsertRow[] =
    executeBuildLeaderboardTeamMemberRows(teams);
  if (rows.length === 0) {
    return { rowCount: 0, batchCount: 0 };
  }
  const batchSize: number = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxAttemptsPerBatch: number =
    options.maxAttemptsPerBatch ?? DEFAULT_MAX_ATTEMPTS_PER_BATCH;
  const tableName: string = resolveTeamTableName();
  const client = getSupabaseBrowserClient();
  const batches: LeaderboardTeamMemberUpsertRow[][] = chunkArray(rows, batchSize);
  for (const batch of batches) {
    await executeWithRetry(
      async () => {
        const { error } = await client.from(tableName).upsert(batch, {
          onConflict: "email",
          ignoreDuplicates: false,
        });
        if (error != null) {
          throw error;
        }
      },
      { maxAttempts: maxAttemptsPerBatch },
    );
  }
  return { rowCount: rows.length, batchCount: batches.length };
}
