/**
 * Paystack may return metadata as a plain object, a JSON string, or with values only under
 * `custom_fields[]`. Normalize to the flat keys we send at checkout.
 */
export function parsePaystackMetadata(raw: unknown): {
  tenantId?: string;
  tenantSlug?: string;
  planName?: string;
  billingCycle?: "MONTHLY" | "YEARLY";
} {
  let meta: unknown = raw;

  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta);
    } catch {
      return {};
    }
  }

  if (!meta || typeof meta !== "object") return {};

  const obj = { ...(meta as Record<string, unknown>) };

  if (Array.isArray(obj.custom_fields)) {
    for (const field of obj.custom_fields) {
      if (!field || typeof field !== "object") continue;
      const row = field as { variable_name?: string; value?: unknown };
      if (row.variable_name && row.value != null && obj[row.variable_name] == null) {
        obj[row.variable_name] = row.value;
      }
    }
  }

  const tenantId = stringify(obj.tenantId ?? obj.tenant_id);
  const tenantSlug = stringify(obj.tenantSlug ?? obj.tenant_slug);
  const planName = stringify(obj.planName ?? obj.plan_name);
  const billingCycleRaw = stringify(obj.billingCycle ?? obj.billing_cycle);
  const billingCycle =
    billingCycleRaw === "MONTHLY" || billingCycleRaw === "YEARLY" ? billingCycleRaw : undefined;

  return { tenantId, tenantSlug, planName, billingCycle };
}

function stringify(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}
