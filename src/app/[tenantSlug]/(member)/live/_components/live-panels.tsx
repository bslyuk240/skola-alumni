"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal, flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Radio, Send, SwitchCamera, Users } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { WhipPublisher, WhepPlayer, type CameraFacing } from "@/lib/webrtc-live";
import { useSetLiveImmersive } from "../../_components/live-immersive";

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
  viewerCount?: number;
};

type LiveComment = {
  id: string;
  content: string;
  createdAt: string;
  authorName: string;
  userId: string;
};

/** Fixed TikTok-style portrait frame — lobby / pre-live cards. */
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

/**
 * Fullscreen shell with a centered 9:16 video plane so host + members share the same crop
 * (avoids phone viewports taller than 9:16 looking more zoomed with object-cover).
 */
function LiveFullscreenShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 h-[100dvh] w-full overflow-hidden bg-black">
      {children}
    </div>
  );
}

function LivePortraitVideo({
  videoRef,
  mirrored = false,
  muted = true,
  className = "",
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  mirrored?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <div className="relative h-full max-h-[100dvh] w-auto max-w-full aspect-[9/16] overflow-hidden">
        <video
          ref={videoRef}
          muted={muted}
          playsInline
          autoPlay
          className={`absolute inset-0 h-full w-full bg-black object-cover ${mirrored ? "-scale-x-100" : ""} ${className}`}
        />
      </div>
    </div>
  );
}

/** Lock body scroll while immersive live is open (keyboard-safe). */
function useLiveBodyLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    const previousPosition = document.body.style.position;
    const previousTop = document.body.style.top;
    const previousWidth = document.body.style.width;
    const scrollY = window.scrollY;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    const vv = window.visualViewport;
    const keepPinned = () => {
      window.scrollTo(0, 0);
    };
    vv?.addEventListener("scroll", keepPinned);
    vv?.addEventListener("resize", keepPinned);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.width = previousWidth;
      window.scrollTo(0, scrollY);
      vv?.removeEventListener("scroll", keepPinned);
      vv?.removeEventListener("resize", keepPinned);
    };
  }, [active]);
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

/** Heartbeat presence while on a live session; returns live viewer count. */
function useLivePresence(tenantSlug: string, sessionId: string | null | undefined, active: boolean) {
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    if (!active || !sessionId) {
      setViewerCount(0);
      return;
    }

    let cancelled = false;

    async function beat() {
      try {
        const result = await fetchJson<{ viewerCount: number }>(
          `/api/tenants/${tenantSlug}/live/${sessionId}/presence`,
          { method: "POST" }
        );
        if (!cancelled) setViewerCount(result.viewerCount);
      } catch {
        // best-effort
      }
    }

    void beat();
    const timer = setInterval(beat, 12_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      void fetch(`/api/tenants/${tenantSlug}/live/${sessionId}/presence`, {
        method: "DELETE",
      }).catch(() => undefined);
    };
  }, [active, sessionId, tenantSlug]);

  return viewerCount;
}

function ViewerCountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white">
      <Users className="h-3.5 w-3.5" />
      {count}
    </span>
  );
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
  const [facingMode, setFacingMode] = useState<CameraFacing>("user");
  const [flipping, setFlipping] = useState(false);
  const viewerCount = useLivePresence(tenantSlug, session?.id, Boolean(session));
  const immersive = Boolean(session);

  useSetLiveImmersive(immersive);
  useLiveBodyLock(immersive);

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
      await publisher.start(facingMode);
      setFacingMode(publisher.getFacingMode());
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

      flushSync(() => {
        setSession(result.session);
      });

      if (!videoRef.current || !result.session.whipPublishUrl) {
        throw new Error("Missing camera element or publish URL");
      }

      const publisher = new WhipPublisher(result.session.whipPublishUrl, videoRef.current);
      publisherRef.current = publisher;
      await publisher.start(facingMode);
      setFacingMode(publisher.getFacingMode());
      setCameraOn(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't go live. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFlipCamera() {
    if (!publisherRef.current || !cameraOn) return;
    setFlipping(true);
    setErrorMessage(null);
    try {
      await publisherRef.current.switchCamera();
      setFacingMode(publisherRef.current.getFacingMode());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Couldn't switch camera. Try again."
      );
    } finally {
      setFlipping(false);
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

  if (session) {
    return (
      <LiveFullscreenShell>
        <LivePortraitVideo
          videoRef={videoRef}
          mirrored={facingMode === "user"}
          muted
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/75" />

        {!cameraOn && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/70 px-6 text-center">
            <Radio className="h-8 w-8 text-white/50" />
            <p className="text-sm text-white/70">
              Stream is live — reconnect your camera to keep broadcasting
            </p>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-3 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-error-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                Live
              </span>
              <span className="truncate rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-medium text-white/85">
                {scopeLabel}
              </span>
            </div>
            <p className="truncate text-sm font-semibold text-white drop-shadow">{session.title}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ViewerCountBadge count={viewerCount} />
            {cameraOn && (
              <button
                type="button"
                disabled={flipping || busy}
                onClick={handleFlipCamera}
                className="rounded-full bg-black/45 p-2 text-white disabled:opacity-50"
                aria-label={facingMode === "user" ? "Switch to back camera" : "Switch to front camera"}
              >
                <SwitchCamera className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-2">
            <LiveChatPanel tenantSlug={tenantSlug} sessionId={session.id} overlay />
            {!cameraOn && session.whipPublishUrl && (
              <button
                type="button"
                disabled={busy}
                onClick={resumeCamera}
                className="rounded-full bg-primary-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Connecting..." : "Reconnect camera"}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={handleEndLive}
              className="rounded-full bg-error-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Ending..." : "End live"}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="absolute inset-x-3 top-20 z-30 rounded-md border-l-4 border-error-600 bg-error-100 px-4 py-3 text-sm text-error-700">
            {errorMessage}
          </div>
        )}
      </LiveFullscreenShell>
    );
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
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-950/85 px-6 text-center">
          <Radio className="h-8 w-8 text-white/50" />
          <p className="text-sm text-white/70">Camera preview appears when you go live</p>
        </div>
      </LiveStage>

      {errorMessage && (
        <div className="rounded-md border-l-4 border-error-600 bg-error-100 px-4 py-3 text-sm text-error-700">
          {errorMessage}
        </div>
      )}

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
    </div>
  );
}

/** Admin/host control desk for an active live — fullscreen preview + End live. */
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
  const viewerCount = useLivePresence(tenantSlug, session.id, true);

  useSetLiveImmersive(true);
  useLiveBodyLock(true);

  useEffect(() => {
    let cancelled = false;

    async function connectPreview() {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (cancelled || !videoRef.current) return;
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
    <LiveFullscreenShell>
      <LivePortraitVideo videoRef={videoRef} muted />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/75" />

      {!previewReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
          <p className="text-sm text-white/70">Loading preview...</p>
        </div>
      )}

      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-3 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-error-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Live
            </span>
            <span className="truncate rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-medium text-white/85">
              Host controls
            </span>
          </div>
          <p className="truncate text-sm font-semibold text-white drop-shadow">{session.title}</p>
          <p className="truncate text-[11px] text-white/70">{scopeLabel}</p>
        </div>
        <ViewerCountBadge count={viewerCount} />
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-2">
          <LiveChatPanel tenantSlug={tenantSlug} sessionId={session.id} overlay />
          {isBroadcaster && (
            <Link
              href={hostHref}
              className="rounded-full border border-white/30 bg-black/45 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              Open camera desk
            </Link>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={handleEndLive}
            className="rounded-full bg-error-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Ending live..." : "End live for everyone"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="absolute inset-x-3 top-20 z-30 rounded-md border-l-4 border-error-600 bg-error-100 px-4 py-3 text-sm text-error-700">
          {errorMessage}
        </div>
      )}
    </LiveFullscreenShell>
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
  const [lobbyViewerCount, setLobbyViewerCount] = useState(0);
  const viewerCount = useLivePresence(tenantSlug, session.id, joined);

  useSetLiveImmersive(joined);
  useLiveBodyLock(joined);

  // Lobby can see the count without joining the stream (read-only poll).
  useEffect(() => {
    if (joined) return;

    let cancelled = false;
    async function pull() {
      try {
        const result = await fetchJson<{ viewerCount: number }>(
          `/api/tenants/${tenantSlug}/live/${session.id}/presence`
        );
        if (!cancelled) setLobbyViewerCount(result.viewerCount);
      } catch {
        // ignore
      }
    }
    void pull();
    const timer = setInterval(pull, 12_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [joined, tenantSlug, session.id]);

  useEffect(() => {
    if (!joined) return;

    let cancelled = false;

    async function connect() {
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

  if (!joined) {
    return (
      <div className="flex flex-col gap-3 px-4 py-4">
        <LiveStage>
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className="absolute inset-0 h-full w-full bg-black object-cover opacity-0"
          />
          <div className="absolute inset-0 z-10 flex flex-col justify-between bg-gradient-to-b from-primary-900 via-neutral-950 to-neutral-950 p-5 text-white">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-error-600 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                Live
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80">
                {scopeLabel}
              </span>
              <ViewerCountBadge count={lobbyViewerCount} />
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
        </LiveStage>

        {errorMessage && (
          <div className="rounded-md border-l-4 border-error-600 bg-error-100 px-4 py-3 text-sm text-error-700">
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  return (
    <LiveFullscreenShell>
      <LivePortraitVideo videoRef={videoRef} muted={muted} />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />

      {joining && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
          <p className="text-sm font-medium text-white">Connecting...</p>
        </div>
      )}

      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-3 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-error-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Live
            </span>
            <span className="truncate rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-medium text-white/85">
              {scopeLabel}
            </span>
          </div>
          <p className="truncate text-sm font-semibold text-white drop-shadow">{session.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ViewerCountBadge count={viewerCount} />
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-medium text-white"
          >
            {muted ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            onClick={handleLeave}
            className="rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-medium text-white"
            aria-label="Leave live"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <LiveChatPanel tenantSlug={tenantSlug} sessionId={session.id} overlay />
          </div>
          <button
            type="button"
            disabled={liking}
            onClick={toggleLike}
            className="mb-0.5 flex flex-col items-center gap-1 rounded-full px-1 py-1 text-white"
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

      {errorMessage && (
        <div className="absolute inset-x-3 top-20 z-30 rounded-md border-l-4 border-error-600 bg-error-100 px-4 py-3 text-sm text-error-700">
          {errorMessage}
        </div>
      )}
    </LiveFullscreenShell>
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
  const [composing, setComposing] = useState(false);
  const [composerBox, setComposerBox] = useState({ bottom: 0, left: 0, width: 0 });
  const [portalReady, setPortalReady] = useState(false);
  const lastStampRef = useRef<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const sendingLockRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);
  const compactInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let timer: ReturnType<typeof setInterval> | undefined;
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
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (/not found|ended|Access Denied/i.test(message)) {
          cancelled = true;
          if (timer) clearInterval(timer);
        }
      } finally {
        inFlight = false;
      }
    }

    void pull();
    timer = setInterval(pull, 2000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [tenantSlug, sessionId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [comments]);

  useEffect(() => {
    if (!composing) return;

    const vv = window.visualViewport;
    const sync = () => {
      // Pin the composer to the visible viewport so it never overflows/zooms off-screen.
      if (!vv) {
        setComposerBox({ bottom: 0, left: 0, width: window.innerWidth });
        return;
      }
      const bottom = Math.max(0, window.innerHeight - vv.offsetTop - vv.height);
      setComposerBox({
        bottom,
        left: vv.offsetLeft,
        width: vv.width,
      });
      window.scrollTo(0, 0);
    };

    sync();
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
    };
  }, [composing]);

  function openComposer() {
    // Mount + focus in the same tap so iOS opens the keyboard immediately.
    flushSync(() => {
      setComposerBox({
        bottom: 0,
        left: window.visualViewport?.offsetLeft ?? 0,
        width: window.visualViewport?.width ?? window.innerWidth,
      });
      setComposing(true);
    });
    overlayInputRef.current?.focus({ preventScroll: true });
  }

  function closeComposer() {
    setComposing(false);
  }

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
      overlayInputRef.current?.focus({ preventScroll: true });
    } catch {
      setDraft(content);
    } finally {
      sendingLockRef.current = false;
      setSubmitting(false);
    }
  }

  if (overlay) {
    const composer =
      composing && portalReady
        ? createPortal(
            <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
              <button
                type="button"
                aria-label="Close keyboard"
                className="pointer-events-auto absolute inset-0 bg-black/25"
                onClick={closeComposer}
              />
              <div
                className="pointer-events-auto fixed box-border border-t border-neutral-200 bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.18)]"
                style={{
                  left: composerBox.left,
                  width: composerBox.width || "100%",
                  bottom: composerBox.bottom,
                  maxWidth: "100vw",
                }}
              >
                <form
                  onSubmit={handleSend}
                  className="mx-auto flex w-full max-w-xl items-center gap-2 px-3 py-2"
                  style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
                >
                  <input
                    ref={overlayInputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={280}
                    enterKeyHint="send"
                    autoComplete="off"
                    autoCorrect="off"
                    placeholder="Type..."
                    // 16px prevents iOS page-zoom on focus (which hid the send button).
                    className="min-w-0 flex-1 rounded-full border border-neutral-200 bg-neutral-100 px-3.5 py-2.5 text-neutral-900 outline-none placeholder:text-neutral-500 focus:border-neutral-300"
                    style={{ fontSize: 16 }}
                  />
                  <button
                    type="submit"
                    disabled={submitting || !draft.trim()}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white disabled:opacity-40"
                    aria-label="Send comment"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>,
            document.body
          )
        : null;

    return (
      <>
        <div className="flex max-w-full flex-col gap-2">
          {!composing && (
            <>
              <div
                ref={listRef}
                className="relative flex h-48 max-w-[90%] flex-col justify-end overflow-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{
                  maskImage: "linear-gradient(to bottom, transparent 0%, black 28%, black 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, transparent 0%, black 28%, black 100%)",
                }}
              >
                <div className="flex flex-col justify-end gap-1.5">
                  {comments.slice(-8).map((comment, index, list) => {
                    // Newest at bottom; older rows fade as they rise.
                    const age = list.length - 1 - index;
                    const opacity = Math.max(0.2, 1 - age * 0.14);
                    return (
                      <p
                        key={comment.id}
                        className="text-xs leading-snug text-white drop-shadow transition-opacity duration-300"
                        style={{ opacity }}
                      >
                        <span className="font-semibold">{comment.authorName}</span>{" "}
                        <span className="text-white/90">{comment.content}</span>
                      </p>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={openComposer}
                className="w-full rounded-full border border-white/25 bg-black/35 px-3.5 py-2.5 text-left text-sm text-white/55 backdrop-blur-sm"
              >
                Type...
              </button>
            </>
          )}
          {composing && (
            <div
              ref={listRef}
              className="relative flex h-28 max-w-[90%] flex-col justify-end overflow-hidden"
              style={{
                maskImage: "linear-gradient(to bottom, transparent 0%, black 35%, black 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0%, black 35%, black 100%)",
              }}
            >
              <div className="flex flex-col justify-end gap-1.5">
                {comments.slice(-5).map((comment, index, list) => {
                  const age = list.length - 1 - index;
                  const opacity = Math.max(0.25, 1 - age * 0.18);
                  return (
                    <p
                      key={comment.id}
                      className="text-xs leading-snug text-white drop-shadow"
                      style={{ opacity }}
                    >
                      <span className="font-semibold">{comment.authorName}</span>{" "}
                      <span className="text-white/90">{comment.content}</span>
                    </p>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {composer}
      </>
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
          ref={compactInputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={280}
          enterKeyHint="send"
          autoComplete="off"
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
