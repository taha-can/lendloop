"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexProvider } from "convex/react";
import { useState } from "react";
import { convexUrl } from "@/lib/public-config";

function useConvex(url: string) {
  const [client] = useState(() => new ConvexReactClient(url));
  return client;
}

export function DataProvider({
  auth,
  children,
}: {
  auth: boolean;
  children: React.ReactNode;
}) {
  const url = convexUrl();
  if (!url) return children;
  if (auth) {
    return <AuthedConvex url={url}>{children}</AuthedConvex>;
  }
  return <PublicConvex url={url}>{children}</PublicConvex>;
}

function PublicConvex({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  const client = useConvex(url);
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}

function AuthedConvex({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  const client = useConvex(url);
  return (
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
