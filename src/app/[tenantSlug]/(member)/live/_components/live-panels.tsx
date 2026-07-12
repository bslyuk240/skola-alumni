"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Radio, Send } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { WhipPublisher, WhepPlayer } from "@/lib/webrtc-live";

type LiveSession = {
  id: string;
  title: string;
  status: string;
  groupSlug: string | null;
  whepPlayUrl: string;
  whipPublishUrl?: string;
  likeCount: number;
  likedByMe: boolean;
  startedAt: string;
};

type LiveComment = {
  id: string;
  content: string;
  createdAt: string;
  authorName: string;
  userId: string;
};

export function LiveHostPanel({
  tenantSlug,
  groupSlug,
  scopeLabel,
}: {
  tenantSlug: string;
  groupSlug?: string;
  scopeLabel: string;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const publisherRef = useRef<WhipPublisher | null>(null);

  const [title, setTitle] = useState("");
  const [session, setSession] = useState<LiveSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      void publisherRef.current?.stop();
    };
  }, []);

  async function handleGoLive(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage(null);

    try {
      const result = await fetchJson<{ session: LiveSession }>(`/api/tenants/${tenantSlug}/live`, {
        method: "POST",
        body: { title: title.trim(), ...(groupSlug ? { groupSlug } : {}) },
      });

      setSession(result.session);

      if (!videoRef.current || !result.session.whipPublishUrl) {
        throw new Error("Missing camera element or publish URL");
      }

      const publisher = new WhipPublisher(result.session.whipPublishUrl, videoRef.current);
      publisherRef.current = publisher;
      await publisher.start();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't go live. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEndLive() {
    if (!session) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      await publisherRef.current?.stop();
      publisherRef.current = null;
      await fetchJson(`/api/tenants/${tenantSlug}/live/${session.id}/end`, { method: "POST" });
      setSession(null);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't end the live.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} muted playsInline className="aspect-[9/16] w-full object-cover" />
      </div>

      {errorMessage && (
        <div className="rounded-md border-l-4 border-error-600 bg-error-100 px-4 py-3 text-sm text-error-700">
          {errorMessage}
        </div>
      )}

      {!session ? (
        <form onSubmit={handleGoLive} className="flex flex-col gap-3">
          <p className="text-xs text-neutral-500">Going live for {scopeLabel}</p>
          <input
            required
            minLength={2}
            maxLength={255}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Live title (e.g. AGM updates)"
            className="input"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-error-600 px-4 py-3 text-sm font-medium text-white hover:bg-error-700 disabled:opacity-60"
          >
            <Radio className="h-4 w-4" />
            {busy ? "Starting..." : "Go live"}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-error-600" />
            <p className="text-sm font-semibold text-neutral-900">LIVE — {session.title}</p>
          </div>
          <LiveChatPanel tenantSlug={tenantSlug} sessionId={session.id} compact />
          <button
            type="button"
            disabled={busy}
            onClick={handleEndLive}
            className="rounded-md border border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-800 hover:bg-neutral-100 disabled:opacity-60"
          >
            {busy ? "Ending..." : "End live"}
          </button>
        </div>
      )}
    </div>
  );
}

export function LiveWatchPanel({
  tenantSlug,
  initialSession,
}: {
  tenantSlug: string;
  initialSession: LiveSession;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<WhepPlayer | null>(null);
  const [session, setSession] = useState(initialSession);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      if (!videoRef.current) return;
      try {
        const player = new WhepPlayer(session.whepPlayUrl, videoRef.current);
        playerRef.current = player;
        await player.start();
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Couldn't connect to the live stream."
          );
        }
      }
    }

    void connect();

    return () => {
      cancelled = true;
      void playerRef.current?.stop();
    };
  }, [session.whepPlayUrl]);

  async function toggleLike() {
    setLiking(true);
    try {
      const result = await fetchJson<{ likedByMe: boolean; likeCount: number }>(
        `/api/tenants/${tenantSlug}/live/${session.id}/reactions`,
        { method: "POST" }
      );
      setSession((prev) => ({ ...prev, likedByMe: result.likedByMe, likeCount: result.likeCount }));
    } catch {
      // ignore — UI stays optimistic-safe by not flipping early
    } finally {
      setLiking(false);
    }
  }

  return (
    <div className="relative flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} playsInline autoPlay className="aspect-[9/16] w-full object-cover" />
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-2.5 py-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-error-600" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white">Live</span>
        </div>
        <button
          type="button"
          disabled={liking}
          onClick={toggleLike}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-2 text-white"
        >
          <Heart
            className={`h-4 w-4 ${session.likedByMe ? "fill-error-600 text-error-600" : ""}`}
          />
          <span className="text-xs font-medium">{session.likeCount}</span>
        </button>
      </div>

      <div>
        <h1 className="text-base font-semibold text-neutral-900">{session.title}</h1>
      </div>

      {errorMessage && (
        <div className="rounded-md border-l-4 border-error-600 bg-error-100 px-4 py-3 text-sm text-error-700">
          {errorMessage}
        </div>
      )}

      <LiveChatPanel tenantSlug={tenantSlug} sessionId={session.id} />
    </div>
  );
}

