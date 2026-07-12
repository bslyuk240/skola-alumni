/**
 * WHIP publisher + WHEP player for Cloudflare Stream WebRTC live.
 * Aligned with Cloudflare's WHIP/WHEP browser examples (bundle + track accumulation).
 */

function resolveResourceUrl(locationHeader: string | null, endpointUrl: string): string | null {
  if (!locationHeader) return null;
  try {
    return new URL(locationHeader, endpointUrl).toString();
  } catch {
    return locationHeader;
  }
}

function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 5000) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();

  return new Promise<void>((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    pc.addEventListener("icegatheringstatechange", onChange);
    setTimeout(done, timeoutMs);
  });
}

async function postSdp(endpointUrl: string, sdp: string) {
  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: sdp,
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 180);
    throw new Error(
      `WebRTC handshake failed (${response.status})${detail ? `: ${detail}` : ""}`
    );
  }

  return {
    resourceUrl: resolveResourceUrl(response.headers.get("Location"), endpointUrl),
    answerSdp: await response.text(),
  };
}

/** WHIP — host camera → Cloudflare. */
export class WhipPublisher {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private resourceUrl: string | null = null;

  constructor(
    private publishUrl: string,
    private videoElement: HTMLVideoElement
  ) {}

  async start() {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        facingMode: "user",
        width: { ideal: 720 },
        height: { ideal: 1280 },
      },
    });

    this.videoElement.srcObject = this.localStream;
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;
    await this.videoElement.play().catch(() => undefined);

    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
      bundlePolicy: "max-bundle",
    });

    for (const track of this.localStream.getTracks()) {
      this.pc.addTrack(track, this.localStream);
    }

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await waitForIceGathering(this.pc);

    const localSdp = this.pc.localDescription?.sdp ?? offer.sdp;
    if (!localSdp) throw new Error("Missing local SDP for publish");

    const { resourceUrl, answerSdp } = await postSdp(this.publishUrl, localSdp);
    this.resourceUrl = resourceUrl;
    await this.pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  }

  async stop() {
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;

    if (this.resourceUrl) {
      await fetch(this.resourceUrl, { method: "DELETE" }).catch(() => undefined);
      this.resourceUrl = null;
    }

    this.pc?.close();
    this.pc = null;
    this.videoElement.srcObject = null;
  }
}

/** WHEP — Cloudflare → member viewer. */
export class WhepPlayer {
  private pc: RTCPeerConnection | null = null;
  private resourceUrl: string | null = null;
  private remoteStream = new MediaStream();

  constructor(
    private playUrl: string,
    private videoElement: HTMLVideoElement
  ) {}

  async start() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
      bundlePolicy: "max-bundle",
    });

    this.remoteStream = new MediaStream();

    this.videoElement.srcObject = this.remoteStream;
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;

    this.pc.addTransceiver("video", { direction: "recvonly" });
    this.pc.addTransceiver("audio", { direction: "recvonly" });

    this.pc.ontrack = (event) => {
      // Always accumulate — Cloudflare may fire audio/video as separate track events
      // without a shared streams[0]. Replacing srcObject per track causes a black screen.
      for (const track of event.streams[0]?.getTracks() ?? [event.track]) {
        const already = this.remoteStream.getTracks().some((t) => t.id === track.id);
        if (!already) this.remoteStream.addTrack(track);
      }
      this.videoElement.srcObject = this.remoteStream;
      void this.videoElement.play().catch(() => undefined);
    };

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await waitForIceGathering(this.pc);

    const localSdp = this.pc.localDescription?.sdp ?? offer.sdp;
    if (!localSdp) throw new Error("Missing local SDP for playback");

    const { resourceUrl, answerSdp } = await postSdp(this.playUrl, localSdp);
    this.resourceUrl = resourceUrl;
    await this.pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    // Wait briefly for media — surface a clear error instead of a silent black frame.
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline && this.remoteStream.getVideoTracks().length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (this.remoteStream.getVideoTracks().length === 0) {
      throw new Error(
        "Connected to Cloudflare but no video arrived. Confirm the host camera is still publishing, then tap Join again."
      );
    }

    await this.videoElement.play().catch(() => undefined);
  }

  async stop() {
    if (this.resourceUrl) {
      await fetch(this.resourceUrl, { method: "DELETE" }).catch(() => undefined);
      this.resourceUrl = null;
    }
    this.remoteStream.getTracks().forEach((track) => track.stop());
    this.remoteStream = new MediaStream();
    this.pc?.close();
    this.pc = null;
    this.videoElement.srcObject = null;
  }
}
