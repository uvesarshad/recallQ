"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function EmailAddressCopy({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 flex items-center gap-2 rounded-input border border-border-soft bg-surface-2 p-2">
      <code className="flex-1 px-2 text-xs font-mono text-text-primary truncate">
        {address}
      </code>
      <button
        onClick={copyToClipboard}
        className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-brand hover:text-brand-hover transition-colors"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </>
        )}
      </button>
    </div>
  );
}
