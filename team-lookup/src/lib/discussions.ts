import { getSupabaseBrowserClient } from "@/lib/supabase-client";

export type DiscussionQuestion = {
  readonly id: string;
  readonly question: string;
  readonly upvotes: number;
  readonly createdAt: string;
};

export type DiscussionsResult =
  | { kind: "ok"; questions: readonly DiscussionQuestion[] }
  | { kind: "error"; message: string };

export type DiscussionMutationResult<T> =
  | { kind: "ok"; value: T }
  | { kind: "error"; message: string };

function resolveTableName(): string {
  const fromEnv: string | undefined =
    import.meta.env.VITE_SUPABASE_DISCUSSIONS_TABLE;
  const trimmed: string = (fromEnv ?? "discussion_questions").trim();
  return trimmed.length > 0 ? trimmed : "discussion_questions";
}

let cachedEventId: string | null = null;

/**
 * Resolves the current event's id from its name, creating the event row on first
 * use. The id is cached for the lifetime of the page so repeated calls (post,
 * fetch, upvote) don't re-hit the RPC.
 */
export async function resolveDiscussionEventId(
  eventName: string,
): Promise<DiscussionMutationResult<string>> {
  if (cachedEventId != null) {
    return { kind: "ok", value: cachedEventId };
  }
  const trimmed: string = eventName.trim();
  if (!trimmed) {
    return { kind: "error", message: "No event name configured." };
  }
  try {
    const client = getSupabaseBrowserClient();
    const { data, error } = await client.rpc("get_or_create_discussion_event", {
      event_name: trimmed,
    });
    if (error != null) {
      return { kind: "error", message: formatSupabaseError(error.message) };
    }
    const eventId: string = String(data);
    cachedEventId = eventId;
    return { kind: "ok", value: eventId };
  } catch (err) {
    const message: string = err instanceof Error ? err.message : String(err);
    return { kind: "error", message: formatSupabaseError(message) };
  }
}

function formatSupabaseError(message: string): string {
  if (message.includes("JWT")) {
    return "Configuration error: check your Supabase API key.";
  }
  if (
    message.toLowerCase().includes("permission") ||
    message.includes("42501")
  ) {
    return "Could not reach the discussion board. Ask the organizer to check Supabase access (see README).";
  }
  if (message.toLowerCase().includes("relation") && message.includes("does not exist")) {
    return "The discussion board isn't set up yet. Ask the organizer to run the Supabase setup (see README).";
  }
  return "Something went wrong. Check your connection and try again.";
}

type QuestionRow = {
  readonly id: string | number;
  readonly question: string;
  readonly upvotes: number | null;
  readonly created_at: string;
};

function mapRow(row: QuestionRow): DiscussionQuestion {
  return {
    id: String(row.id),
    question: row.question,
    upvotes: row.upvotes ?? 0,
    createdAt: row.created_at,
  };
}

/** Loads discussion questions for one event, newest first (UI re-sorts by upvotes). */
export async function fetchDiscussionQuestions(
  eventId: string,
): Promise<DiscussionsResult> {
  try {
    const client = getSupabaseBrowserClient();
    const { data, error } = await client
      .from(resolveTableName())
      .select("id, question, upvotes, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (error != null) {
      return { kind: "error", message: formatSupabaseError(error.message) };
    }
    const rows: readonly QuestionRow[] = (data ?? []) as QuestionRow[];
    return { kind: "ok", questions: rows.map(mapRow) };
  } catch (err) {
    const message: string = err instanceof Error ? err.message : String(err);
    return { kind: "error", message: formatSupabaseError(message) };
  }
}

/** Inserts a new question for one event and returns the stored row (with server-assigned id). */
export async function postDiscussionQuestion(
  questionText: string,
  eventId: string,
): Promise<DiscussionMutationResult<DiscussionQuestion>> {
  const trimmed: string = questionText.trim();
  if (!trimmed) {
    return { kind: "error", message: "Enter a question before posting." };
  }
  try {
    const client = getSupabaseBrowserClient();
    const { data, error } = await client
      .from(resolveTableName())
      .insert({ question: trimmed, event_id: eventId })
      .select("id, question, upvotes, created_at")
      .single();
    if (error != null) {
      return { kind: "error", message: formatSupabaseError(error.message) };
    }
    return { kind: "ok", value: mapRow(data as QuestionRow) };
  } catch (err) {
    const message: string = err instanceof Error ? err.message : String(err);
    return { kind: "error", message: formatSupabaseError(message) };
  }
}

/** Atomically increments a question's upvote count via the `increment_discussion_upvotes` RPC. */
export async function upvoteDiscussionQuestion(
  questionId: string,
): Promise<DiscussionMutationResult<number>> {
  try {
    const client = getSupabaseBrowserClient();
    const { data, error } = await client.rpc("increment_discussion_upvotes", {
      question_id: questionId,
    });
    if (error != null) {
      return { kind: "error", message: formatSupabaseError(error.message) };
    }
    return { kind: "ok", value: Number(data) };
  } catch (err) {
    const message: string = err instanceof Error ? err.message : String(err);
    return { kind: "error", message: formatSupabaseError(message) };
  }
}
