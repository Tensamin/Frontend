// Package Imports
import { JetBrains_Mono } from "next/font/google";

// Context Imports
import { CryptoProvider } from "@/components/context/crypto";

// Components
import { LoadingWrapper } from "@/components/loading/wrapper";
import "./globals.css";

// Main
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
})

export let metadata = {
  title: "Tensamin",
  description: "",
};

export default async function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jetbrainsMono.variable} antialiased`}>
          <CryptoProvider>
            <LoadingWrapper>
              {children}
            </LoadingWrapper>
          </CryptoProvider>
      </body>
    </html>
  );
}
