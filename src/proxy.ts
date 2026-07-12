import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes: landing, auth, invite redeem lookup, and inbound webhooks
// (webhooks authenticate via signature verification, not Clerk sessions).
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/invite(.*)",
  "/explore-schools(.*)",
  "/api/invites(.*)",
  "/api/webhooks(.*)",
]);

export const proxy = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
