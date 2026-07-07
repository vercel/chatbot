import Form from "next/form";

import { signOut } from "@/app/(auth)/auth";

async function signOutAction() {
  "use server";

  await signOut({
    redirectTo: "/",
  });
}

export const SignOutForm = () => (
  <Form action={signOutAction} className="w-full">
    <button className="w-full px-1 py-0.5 text-left text-red-500" type="submit">
      Sign out
    </button>
  </Form>
);
