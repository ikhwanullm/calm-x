import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

/**
 * Renders meeting notes (GitHub-flavoured Markdown, including task lists and tables).
 * Raw HTML in the notes is never rendered: without rehype-raw it is shown as plain text,
 * and unsafe link schemes such as `javascript:` are dropped by react-markdown's URL transform.
 * Links open in a new tab.
 */
const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-text underline underline-offset-2">
      {children}
    </a>
  ),
  h1: ({ children }) => <h1 className="text-xl font-semibold text-text mt-5 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-semibold text-text mt-5 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-text mt-4 mb-1">{children}</h3>,
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
  ul: ({ children, className }) => (
    <ul className={className?.includes('contains-task-list') ? 'my-2 space-y-1' : 'my-2 list-disc pl-5 space-y-1'}>
      {children}
    </ul>
  ),
  ol: ({ children }) => <ol className="my-2 list-decimal pl-5 space-y-1">{children}</ol>,
  li: ({ children, className }) => (
    <li className={className?.includes('task-list-item') ? 'flex items-start gap-2' : undefined}>{children}</li>
  ),
  input: ({ type, checked }) =>
    type === 'checkbox' ? (
      <input type="checkbox" checked={checked} disabled readOnly className="mt-1 accent-[var(--accent)]" />
    ) : null,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-border-strong pl-3 text-muted">{children}</blockquote>
  ),
  code: ({ children, className }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="px-1 py-0.5 rounded bg-surface-2 text-[0.9em]">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="my-2 p-3 rounded-control bg-surface-2 overflow-x-auto text-xs">{children}</pre>
  ),
  hr: () => <hr className="my-4 border-border" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto"><table className="text-sm border-collapse">{children}</table></div>
  ),
  th: ({ children }) => <th className="border border-border px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
}

export function MarkdownView({ source }: { source: string }) {
  if (!source.trim()) {
    return <p className="text-sm text-muted">Nothing to preview yet.</p>
  }
  return (
    <div className="text-sm text-text break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  )
}
