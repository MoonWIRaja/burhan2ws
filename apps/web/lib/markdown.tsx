import React from "react";

/**
 * Parse markdown-like text and return React elements
 * Handles: **bold**, *italic*, `code`, and line breaks
 * Simple and robust - only renders complete markdown pairs
 */
export function formatMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // Check for **bold** - must be complete pair, no newlines inside
    const boldMatch = remaining.match(/^\*\*([^\*\n]+?)\*\*/);
    if (boldMatch) {
      parts.push(React.createElement("strong", { key: keyIndex++ }, boldMatch[1]));
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Check for *italic* - must be complete pair, no newlines inside
    // Negative lookbehind to avoid matching part of **bold**
    const italicMatch = remaining.match(/^\*(?!\*)([^\*\n]+?)\*(?!\*)/);
    if (italicMatch) {
      parts.push(React.createElement("em", { key: keyIndex++ }, italicMatch[1]));
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Check for `code` - must be complete pair, no newlines inside
    const codeMatch = remaining.match(/^`([^`\n]+?)`/);
    if (codeMatch) {
      parts.push(React.createElement("code", {
        key: keyIndex++,
        className: "bg-black/10 dark:bg-white/20 px-1.5 py-0.5 rounded text-xs font-mono"
      }, codeMatch[1]));
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Check for newline
    if (remaining.startsWith("\n")) {
      parts.push(React.createElement("br", { key: keyIndex++ }));
      remaining = remaining.slice(1);
      continue;
    }

    // Take one character
    parts.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return React.createElement(React.Fragment, {}, ...parts);
}
