"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

const queryClient = new QueryClient();

export function ClientQueryClientProvider(props: PropsWithChildren) {
  return <QueryClientProvider client={queryClient} {...props} />;
}
