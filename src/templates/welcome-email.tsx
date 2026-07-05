interface WelcomeEmailProps {
  recipientName: string;
  tenantName: string;
  homeUrl: string;
}

/** Sent when a member's tenant_membership is approved. Rendered via `react` in resend.emails.send(). */
export function WelcomeEmail({ recipientName, tenantName, homeUrl }: WelcomeEmailProps) {
  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: "#0F172A", maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: "#14325C" }}>
        Welcome to {tenantName} on Skola Alumni
      </h1>
      <p>Hi {recipientName},</p>
      <p>
        Your membership request has been verified — you now have full access to your association&rsquo;s
        directory, dues, groups, and announcements.
      </p>
      <a
        href={homeUrl}
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
        Open Your Workspace
      </a>
      <p style={{ marginTop: 24, fontSize: 12, color: "#64748B" }}>
        You&rsquo;re receiving this because an administrator approved your membership request.
      </p>
    </div>
  );
}
