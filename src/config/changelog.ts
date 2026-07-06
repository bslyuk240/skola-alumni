export interface ChangelogEntry {
  version: string;
  date: string;
  items: string[];
}

// Bump this alongside a new entry below whenever you ship something worth telling users about.
// ChangelogBanner shows the top entry once per version, keyed off this string in localStorage.
export const APP_VERSION = "0.2.0";

// Newest first.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.2.0",
    date: "2026-07-06",
    items: [
      "Members can create their own groups and delegate admin roles",
      "Leave a group or transfer ownership to another member",
      "Optional security question when requesting to join a group",
      "Fixed photo/video uploads failing on feed posts",
    ],
  },
];
