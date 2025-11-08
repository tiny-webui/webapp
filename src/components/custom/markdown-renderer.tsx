import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypePrism from 'rehype-prism-plus';
import rehypeKatex from 'rehype-katex';

import 'prism-themes/themes/prism-vsc-dark-plus.css';
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
      className="markdown text-sm whitespace-pre-wrap break-words"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[[rehypePrism, { ignoreMissing: true }], rehypeKatex]}
        components={{
          h1: (props) => <h1 className="text-2xl font-bold mt-5 mb-3" {...props} />,
          h2: (props) => <h2 className="text-xl font-semibold mt-4 mb-2" {...props} />,
          h3: (props) => <h3 className="text-lg font-semibold mt-3 mb-2" {...props} />,
          h4: (props) => <h4 className="text-base font-semibold mt-3 mb-2" {...props} />,
          p: (props) => <p className="my-2 leading-relaxed" {...props} />,
          ul: (props) => <ul className="list-disc pl-5 my-3 space-y-1" {...props} />,
          ol: (props) => <ol className="list-decimal pl-5 my-3 space-y-1" {...props} />,
          li: (props) => <li className="leading-relaxed" {...props} />,
          blockquote: (props) => (
            <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-3 italic my-3 text-[0.85rem]" {...props} />
          )
        }}
      >
        {NormalizeMathTags(content)}
      </ReactMarkdown>
    </div>
  )
}
