import { ClerkProvider } from "@clerk/nextjs";
import { AppToaster } from "@/components/app-toaster";
import { DataProvider } from "@/components/data-provider";
import { isClerkConfigured } from "@/lib/server-config";

const appearance = {
  variables: {
    colorPrimary: "#245c45",
    colorBackground: "#f7f3ea",
    colorText: "#24352d",
    borderRadius: "0.8rem",
    fontFamily: "var(--font-sans)",
  },
};

export function RootProviders({ children }: { children: React.ReactNode }) {
  const clerkReady = isClerkConfigured();
  const content = (
    <DataProvider auth={clerkReady}>
      {children}
      <AppToaster />
    </DataProvider>
  );
  if (!clerkReady) return content;
  return <ClerkProvider appearance={appearance}>{content}</ClerkProvider>;
}
