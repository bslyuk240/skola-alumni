// Shared between the client composer (for fast UX feedback) and the server (for authoritative
// enforcement) — keep this file free of server-only imports so it's safe in client components.
export const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_POST_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB
export const ALLOWED_POST_MEDIA_FORMATS = ["jpg", "jpeg", "png", "webp", "mp4", "webm", "mov", "quicktime"];
