import { memo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

const components: Components = {
  table: ({ children }) => (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        if (href) void window.api.app.openExternal(href)
      }}
    >
      {children}
    </a>
  ),
  // Relative images can't be resolved safely from the content folder; show remote ones only.
  img: ({ src, alt }) => (typeof src === 'string' && /^https?:/.test(src) ? <img src={src} alt={alt ?? ''} /> : <span className="text-muted-foreground">[image: {alt}]</span>)
}

export const Markdown = memo(function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('md', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
})

/** Inline Markdown (bold / italic / code) without paragraph wrappers, for question prompts. */
export const InlineMarkdown = memo(function InlineMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <span className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={['p', 'strong', 'em', 'code', 'del', 'a', 'br']}
        unwrapDisallowed
        components={{ p: ({ children }) => <>{children}</>, ...components }}
      >
        {children}
      </ReactMarkdown>
    </span>
  )
})
