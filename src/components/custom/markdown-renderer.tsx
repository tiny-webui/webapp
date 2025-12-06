import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypePrism from 'rehype-prism-plus';
import rehypeKatex from 'rehype-katex';

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
        }}
      >
        {NormalizeMathTags(content)}
      </ReactMarkdown>
    </div>
  )
}
