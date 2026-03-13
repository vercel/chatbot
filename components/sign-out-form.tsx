import Form from "next/form";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const SignOutForm = () => {
  return (
    <Form
      action={async () => {
        "use server";

        await auth.api.signOut({
          headers: await headers(),
        });

        redirect("/");
      }}
      className="w-full"
    >
      <button
        className="w-full px-1 py-0.5 text-left text-red-500"
        type="submit"
      >
        Sign out
      </button>
    </Form>
  );
};
