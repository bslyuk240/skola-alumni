interface PaymentConfirmedEmailProps {
  recipientName: string;
  dueTitle: string;
  amount: string;
  tenantName: string;
  duesUrl: string;
}

/** Sent when a treasurer approves a payment. Rendered via `react` in resend.emails.send(). */
export function PaymentConfirmedEmail({
  recipientName,
  dueTitle,
  amount,
  tenantName,
  duesUrl,
}: PaymentConfirmedEmailProps) {
  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: "#0F172A", maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: "#15803D" }}>Payment Confirmed</h1>
      <p>Hi {recipientName},</p>
      <p>
        Your payment of <strong>{amount}</strong> for <strong>{dueTitle}</strong> has been verified by{" "}
        {tenantName}&rsquo;s treasurer.
      </p>
      <a
        href={duesUrl}
        style={{
          display: "inline-block",
          marginTop: 16,
          padding: "10px 20px",
          borderRadius: 8,
          backgroundColor: "#1A3F73",
          color: "#FFFFFF",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        View Dues History
      </a>
      <p style={{ marginTop: 24, fontSize: 12, color: "#64748B" }}>
        This confirmation is part of your association&rsquo;s permanent payment record.
      </p>
    </div>
  );
}
