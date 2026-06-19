import ValidationClient from "./ValidationClient";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

export default async function ValidationPage() {
  const user = await getSessionUser();
  const isAdmin = user ? isAdminEmail(user.email) : false;
  return <ValidationClient isAdmin={isAdmin} />;
}
