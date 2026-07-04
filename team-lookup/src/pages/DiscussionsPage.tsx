import { SITE_COPY } from "@/App";
import { CURRENT_EVENT_NAME } from "@/config/event";
import {
  type DiscussionQuestion,
  fetchDiscussionQuestions,
  postDiscussionQuestion,
  resolveDiscussionEventId,
  upvoteDiscussionQuestion,
} from "@/lib/discussions";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowBigUp, Loader2, MessageCircleQuestion, SendHorizontal } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

type LoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

const POLL_INTERVAL_MS = 12000;

function timeAgo(isoDate: string): string {
  const then: number = new Date(isoDate).getTime();
  if (Number.isNaN(then)) {
    return "";
  }
  const seconds: number = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) {
    return "just now";
  }
  const minutes: number = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours: number = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days: number = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DiscussionsPage(): JSX.Element {
  const [questions, setQuestions] = useState<readonly DiscussionQuestion[]>([]);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [eventId, setEventId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [pendingUpvoteIds, setPendingUpvoteIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const pendingUpvoteIdsRef = useRef<ReadonlySet<string>>(pendingUpvoteIds);
  const isPollingRef = useRef<boolean>(false);

  useEffect(() => {
    pendingUpvoteIdsRef.current = pendingUpvoteIds;
  }, [pendingUpvoteIds]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const eventResult = await resolveDiscussionEventId(CURRENT_EVENT_NAME);
      if (!isMounted) {
        return;
      }
      if (eventResult.kind === "error") {
        setLoadState({ status: "error", message: eventResult.message });
        return;
      }
      setEventId(eventResult.value);
      const result = await fetchDiscussionQuestions(eventResult.value);
      if (!isMounted) {
        return;
      }
      if (result.kind === "error") {
        setLoadState({ status: "error", message: result.message });
        return;
      }
      setQuestions(result.questions);
      setLoadState({ status: "ready" });
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Short-poll for new/updated questions every 6s so the board stays live across
  // devices without a full page reload or WebSocket plumbing — only this list's
  // state updates, so the rest of the page (draft input, scroll position) is untouched.
  useEffect(() => {
    if (eventId == null) {
      return;
    }
    const currentEventId: string = eventId;
    let isMounted = true;

    async function poll(): Promise<void> {
      if (isPollingRef.current) {
        return;
      }
      isPollingRef.current = true;
      const result = await fetchDiscussionQuestions(currentEventId);
      isPollingRef.current = false;
      if (!isMounted || result.kind === "error") {
        return;
      }
      const stillPending: ReadonlySet<string> = pendingUpvoteIdsRef.current;
      setQuestions((prev) => {
        const prevById = new Map(prev.map((item) => [item.id, item]));
        return result.questions.map((incoming) => {
          if (stillPending.has(incoming.id)) {
            return prevById.get(incoming.id) ?? incoming;
          }
          return incoming;
        });
      });
    }

    const intervalId = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [eventId]);

  const sortedQuestions = useMemo<readonly DiscussionQuestion[]>(() => {
    return [...questions].sort((a, b) => {
      if (b.upvotes !== a.upvotes) {
        return b.upvotes - a.upvotes;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [questions]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed: string = draft.trim();
    if (!trimmed) {
      setPostError("Enter a question before posting.");
      return;
    }
    if (eventId == null) {
      setPostError("Discussion board isn't ready yet. Try again in a moment.");
      return;
    }
    setIsPosting(true);
    setPostError(null);
    const result = await postDiscussionQuestion(trimmed, eventId);
    setIsPosting(false);
    if (result.kind === "error") {
      setPostError(result.message);
      return;
    }
    setQuestions((prev) => [result.value, ...prev]);
    setDraft("");
  }

  async function handleUpvote(questionId: string): Promise<void> {
    setPendingUpvoteIds((prev) => new Set(prev).add(questionId));
    setQuestions((prev) =>
      prev.map((item) =>
        item.id === questionId ? { ...item, upvotes: item.upvotes + 1 } : item,
      ),
    );
    const result = await upvoteDiscussionQuestion(questionId);
    setPendingUpvoteIds((prev) => {
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
    if (result.kind === "error") {
      setQuestions((prev) =>
        prev.map((item) =>
          item.id === questionId
            ? { ...item, upvotes: Math.max(0, item.upvotes - 1) }
            : item,
        ),
      );
      return;
    }
    setQuestions((prev) =>
      prev.map((item) =>
        item.id === questionId ? { ...item, upvotes: result.value } : item,
      ),
    );
  }

  const isLoading: boolean = loadState.status === "loading";
  const hasError: boolean = loadState.status === "error";

  return (
    <div className="discussions-page relative min-h-dvh overflow-hidden text-[var(--disc-text)] antialiased">
      <div
        className="discussions-grid pointer-events-none absolute inset-0 opacity-70"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-1/4 top-[-10%] h-[440px] w-[440px] rounded-full bg-[var(--disc-primary)]/25 blur-[110px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-[-10%] right-[-10%] h-[420px] w-[420px] rounded-full bg-[var(--disc-primary-soft)]/20 blur-[110px]"
        aria-hidden
      />

      <main className="relative z-10 mx-auto min-h-dvh max-w-2xl px-4 py-8 sm:px-6 sm:py-12 md:max-w-3xl md:px-8 lg:max-w-5xl xl:max-w-6xl">
        <Link to="/" className="inline-flex items-center" aria-label={`${SITE_COPY.communityAbbrev} home`}>
          <img
            src={SITE_COPY.brandLogoSrc}
            alt={`${SITE_COPY.communityName} (${SITE_COPY.communityAbbrev}) logo`}
            width="auto"
            height="auto"
            className="w-40 shrink-0 rounded-2xl border border-white/15 bg-white/5 object-cover shadow-sm sm:w-48"
          />
        </Link>

        <header className="mt-8">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
            Community Discussions
          </h1>
          <p className="mt-2 text-sm font-medium text-[var(--disc-muted)] lg:text-base">
            Ask a question, upvote the ones you want answered most.
          </p>
        </header>

        <section
          className="glass-panel-raised mt-6 rounded-bento p-4 sm:p-5"
          aria-labelledby="ask-heading"
        >
          <h2 id="ask-heading" className="sr-only">
            Post a question
          </h2>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleSubmit}>
            <div className="flex-1">
              <label htmlFor="question-input" className="sr-only">
                Your question
              </label>
              <input
                id="question-input"
                type="text"
                placeholder="What do you want to ask the community?"
                autoComplete="off"
                value={draft}
                disabled={isPosting}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (postError != null) {
                    setPostError(null);
                  }
                }}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-base font-medium text-white placeholder:text-white/40 outline-none ring-[var(--disc-primary-soft)]/40 backdrop-blur-md focus:border-[var(--disc-primary-soft)] focus:ring-2 disabled:opacity-60"
              />
            </div>
            <button
              type="submit"
              disabled={isPosting}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[var(--disc-primary)] px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-[var(--disc-primary)]/40 transition hover:bg-[var(--disc-primary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--disc-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPosting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <SendHorizontal className="h-4 w-4" aria-hidden />
              )}
              Post
            </button>
          </form>
          {postError != null ? (
            <p className="mt-2 text-sm font-semibold text-red-300" role="alert">
              {postError}
            </p>
          ) : null}
        </section>

        <div
          className="my-8 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent"
          aria-hidden
        />

        <section aria-labelledby="questions-heading">
          <h2 id="questions-heading" className="sr-only">
            Questions
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm font-medium text-[var(--disc-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading discussions…
            </div>
          ) : null}

          {hasError && loadState.status === "error" ? (
            <div className="glass-panel rounded-bento p-6 text-center" role="alert">
              <p className="text-base font-semibold text-white">
                Couldn&apos;t load the discussion board.
              </p>
              <p className="mt-2 text-sm font-medium text-[var(--disc-muted)]">
                {loadState.message}
              </p>
            </div>
          ) : null}

          {!isLoading && !hasError && sortedQuestions.length === 0 ? (
            <div className="glass-panel rounded-bento p-8 text-center">
              <MessageCircleQuestion
                className="mx-auto h-8 w-8 text-[var(--disc-primary-soft)]"
                aria-hidden
              />
              <p className="mt-3 text-base font-semibold text-white">
                No questions yet
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--disc-muted)]">
                Be the first to ask something above.
              </p>
            </div>
          ) : null}

          {!isLoading && !hasError && sortedQuestions.length > 0 ? (
            <ul className="space-y-4">
              <AnimatePresence initial={false}>
                {sortedQuestions.map((item) => {
                  const isPending: boolean = pendingUpvoteIds.has(item.id);
                  return (
                    <motion.li
                      key={item.id}
                      layout="position"
                      initial={{ opacity: 0, y: -12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 420, damping: 38 }}
                    >
                      <article className="glass-panel flex items-start gap-4 rounded-bento p-4 sm:p-5">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => void handleUpvote(item.id)}
                          aria-label={`Upvote: ${item.question}`}
                          className="upvote-button flex shrink-0 flex-col items-center gap-0.5 rounded-2xl px-3 py-2.5 text-white disabled:opacity-70"
                        >
                          <ArrowBigUp
                            className="h-5 w-5"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <span className="text-sm font-extrabold tabular-nums">
                            {item.upvotes}
                          </span>
                        </button>
                        <div className="min-w-0 flex-1 pt-1">
                          <p className="text-base font-semibold leading-relaxed text-white lg:text-lg">
                            {item.question}
                          </p>
                          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[var(--disc-muted)]">
                            {timeAgo(item.createdAt)}
                          </p>
                        </div>
                      </article>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          ) : null}
        </section>
      </main>
    </div>
  );
}
