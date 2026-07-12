import { getCloudflareStreamEnv } from "@/config/env";

interface CloudflareLiveInputResult {
  uid: string;
  webRTC?: { url?: string };
  webRTCPlayback?: { url?: string };
}

interface CloudflareApiResponse<T> {
  success: boolean;
  result?: T;
  errors?: { code: number; message: string }[];
}

async function streamFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_STREAM_API_TOKEN } = getCloudflareStreamEnv();

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    }
  );

  const body = (await response.json()) as CloudflareApiResponse<T>;

  if (!response.ok || !body.success || !body.result) {
    const message =
      body.errors?.[0]?.message ?? `Cloudflare Stream request failed (${response.status})`;
    throw new Error(message);
  }

  return body.result;
}

/** Creates a WebRTC live input and returns WHIP publish + WHEP playback URLs. */
export async function createCloudflareLiveInput(name: string) {
  const result = await streamFetch<CloudflareLiveInputResult>("/stream/live_inputs", {
    method: "POST",
    body: JSON.stringify({
      meta: { name },
      recording: { mode: "off" },
      deleteRecordingAfterDays: null,
    }),
  });

  const whipPublishUrl = result.webRTC?.url;
  const whepPlayUrl = result.webRTCPlayback?.url;

  if (!whipPublishUrl || !whepPlayUrl) {
    throw new Error(
      "Cloudflare did not return WebRTC publish/play URLs. Ensure Stream Live WebRTC is available on this account."
    );
  }

  return {
    liveInputId: result.uid,
    whipPublishUrl,
    whepPlayUrl,
  };
}

/** Stops accepting new publishes for a live input. */
export async function disableCloudflareLiveInput(liveInputId: string) {
  await streamFetch<CloudflareLiveInputResult>(`/stream/live_inputs/${liveInputId}`, {
    method: "PUT",
    body: JSON.stringify({ enabled: false }),
  });
}
