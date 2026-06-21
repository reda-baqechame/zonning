import IntelligenceExplorerClient from "./IntelligenceExplorerClient";
import { getSessionUser } from "@/lib/auth";
import { getEffectivePlan } from "@/lib/plans";

export default async function IntelligenceExplorerPage() {
  const user = await getSessionUser();
  return <IntelligenceExplorerClient plan={getEffectivePlan(user?.plan)} />;
}
