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

  const accountId = CLOUDFLARE_ACCOUNT_ID.trim().replace(/^["']|["']$/g, "");
  const token = CLOUDFLARE_STREAM_API_TOKEN.trim().replace(/^["']|["']$/g, "");

  if (!/^[a-f0-9]{32}$/i.test(accountId)) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID looks invalid. It should be the 32-character Account ID from the Cloudflare dashboard."
    );
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    }
  );

  const raw = await response.text();
  let body: CloudflareApiResponse<T> | null = null;
  try {
    body = JSON.parse(raw) as CloudflareApiResponse<T>;
  } catch {
    throw new Error(
      `Cloudflare Stream returned a non-JSON response (${response.status}). Check CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN in Vercel — values must not include quotes or extra spaces.`
    );
  }

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
