import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypePrism from 'rehype-prism-plus'

import 'prism-themes/themes/prism-vsc-dark-plus.css'

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      rehypePlugins={[rehypePrism]}
    >
      {content}
    </ReactMarkdown>
  )
}
