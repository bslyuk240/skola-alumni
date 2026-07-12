"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Radio, Send, Users } from "lucide-react";
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

/** Fixed TikTok-style portrait frame — same size for lobby preview, watch, and host. */
function LiveStage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative mx-auto w-full max-w-[min(390px,100%)] overflow-hidden rounded-2xl bg-neutral-950 shadow-lg ${className}`}
      style={{
        aspectRatio: "9 / 16",
        maxHeight: "min(72dvh, calc(100dvh - 11rem))",
      }}
    >
      {children}
    </div>
  );
}

function formatLiveStarted(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-NG", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function LiveHostPanel({
  tenantSlug,
  groupSlug,
  scopeLabel,
  existingSession = null,
}: {
  tenantSlug: string;
  groupSlug?: string;
  scopeLabel: string;
  existingSession?: LiveSession | null;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const publisherRef = useRef<WhipPublisher | null>(null);

  const [title, setTitle] = useState(existingSession?.title ?? "");
  const [session, setSession] = useState<LiveSession | null>(existingSession);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    return () => {
      void publisherRef.current?.stop();
    };
  }, []);

  async function resumeCamera() {
    if (!session?.whipPublishUrl || !videoRef.current) {
      setErrorMessage("Missing publish URL — reopen Go Live from a fresh start if this persists.");
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    try {
      await publisherRef.current?.stop();
      const publisher = new WhipPublisher(session.whipPublishUrl, videoRef.current);
      publisherRef.current = publisher;
      await publisher.start();
      setCameraOn(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't reconnect the camera.");
    } finally {
      setBusy(false);
    }
  }

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
      setCameraOn(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't go live. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEndLive() {
    if (!session) return;
    if (
      !window.confirm(
        "End this live for everyone? Viewers will be disconnected immediately."
      )
    ) {
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    try {
      await publisherRef.current?.stop();
      publisherRef.current = null;
      setCameraOn(false);
      await fetchJson(`/api/tenants/${tenantSlug}/live/${session.id}/end`, { method: "POST" });
      setSession(null);
      router.push(groupSlug ? `/${tenantSlug}/groups/${groupSlug}/live` : `/${tenantSlug}/live`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't end the live.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <LiveStage>
        <video
          ref={videoRef}
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
        {!cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-950/85 px-6 text-center">
            <Radio className="h-8 w-8 text-white/50" />
            <p className="text-sm text-white/70">
              {session
                ? "Stream is live — reconnect your camera to keep broadcasting"
                : "Camera preview appears when you go live"}
            </p>
          </div>
        )}
        {session && (
          <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full bg-black/55 px-2.5 py-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-error-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-white">Live</span>
          </div>
        )}
      </LiveStage>

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
          <p className="text-sm font-semibold text-neutral-900">{session.title}</p>
          <LiveChatPanel tenantSlug={tenantSlug} sessionId={session.id} compact />
          {!cameraOn && session.whipPublishUrl && (
            <button
              type="button"
              disabled={busy}
              onClick={resumeCamera}
              className="rounded-md bg-primary-600 px-4 py-3 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {busy ? "Connecting..." : "Reconnect camera"}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={handleEndLive}
            className="rounded-md bg-error-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-error-700 disabled:opacity-60"
          >
            {busy ? "Ending..." : "End live"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Admin/host control desk for an active live — preview + End live (no member Join lobby). */
export function LiveManagePanel({
  tenantSlug,
  groupSlug,
  scopeLabel,
  session,
  isBroadcaster,
}: {
  tenantSlug: string;
  groupSlug?: string | null;
  scopeLabel: string;
  session: LiveSession;
  isBroadcaster: boolean;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<WhepPlayer | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function connectPreview() {
      if (!videoRef.current) return;
      try {
        const player = new WhepPlayer(session.whepPlayUrl, videoRef.current);
        playerRef.current = player;
        await player.start();
        if (!cancelled) setPreviewReady(true);
      } catch {
        if (!cancelled) setPreviewReady(false);
      }
    }

    void connectPreview();
    return () => {
      cancelled = true;
      void playerRef.current?.stop();
      playerRef.current = null;
    };
  }, [session.whepPlayUrl]);

  async function handleEndLive() {
    if (
      !window.confirm(
        "End this live for everyone? Viewers will be disconnected immediately."
      )
    ) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      await playerRef.current?.stop();
      playerRef.current = null;
      await fetchJson(`/api/tenants/${tenantSlug}/live/${session.id}/end`, { method: "POST" });
      router.push(groupSlug ? `/${tenantSlug}/groups/${groupSlug}/live` : `/${tenantSlug}/live`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't end the live.");
      setBusy(false);
    }
  }

  const hostHref = groupSlug
    ? `/${tenantSlug}/groups/${groupSlug}/live/host`
    : `/${tenantSlug}/live/host`;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-primary-100 bg-primary-50 px-4 py-3">
        <p className="text-sm font-semibold text-primary-800">You&rsquo;re in host controls</p>
        <p className="mt-0.5 text-xs text-primary-700">
          Members see a Join lobby. You can end the stream anytime from here.
        </p>
      </div>

      <LiveStage>
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
        {!previewReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950">
            <p className="text-sm text-white/60">Loading preview...</p>
          </div>
        )}
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full bg-black/55 px-2.5 py-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-error-600" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white">Live</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <p className="text-sm font-semibold text-white">{session.title}</p>
          <p className="text-[11px] text-white/70">{scopeLabel}</p>
        </div>
      </LiveStage>

      {errorMessage && (
        <div className="rounded-md border-l-4 border-error-600 bg-error-100 px-4 py-3 text-sm text-error-700">
          {errorMessage}
        </div>
      )}

      <LiveChatPanel tenantSlug={tenantSlug} sessionId={session.id} compact />

      {isBroadcaster && (
        <Link
          href={hostHref}
          className="rounded-md border border-neutral-300 px-4 py-3 text-center text-sm font-medium text-neutral-800 hover:bg-neutral-100"
        >
          Open camera / broadcast desk
        </Link>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={handleEndLive}
        className="rounded-md bg-error-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-error-700 disabled:opacity-60"
      >
        {busy ? "Ending live..." : "End live for everyone"}
      </button>
    </div>
  );
}

function toIsoStamp(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function mergeComments(prev: LiveComment[], incoming: LiveComment[]): LiveComment[] {
  const byId = new Map<string, LiveComment>();
  for (const comment of prev) byId.set(comment.id, comment);
  for (const comment of incoming) byId.set(comment.id, comment);
  return Array.from(byId.values())
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-80);
}

export function LiveWatchPanel({
  tenantSlug,
  initialSession,
  scopeLabel,
}: {
  tenantSlug: string;
  initialSession: LiveSession;
  scopeLabel: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<WhepPlayer | null>(null);
  const [session, setSession] = useState(initialSession);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    if (!joined) return;

    let cancelled = false;

    async function connect() {
      // Wait one frame so the always-mounted video is painted after lobby → stream switch.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (cancelled || !videoRef.current) return;

      setJoining(true);
      setErrorMessage(null);
      try {
        await playerRef.current?.stop();
        const player = new WhepPlayer(session.whepPlayUrl, videoRef.current);
        playerRef.current = player;
        await player.start();
        if (videoRef.current) {
          videoRef.current.muted = true;
          setMuted(true);
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Couldn't connect to the live stream."
          );
          setJoined(false);
        }
      } finally {
        if (!cancelled) setJoining(false);
      }
    }

    void connect();

    return () => {
      cancelled = true;
      void playerRef.current?.stop();
      playerRef.current = null;
    };
  }, [joined, session.whepPlayUrl]);

  async function toggleLike() {
    setLiking(true);
    try {
      const result = await fetchJson<{ likedByMe: boolean; likeCount: number }>(
        `/api/tenants/${tenantSlug}/live/${session.id}/reactions`,
        { method: "POST" }
      );
      setSession((prev) => ({ ...prev, likedByMe: result.likedByMe, likeCount: result.likeCount }));
    } catch {
      // ignore
    } finally {
      setLiking(false);
    }
  }

  function handleLeave() {
    void playerRef.current?.stop();
    playerRef.current = null;
    setJoined(false);
    setJoining(false);
    setMuted(true);
    setErrorMessage(null);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted;
    video.muted = next;
    setMuted(next);
    if (!next) void video.play().catch(() => undefined);
  }

  return (
    <div className="flex flex-col gap-3">
      <LiveStage>
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`absolute inset-0 h-full w-full object-cover ${joined ? "opacity-100" : "opacity-0"}`}
        />

        {!joined ? (
          <div className="absolute inset-0 z-10 flex flex-col justify-between bg-gradient-to-b from-primary-900 via-neutral-950 to-neutral-950 p-5 text-white">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-error-600 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                Live
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80">
                {scopeLabel}
              </span>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-bold leading-tight">{session.title}</h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-white/70">
                <span className="inline-flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5" />
                  {session.likeCount} likes
                </span>
                {session.startedAt && (
                  <span>Started {formatLiveStarted(session.startedAt)}</span>
                )}
              </div>
              <p className="text-sm text-white/60">
                Tap Join to enter the live stream. Video uses data — join when you&rsquo;re ready.
              </p>
              <button
                type="button"
                disabled={joining}
                onClick={() => setJoined(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-3.5 text-sm font-semibold text-neutral-900 hover:bg-white/90 disabled:opacity-60"
              >
                <Users className="h-4 w-4" />
                {joining ? "Joining..." : "Join live"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {joining && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
                <p className="text-sm font-medium text-white">Connecting...</p>
              </div>
            )}

            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between bg-gradient-to-b from-black/45 via-transparent to-black/55 p-3">
              <div className="pointer-events-auto flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-full bg-error-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      Live
                    </span>
                  </div>
                  <p className="truncate text-sm font-semibold text-white drop-shadow">{session.title}</p>
                  <p className="truncate text-[11px] text-white/70">{scopeLabel}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <button
                    type="button"
                    onClick={handleLeave}
                    className="rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-black/70"
                  >
                    Leave
                  </button>
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-black/70"
                  >
                    {muted ? "Unmute" : "Mute"}
                  </button>
                </div>
              </div>

              <div className="pointer-events-auto flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <LiveChatPanel tenantSlug={tenantSlug} sessionId={session.id} overlay />
                </div>
                <button
                  type="button"
                  disabled={liking}
                  onClick={toggleLike}
                  className="mb-1 flex flex-col items-center gap-1 rounded-full px-1 py-1 text-white"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45">
                    <Heart
                      className={`h-5 w-5 ${session.likedByMe ? "fill-error-600 text-error-600" : ""}`}
                    />
                  </span>
                  <span className="text-[11px] font-medium drop-shadow">{session.likeCount}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </LiveStage>

      {errorMessage && (
        <div className="rounded-md border-l-4 border-error-600 bg-error-100 px-4 py-3 text-sm text-error-700">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

function LiveChatPanel({
  tenantSlug,
  sessionId,
  compact = false,
  overlay = false,
}: {
  tenantSlug: string;
  sessionId: string;
  compact?: boolean;
  overlay?: boolean;
}) {
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const lastStampRef = useRef<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const sendingLockRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    seenIdsRef.current = new Set();
    lastStampRef.current = null;
    setComments([]);

    async function pull() {
      if (inFlight || cancelled) return;
      inFlight = true;
      try {
        const query = lastStampRef.current
          ? `?after=${encodeURIComponent(lastStampRef.current)}`
          : "";
        const result = await fetchJson<{ comments: LiveComment[] }>(
          `/api/tenants/${tenantSlug}/live/${sessionId}/comments${query}`
        );
        if (cancelled || result.comments.length === 0) return;

        const fresh = result.comments.filter((comment) => !seenIdsRef.current.has(comment.id));
        for (const comment of result.comments) seenIdsRef.current.add(comment.id);

        const newestStamp = toIsoStamp(result.comments[result.comments.length - 1]?.createdAt);
        if (newestStamp) lastStampRef.current = newestStamp;

        if (fresh.length === 0) return;
        setComments((prev) => mergeComments(prev, fresh));
      } catch {
        // polling is best-effort
      } finally {
        inFlight = false;
      }
    }

    void pull();
    const timer = setInterval(pull, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [tenantSlug, sessionId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [comments]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sendingLockRef.current) return;

    sendingLockRef.current = true;
    setSubmitting(true);
    setDraft("");
    try {
      const created = await fetchJson<LiveComment>(
        `/api/tenants/${tenantSlug}/live/${sessionId}/comments`,
        { method: "POST", body: { content } }
      );
      seenIdsRef.current.add(created.id);
      const stamp = toIsoStamp(created.createdAt);
      if (stamp) lastStampRef.current = stamp;
      setComments((prev) => mergeComments(prev, [created]));
    } catch {
      setDraft(content);
    } finally {
      sendingLockRef.current = false;
      setSubmitting(false);
    }
  }

  if (overlay) {
    return (
      <div className="flex max-w-[85%] flex-col gap-2">
        <div
          ref={listRef}
          className="flex max-h-36 flex-col gap-1.5 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {comments.slice(-12).map((comment) => (
            <p key={comment.id} className="text-xs leading-snug text-white drop-shadow">
              <span className="font-semibold">{comment.authorName}</span>{" "}
              <span className="text-white/90">{comment.content}</span>
            </p>
          ))}
        </div>
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={280}
            placeholder="Say something..."
            className="min-w-0 flex-1 rounded-full border border-white/20 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/50 outline-none focus:border-white/40"
          />
          <button
            type="submit"
            disabled={submitting || !draft.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-neutral-900 disabled:opacity-50"
            aria-label="Send comment"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col rounded-lg border border-neutral-100 bg-white ${compact ? "p-3" : "p-4"}`}
    >
      <div
        ref={listRef}
        className={`flex flex-col gap-2 overflow-y-auto ${compact ? "max-h-40" : "max-h-56"}`}
      >
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
        When someone goes live, you&rsquo;ll see the stream info here and can join when ready.
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
