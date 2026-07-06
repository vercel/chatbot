import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        Organization account
      </h1>
      <p className="text-sm text-muted-foreground">
        Accounts are managed in Microsoft Entra ID.
      </p>
      <Button asChild className="h-10 w-full">
        <Link href="/login">Sign in with Microsoft</Link>
      </Button>
    </>
  );
}
