import { getPaystackEnv } from "@/config/env";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

interface InitializeTransactionArgs {
  email: string;
  amountKobo: number;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}

interface InitializeTransactionResponse {
  status: boolean;
  message: string;
  data: { authorization_url: string; access_code: string; reference: string };
}

export async function initializePaystackTransaction({
  email,
  amountKobo,
  callbackUrl,
  metadata,
}: InitializeTransactionArgs) {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getPaystackEnv().PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: amountKobo,
      callback_url: callbackUrl,
      // Flat keys + custom_fields so verify/webhook reliably return plan/tenant details.
      metadata: {
        ...metadata,
        custom_fields: Object.entries(metadata).map(([key, value]) => ({
          display_name: key,
          variable_name: key,
          value: String(value),
        })),
      },
    }),
  });

  const payload: InitializeTransactionResponse = await response.json();
  if (!response.ok || !payload.status) {
    throw new Error(payload.message || "Failed to initialize Paystack transaction");
  }

  return payload.data;
}

interface VerifyTransactionResponse {
  status: boolean;
  message: string;
  data: {
    status: "success" | "failed" | "abandoned";
    reference: string;
    amount: number;
    metadata: Record<string, unknown>;
  };
}

export async function verifyPaystackTransaction(reference: string) {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${getPaystackEnv().PAYSTACK_SECRET_KEY}` },
  });

  const payload: VerifyTransactionResponse = await response.json();
  if (!response.ok || !payload.status) {
    throw new Error(payload.message || "Failed to verify Paystack transaction");
  }

  return payload.data;
}
