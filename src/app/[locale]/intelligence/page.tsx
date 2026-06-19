import IntelligenceExplorerClient from "./IntelligenceExplorerClient";
import { getSessionUser } from "@/lib/auth";

export default async function IntelligenceExplorerPage() {
  const user = await getSessionUser();
  return <IntelligenceExplorerClient plan={user?.plan ?? "FREE"} />;
}
