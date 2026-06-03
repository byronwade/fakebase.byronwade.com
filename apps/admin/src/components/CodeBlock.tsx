"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
  showCopy?: boolean;
  className?: string;
}

export function CodeBlock({
  code,
  language,
  showCopy = true,
  className = "",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={`relative group rounded-lg border border-gray-700 bg-gray-900 overflow-hidden ${className}`}
    >
      {(language || showCopy) && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          {language && (
            <span className="text-xs text-gray-400 font-mono">{language}</span>
          )}
          {showCopy && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors ml-auto"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-400" />
                  <span className="text-green-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-sm font-mono text-gray-300 leading-relaxed whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}
