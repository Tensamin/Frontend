// Package Imports
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import "./globals.css";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";

// Context Imports
import { StorageProvider } from "@/context/storage";
import { PageProvider } from "@/context/page";

// Components
import { Loading } from "@/components/loading";
import { Toaster } from "@/components/ui/sonner";

// Main
export const metadata: Metadata = {
  title: "Tensamin",
  description:
    "True E2EE, decentralized messages. Open source and privacy first.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased max-h-screen overflow-hidden">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="theme"
        >
          <StorageProvider>
            <PageProvider>
              <Suspense fallback={<Loading />}>
                <Toaster position="top-right" richColors expand />
                {children}
              </Suspense>
            </PageProvider>
          </StorageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
