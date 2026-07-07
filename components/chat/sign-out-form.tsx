import Form from "next/form";

import { signOut } from "@/app/(auth)/auth";

export const SignOutForm = () => (
  <Form
    action={async () => {
      "use server";

      await signOut({
        redirectTo: "/",
      });
    }}
    className="w-full"
  >
    <button className="w-full px-1 py-0.5 text-left text-red-500" type="submit">
      Sign out
    </button>
  </Form>
);
