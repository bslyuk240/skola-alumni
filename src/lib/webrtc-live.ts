/**
 * Minimal WHIP publisher — getUserMedia → RTCPeerConnection → POST SDP to Cloudflare.
 * Based on Cloudflare Stream WebRTC (WHIP) browser publish flow.
 */
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
      video: { facingMode: "user" },
    });

    this.videoElement.srcObject = this.localStream;
    await this.videoElement.play().catch(() => undefined);

    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
    });

    for (const track of this.localStream.getTracks()) {
      this.pc.addTrack(track, this.localStream);
    }

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await waitForIceGathering(this.pc);

    const response = await fetch(this.publishUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/sdp",
      },
      body: this.pc.localDescription?.sdp ?? offer.sdp,
    });

    if (!response.ok) {
      throw new Error(`WHIP publish failed (${response.status})`);
    }

    this.resourceUrl = response.headers.get("Location");
    const answerSdp = await response.text();
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

/**
 * Minimal WHEP viewer — recvonly RTCPeerConnection → POST SDP to Cloudflare playback URL.
 */
export class WhepPlayer {
  private pc: RTCPeerConnection | null = null;
  private resourceUrl: string | null = null;

  constructor(
    private playUrl: string,
    private videoElement: HTMLVideoElement
  ) {}

  async start() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
    });

    this.pc.addTransceiver("video", { direction: "recvonly" });
    this.pc.addTransceiver("audio", { direction: "recvonly" });

    this.pc.ontrack = (event) => {
      if (this.videoElement.srcObject !== event.streams[0]) {
        this.videoElement.srcObject = event.streams[0];
        void this.videoElement.play().catch(() => undefined);
      }
    };

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await waitForIceGathering(this.pc);

    const response = await fetch(this.playUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/sdp",
      },
      body: this.pc.localDescription?.sdp ?? offer.sdp,
    });

    if (!response.ok) {
      throw new Error(`WHEP play failed (${response.status})`);
    }

    this.resourceUrl = response.headers.get("Location");
    const answerSdp = await response.text();
    await this.pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  }

  async stop() {
    if (this.resourceUrl) {
      await fetch(this.resourceUrl, { method: "DELETE" }).catch(() => undefined);
      this.resourceUrl = null;
    }
    this.pc?.close();
    this.pc = null;
    this.videoElement.srcObject = null;
  }
}

function waitForIceGathering(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();

  return new Promise<void>((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", check);
    // Fallback — some browsers stall in "gathering"
    setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    }, 2000);
  });
}
