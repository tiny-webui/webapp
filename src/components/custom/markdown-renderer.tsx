"use client";

import React, { type DetailedHTMLProps, type HTMLAttributes, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypePrism from 'rehype-prism-plus';
import rehypeKatex from 'rehype-katex';

import { cn, copyToClipboard } from "@/lib/utils";

import './github-markdown.css';
import './prism-ghcolors-auto.css';
import "katex/dist/katex.min.css";

function NormalizeMathTags(input: string): string {
  /** {@link https://www.assistant-ui.com/docs/guides/Latex}  */
  return (
    input
      /** Convert [/math]...[/math] to $$...$$ */
      .replace(/\[\/math\]([\s\S]*?)\[\/math\]/g, (_, content) => `$$${content}$$`)
      /** Convert [/inline]...[/inline] to $...$ */
      .replace(/\[\/inline\]([\s\S]*?)\[\/inline\]/g, (_, content) => `$${content}$`)
      /** Convert \( ... \) to $...$ (inline math) - handles both single and double backslashes */
      .replace(/\\{1,2}\(([\s\S]*?)\\{1,2}\)/g, (_, content) => `$${content}$`)
      /** Convert \[ ... \] to $$...$$ (block math) - handles both single and double backslashes */
      .replace(/\\{1,2}\[([\s\S]*?)\\{1,2}\]/g, (_, content) => `$$${content}$$`)
  );
}

function extractText(node: React.ReactNode): string {
  return React.Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }
      if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.props?.children) {
        return extractText(child.props.children);
      }
      return "";
    })
    .join("");
}

function ensureLanguageClass(className?: string) {
  if (!className) {
    return "language-plaintext";
  }
  return className.split(" ").some((cls) => cls.startsWith("language-"))
    ? className
    : `${className} language-plaintext`;
}

function CodeBlockPre({
  className,
  children,
  ...props
}: DetailedHTMLProps<HTMLAttributes<HTMLPreElement>, HTMLPreElement>) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const codeText = useMemo(() => extractText(children).replace(/\n$/, ""), [children]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await copyToClipboard(codeText);
      setCopied(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error("Failed to copy code block", error);
    }
  };

  const preClassName = ensureLanguageClass(className);
  const mappedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement<{ className?: string }>(child)) {
      return child;
    }
    const typedChild = child as React.ReactElement<{ className?: string }>;
    return React.cloneElement(typedChild, {
      className: ensureLanguageClass(typedChild.props.className),
    });
  });
  const normalizedChildren = mappedChildren ?? children;

  return (
    <div className="relative group border-0">
      <button
        type="button"
        aria-label={copied ? "Copied" : "Copy code"}
        onClick={handleCopy}
        className={cn(
          "absolute right-2 top-2 rounded-md border border-border/50 bg-background/80 px-2 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          copied ? "text-green-600 scale-105 animate-pulse" : "hover:text-foreground hover:-translate-y-0.5",
          codeText ? "opacity-100" : "hidden"
        )}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        <span className="sr-only">{copied ? "Copied" : "Copy code"}</span>
      </button>
      <pre {...props} className={preClassName}>
        {normalizedChildren}
      </pre>
    </div>
  );
}

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div
      className="markdown-body"
      style={{ backgroundColor: 'transparent' }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[[rehypePrism, { ignoreMissing: true }], rehypeKatex]}
        components={{
          ul: (props) => <ul className="list-disc" {...props} />,
          ol: (props) => <ol className="list-decimal" {...props} />,
          pre: CodeBlockPre,
        }}
      >
        {NormalizeMathTags(content)}
      </ReactMarkdown>
    </div>
  )
}
