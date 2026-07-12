import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim();
  const customerCode = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim();

  console.log("Present:", {
    CLOUDFLARE_ACCOUNT_ID: Boolean(accountId) && (accountId?.length ?? 0) > 8,
    CLOUDFLARE_STREAM_API_TOKEN: Boolean(token) && (token?.length ?? 0) > 8,
    CLOUDFLARE_STREAM_CUSTOMER_CODE: Boolean(customerCode) && (customerCode?.length ?? 0) > 3,
    accountIdPrefix: accountId ? `${accountId.slice(0, 8)}...` : null,
    customerCodePrefix: customerCode ? `${customerCode.slice(0, 6)}...` : null,
    customerLooksLikeFullHost: customerCode?.startsWith("customer-") ?? false,
  });

  if (!accountId || !token) {
    console.error("FAIL: missing account id or token");
    process.exit(1);
  }

  const verify = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const verifyBody = (await verify.json()) as {
    success?: boolean;
    result?: { status?: string };
    errors?: { code: number; message: string }[];
  };

  console.log("Token verify:", {
    http: verify.status,
    success: verifyBody.success,
    status: verifyBody.result?.status,
    errors: verifyBody.errors ?? [],
  });

  const live = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs?per_page=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const liveBody = (await live.json()) as {
    success?: boolean;
    result?: unknown[];
    errors?: { code: number; message: string }[];
  };

  console.log("Live inputs list:", {
    http: live.status,
    success: liveBody.success,
    errors: liveBody.errors ?? [],
    resultCount: Array.isArray(liveBody.result) ? liveBody.result.length : null,
  });

  if (!verifyBody.success || !liveBody.success) {
    process.exit(1);
  }

  console.log("OK: Cloudflare Stream API reachable with these credentials");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
