import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything is behind Clerk except the routes below. Next 16 renamed
// `middleware.ts` to `proxy.ts`; the export name is what changed, not the
// behaviour.
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Clerk calls this itself, before a session exists.
  "/__clerk/(.*)",
  // Called by Clerk's servers, not by a signed-in browser. It authenticates
  // with a Svix signature instead of a session — see the route handler.
  "/api/webhooks/clerk",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
