import Link from "next/link";

const SUPPORT_EMAIL = "support@skolaalumni.app";

const FAQ_SECTIONS: { heading: string; items: { q: string; a: string }[] }[] = [
  {
    heading: "Getting Started",
    items: [
      {
        q: "How do I join my alumni association?",
        a: "Find your school under \"Explore Schools\" from the sign-up page and request to join. An admin from your association needs to approve your request before you get access.",
      },
      {
        q: "Why is my account still pending?",
        a: "Your association's admin reviews join requests manually. If it's been a while, reach out to them directly — they can approve you from their admin dashboard.",
      },
    ],
  },
  {
    heading: "Groups",
    items: [
      {
        q: "How do I create a group?",
        a: "Go to the Groups tab and tap \"Create Group.\" You'll automatically become that group's owner.",
      },
      {
        q: "What's the security question when joining a group?",
        a: "Some groups (like class sets) ask a question only real members would know, e.g. a former teacher's name. It's reviewed by the group's admins when approving your request — it isn't checked automatically.",
      },
      {
        q: "How do I leave a group, or hand it off to someone else?",
        a: "Open the group, tap its header to open Group Info, and you'll find a Leave Group button there. If you're the owner, transfer ownership to another member first from the Members list before you can leave.",
      },
      {
        q: "Can other people help me manage my group?",
        a: "Yes — as the group owner, open Group Info, find the member in the Members list, and promote them to Admin.",
      },
    ],
  },
  {
    heading: "Dues & Payments",
    items: [
      {
        q: "How do I pay my dues?",
        a: "Dues payments happen outside the app (e.g. bank transfer) using the details your association provides. After paying, upload a screenshot of your payment as a receipt on the Dues tab — your treasurer will verify it.",
      },
      {
        q: "My receipt hasn't been verified yet — what do I do?",
        a: "Verification is done manually by your association's treasurer or admin. If it's been a while, reach out to them directly.",
      },
    ],
  },
  {
    heading: "Profile & Privacy",
    items: [
      {
        q: "Who can see my phone number or email?",
        a: "Nobody, by default. You control this from your Profile page under Privacy — toggle on \"Show phone number\" or \"Show email address\" if you want them visible on your directory card.",
      },
      {
        q: "How do I change my profile photo?",
        a: "Go to Profile and tap your photo to upload a new one.",
      },
    ],
  },
  {
    heading: "Notifications",
    items: [
      {
        q: "I'm not getting push notifications.",
        a: "Make sure you've allowed notifications when prompted, and that you've installed the app to your home screen for the most reliable delivery.",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/" className="text-xs font-medium text-neutral-500 hover:text-neutral-700">
          ← Skola Alumni
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-neutral-900">Help &amp; FAQ</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Answers to common questions. For anything specific to your association — approvals, dues,
          or group management — your best first stop is your association&apos;s admin.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {FAQ_SECTIONS.map((section) => (
          <section key={section.heading} className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-neutral-900">{section.heading}</h2>
            <div className="flex flex-col gap-3">
              {section.items.map((item) => (
                <div key={item.q} className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-neutral-900">{item.q}</p>
                  <p className="mt-1 text-sm text-neutral-700">{item.a}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-900">Still need help?</h2>
        <p className="mt-1 text-sm text-neutral-700">
          For anything about your association — membership, dues, or groups — contact your
          association&apos;s admin directly. For account or app issues, reach us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary-600 hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>
    </main>
  );
}
