import FeedPreviewClient from "./FeedPreviewClient";
import { getSessionUser } from "@/lib/auth";

/**
 * Public, read-only preview of the opportunity feed. First-time visitors land
 * here instead of the auth-locked /feed (which silently redirects to /login and
 * feels broken). Shows a sample of real permits + tenders with a sign-up CTA.
 */
export default async function FeedPreviewPage() {
  const user = await getSessionUser();
  return <FeedPreviewClient signedIn={Boolean(user)} />;
}
