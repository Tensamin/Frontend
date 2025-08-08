// Package Imports
import { JetBrains_Mono } from "next/font/google";
import { Partytown } from "@qwik.dev/partytown/react";

// Components
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

// suppressHydrationWarning
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <Partytown debug={true} forward={["dataLayer.push"]} />
      </head>
      <body className={`${jetbrainsMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
