"use client"

import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import * as theme from "react-syntax-highlighter/dist/cjs/styles/prism";
import * as Icon from "lucide-react";

import { Button } from "@/components/ui/button"

export function CodeBlock({ language, code }) {
  const [copied, setCopied] = React.useState(false);

  async function copyToClipboard() {
    if (code) {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative p-3 bg-background/45 rounded-2xl border pr-11">
      <Button
        className="absolute top-0 right-0 dark:hover:bg-border m-1.5 rounded-xl"
        variant="ghost"
        size="icon"
        onClick={copyToClipboard}
      >
        {copied ? <Icon.Check /> : <Icon.Clipboard />}
      </Button>
      <SyntaxHighlighter
        language={language}
        style={theme.atomDark}
        customStyle={{
          margin: 0,
          padding: 0,
          background: "transparent",
          fontSize: "0.875rem",
        }}
        wrapLines={true}
        showLineNumbers={true}
        PreTag="div">
        {String(code)}
      </SyntaxHighlighter>
    </div>
  );
};
