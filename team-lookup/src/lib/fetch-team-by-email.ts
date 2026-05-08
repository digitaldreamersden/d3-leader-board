import { getSupabaseBrowserClient } from "@/lib/supabase-client";

/** Result of looking up a participant's team by email (team name only in UI). */
export type TeamLookupOutcome =
  | { kind: "found"; teamName: string }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

function resolveTeamTableName(): string {
  const fromEnv: string | undefined = import.meta.env.VITE_SUPABASE_TEAM_TABLE;
  const trimmed: string = (fromEnv ?? "leaderboard_team_members").trim();
  return trimmed.length > 0 ? trimmed : "leaderboard_team_members";
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function formatSupabaseError(message: string): string {
  if (message.includes("JWT")) {
    return "Configuration error: check your Supabase API key.";
  }
  if (message.toLowerCase().includes("permission") || message.includes("42501")) {
    return "Could not read team data. Ask the organizer to allow lookups (see README).";
  }
  return "Something went wrong. Check your connection and try again.";
}

/**
 * Loads only the `team` column for the given email (matches organizer sync normalization).
 */
export async function fetchTeamByEmail(rawEmail: string): Promise<TeamLookupOutcome> {
  const normalizedEmail: string = normalizeEmail(rawEmail);
  if (!normalizedEmail) {
    return { kind: "not_found" };
  }
  try {
    const client = getSupabaseBrowserClient();
    const tableName: string = resolveTeamTableName();
    const { data, error } = await client
      .from(tableName)
      .select("team")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (error != null) {
      return {
        kind: "error",
        message: formatSupabaseError(error.message),
      };
    }
    const teamValue: unknown = data?.team;
    if (typeof teamValue !== "string") {
      return { kind: "not_found" };
    }
    const teamName: string = teamValue.trim();
    if (!teamName) {
      return { kind: "not_found" };
    }
    return { kind: "found", teamName };
  } catch (err) {
    const message: string = err instanceof Error ? err.message : String(err);
    if (message.includes("Missing VITE_SUPABASE")) {
      return { kind: "error", message };
    }
    return { kind: "error", message: formatSupabaseError(message) };
  }
}
