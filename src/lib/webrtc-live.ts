/**
 * WHIP publisher + WHEP player for Cloudflare Stream WebRTC live.
 * Aligned with Cloudflare's WHIP/WHEP browser examples (bundle + track accumulation).
 */

export type CameraFacing = "user" | "environment";

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

async function getCameraStream(
  facingMode: CameraFacing,
  withAudio: boolean,
  options?: { forSwitch?: boolean }
) {
  const forSwitch = options?.forSwitch ?? false;

  if (forSwitch) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: withAudio,
        video: { facingMode: { ideal: facingMode } },
      });
    } catch (firstError) {
      const fallback = await getCameraStreamByDevice(facingMode, withAudio);
      if (fallback) return fallback;
      throw firstError;
    }
  }

  const videoBase = {
    width: { ideal: 720 },
    height: { ideal: 1280 },
    aspectRatio: { ideal: 9 / 16 },
  };

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: withAudio,
      video: { ...videoBase, facingMode: { ideal: facingMode } },
    });
  } catch (firstError) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: withAudio,
        video: { ...videoBase, facingMode: { exact: facingMode } },
      });
    } catch {
      const fallback = await getCameraStreamByDevice(facingMode, withAudio);
      if (fallback) return fallback;
      throw firstError;
    }
  }
}

async function getCameraStreamByDevice(facingMode: CameraFacing, withAudio: boolean) {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((device) => device.kind === "videoinput");
  if (cameras.length < 2) return null;

  const label = (device: MediaDeviceInfo) => device.label.toLowerCase();
  const pick =
    facingMode === "environment"
      ? cameras.find(
          (device) =>
            label(device).includes("back") ||
            label(device).includes("rear") ||
            label(device).includes("environment")
        ) ?? cameras[cameras.length - 1]
      : cameras.find(
          (device) =>
            label(device).includes("front") ||
            label(device).includes("user") ||
            label(device).includes("selfie")
        ) ?? cameras[0];

  return navigator.mediaDevices.getUserMedia({
    audio: withAudio,
    video: { deviceId: { exact: pick.deviceId } },
  });
}

function waitForCameraRelease(ms = 200) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** WHIP — host camera → Cloudflare. */
export class WhipPublisher {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private resourceUrl: string | null = null;
  private facingMode: CameraFacing = "user";

  constructor(
    private publishUrl: string,
    private videoElement: HTMLVideoElement
  ) {}

  getFacingMode() {
    return this.facingMode;
  }

  async start(facingMode: CameraFacing = "user") {
    this.facingMode = facingMode;
    this.localStream = await getCameraStream(facingMode, true);

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

  /** Flip front ↔ back camera without restarting the WHIP session. */
  async switchCamera() {
    if (!this.pc || !this.localStream) {
      throw new Error("Camera is not publishing yet.");
    }

    const nextFacing: CameraFacing = this.facingMode === "user" ? "environment" : "user";
    const sender = this.pc.getSenders().find((item) => item.track?.kind === "video");
    if (!sender) throw new Error("No video sender to replace.");

    const oldVideoTrack = this.localStream.getVideoTracks()[0];

    // Release the current lens before opening the other — required on most phones.
    if (oldVideoTrack) {
      this.localStream.removeTrack(oldVideoTrack);
      oldVideoTrack.stop();
    }
    await waitForCameraRelease();

    let newVideoTrack: MediaStreamTrack | null = null;
    try {
      const replacement = await getCameraStream(nextFacing, false, { forSwitch: true });
      newVideoTrack = replacement.getVideoTracks()[0] ?? null;
      if (!newVideoTrack) {
        replacement.getTracks().forEach((track) => track.stop());
        throw new Error("Couldn't access the other camera.");
      }

      await sender.replaceTrack(newVideoTrack);
      this.localStream.addTrack(newVideoTrack);
      this.videoElement.srcObject = this.localStream;
      await this.videoElement.play().catch(() => undefined);
      this.facingMode = nextFacing;
    } catch (error) {
      // Try to restore the previous camera if flip failed.
      try {
        const restore = await getCameraStream(this.facingMode, false, { forSwitch: true });
        const restoredTrack = restore.getVideoTracks()[0];
        if (restoredTrack) {
          await sender.replaceTrack(restoredTrack);
          this.localStream.addTrack(restoredTrack);
          this.videoElement.srcObject = this.localStream;
          await this.videoElement.play().catch(() => undefined);
        } else {
          restore.getTracks().forEach((track) => track.stop());
        }
      } catch {
        // ignore restore failure
      }

      if (error instanceof DOMException && error.name === "NotReadableError") {
        throw new Error("Couldn't switch camera — try again in a moment.");
      }
      if (error instanceof Error) throw error;
      throw new Error("Couldn't switch camera. Try again.");
    }
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
