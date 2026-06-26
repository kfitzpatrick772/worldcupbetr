"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={`shrink-0 rounded-lg px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
        copied ? "bg-lime/20 text-lime" : "bg-lime text-black hover:opacity-90"
      }`}
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}