function LiveChatPanel({
  tenantSlug,
  sessionId,
  compact = false,
}: {
  tenantSlug: string;
  sessionId: string;
  compact?: boolean;
}) {
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const lastStampRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function pull() {
      try {
        const query = lastStampRef.current
          ? `?after=${encodeURIComponent(lastStampRef.current)}`
          : "";
        const result = await fetchJson<{ comments: LiveComment[] }>(
          `/api/tenants/${tenantSlug}/live/${sessionId}/comments${query}`
        );
        if (cancelled || result.comments.length === 0) return;

        setComments((prev) => {
          const merged = lastStampRef.current ? [...prev, ...result.comments] : result.comments;
          return merged.slice(-80);
        });
        lastStampRef.current = result.comments[result.comments.length - 1]?.createdAt ?? lastStampRef.current;
      } catch {
        // polling is best-effort
      }
    }

    void pull();
    const timer = setInterval(pull, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [tenantSlug, sessionId]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setSubmitting(true);
    try {
      const created = await fetchJson<LiveComment>(
        `/api/tenants/${tenantSlug}/live/${sessionId}/comments`,
        { method: "POST", body: { content: draft.trim() } }
      );
      setComments((prev) => [...prev, created].slice(-80));
      lastStampRef.current = created.createdAt;
      setDraft("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`flex flex-col rounded-lg border border-neutral-100 bg-white ${compact ? "p-3" : "p-4"}`}>
      <div className={`flex flex-col gap-2 overflow-y-auto ${compact ? "max-h-40" : "max-h-56"}`}>
        {comments.length === 0 ? (
          <p className="text-xs text-neutral-500">No comments yet — say hello.</p>
        ) : (
          comments.map((comment) => (
            <p key={comment.id} className="text-xs text-neutral-800">
              <span className="font-semibold">{comment.authorName}</span> {comment.content}
            </p>
          ))
        )}
      </div>
      <form onSubmit={handleSend} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={280}
          placeholder="Add a comment"
          className="input flex-1 text-sm"
        />
        <button
          type="submit"
          disabled={submitting || !draft.trim()}
          className="rounded-md bg-primary-600 px-3 text-white disabled:opacity-50"
          aria-label="Send comment"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

export function LiveEmptyState({
  tenantSlug,
  groupSlug,
  canHost,
  planBlockedMessage,
}: {
  tenantSlug: string;
  groupSlug?: string;
  canHost: boolean;
  planBlockedMessage?: string | null;
}) {
  const hostHref = groupSlug
    ? `/${tenantSlug}/groups/${groupSlug}/live/host`
    : `/${tenantSlug}/live/host`;

  return (
    <div className="rounded-lg border border-neutral-100 bg-white p-6 text-center shadow-sm">
      <Radio className="mx-auto h-8 w-8 text-neutral-400" />
      <h2 className="mt-3 text-base font-semibold text-neutral-900">Nothing live right now</h2>
      <p className="mt-1 text-sm text-neutral-600">
        When someone goes live, you&rsquo;ll be able to watch and comment here.
      </p>
      {planBlockedMessage && (
        <p className="mt-3 text-sm text-warning-700">{planBlockedMessage}</p>
      )}
      {canHost && !planBlockedMessage && (
        <Link
          href={hostHref}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-error-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-error-700"
        >
          Go live
        </Link>
      )}
      {planBlockedMessage && (
        <Link
          href={`/${tenantSlug}/admin/billing`}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          View plans
        </Link>
      )}
    </div>
  );
}
