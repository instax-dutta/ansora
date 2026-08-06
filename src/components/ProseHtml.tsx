/**
 * Renders pre-rendered markdown HTML (from renderMarkdown) inside the warm
 * prose styles. Server-rendered, so it's SSG/ISR friendly and SEO-safe.
 */
export function ProseHtml({
  html,
  className = "",
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={`prose prose-warm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
