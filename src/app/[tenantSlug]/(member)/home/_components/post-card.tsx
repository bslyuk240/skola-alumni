"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, MessageCircle, Flag, Play, X } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

/** Cloudinary video URLs always contain this path segment; images use /image/upload/ instead. */
function isVideoUrl(url: string) {
  return url.includes("/video/upload/");
}

export interface PostComment {
  id: string;
  authorName: string;
  content: string;
}

export interface PostCardData {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  type: "POST" | "BUSINESS_ADVERT";
  content: string;
  mediaUrl: string | null;
  createdAtLabel: string;
  likeCount: number;
  likedByMe: boolean;
  comments: PostComment[];
}

export function PostCard({ tenantSlug, post }: { tenantSlug: string; post: PostCardData }) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(post.comments);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const mediaIsVideo = post.mediaUrl ? isVideoUrl(post.mediaUrl) : false;

  async function handleLike() {
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
    try {
      await fetchJson(`/api/tenants/${tenantSlug}/posts/${post.id}/react`, { method: "POST" });
    } catch {
      setLiked((prev) => !prev);
      setLikeCount((prev) => (liked ? prev + 1 : prev - 1));
    }
  }

  async function handleReport() {
    if (flagged) return;
    setFlagged(true);
    try {
      await fetchJson(`/api/tenants/${tenantSlug}/posts/${post.id}/report`, { method: "POST" });
    } catch {
      setFlagged(false);
    }
  }

  async function handleCommentSubmit(event: FormEvent) {
    event.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      await fetchJson(`/api/tenants/${tenantSlug}/posts/${post.id}/comments`, {
        method: "POST",
        body: { content: newComment },
      });
      setComments((prev) => [...prev, { id: `local-${Date.now()}`, authorName: "You", content: newComment }]);
      setNewComment("");
      router.refresh();
    } finally {
      setSubmittingComment(false);
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Link
          href={`/${tenantSlug}/profile/${post.authorId}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-xs font-semibold text-primary-700"
        >
          {post.authorAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.authorAvatarUrl} alt={post.authorName} className="h-full w-full object-cover" />
          ) : (
            post.authorName
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/${tenantSlug}/profile/${post.authorId}`} className="truncate text-sm font-semibold text-neutral-900 hover:underline">
            {post.authorName}
          </Link>
          <p className="text-xs text-neutral-500">{post.createdAtLabel}</p>
        </div>
        {post.type === "BUSINESS_ADVERT" && (
          <span className="shrink-0 rounded-full bg-secondary-100 px-2 py-0.5 text-[10px] font-semibold text-secondary-800">
            Business
          </span>
        )}
      </div>

      <p className="whitespace-pre-wrap text-sm text-neutral-900">{post.content}</p>

      {post.mediaUrl && (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="relative block aspect-video w-full overflow-hidden rounded-md bg-neutral-100"
        >
          {mediaIsVideo ? (
            <>
              <video src={post.mediaUrl} className="h-full w-full object-cover" muted playsInline />
              <span className="absolute inset-0 flex items-center justify-center bg-neutral-900/20">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90">
                  <Play className="ml-0.5 h-5 w-5 text-neutral-900" fill="currentColor" />
                </span>
              </span>
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.mediaUrl} alt="Post attachment" className="h-full w-full object-cover" />
          )}
        </button>
      )}

      {lightboxOpen && post.mediaUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/90 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          {mediaIsVideo ? (
            <video
              src={post.mediaUrl}
              className="max-h-full max-w-full rounded-md"
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.mediaUrl}
              alt="Post attachment"
              className="max-h-full max-w-full rounded-md object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      <div className="flex items-center gap-4 border-t border-neutral-100 pt-2">
        <button
          type="button"
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-xs font-medium ${liked ? "text-error-600" : "text-neutral-500 hover:text-neutral-700"}`}
        >
          <Heart className="h-4 w-4" fill={liked ? "currentColor" : "none"} strokeWidth={1.75} />
          {likeCount > 0 ? likeCount : "Like"}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((prev) => !prev)}
          className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700"
        >
          <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
          {comments.length > 0 ? comments.length : "Comment"}
        </button>
        <button
          type="button"
          onClick={handleReport}
          disabled={flagged}
          className="ml-auto flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-error-600 disabled:text-error-600"
        >
          <Flag className="h-3.5 w-3.5" strokeWidth={1.75} />
          {flagged ? "Flagged" : "Report"}
        </button>
      </div>

      {showComments && (
        <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-md bg-neutral-50 px-3 py-2 text-xs">
              <span className="font-semibold text-neutral-900">{comment.authorName}</span>{" "}
              <span className="text-neutral-700">{comment.content}</span>
            </div>
          ))}
          <form onSubmit={handleCommentSubmit} className="flex gap-2">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="input flex-1"
            />
            <button
              type="submit"
              disabled={submittingComment || !newComment.trim()}
              className="rounded-md bg-primary-600 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
