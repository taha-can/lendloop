import { SignIn } from "@clerk/nextjs";
import { SetupNotice } from "@/components/setup-notice";
import { isClerkConfigured } from "@/lib/server-config";

export default function SignInPage() {
  return (
    <main
      id="content"
      className="flex flex-1 items-center justify-center px-4 py-12"
    >
      {isClerkConfigured() ? <SignIn /> : <SetupNotice topic="sign-in" />}
    </main>
  );
}
