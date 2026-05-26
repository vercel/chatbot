import { hasEntraAuthConfig } from "@/lib/auth-mode";
import { LoginForm } from "./login-form";

export default function Page() {
  return <LoginForm isEntraConfigured={hasEntraAuthConfig()} />;
}
