import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { cn } from "@/lib/utils";

const components: Components = {
  h1: ({ className, ...props }) => (
    <h1
      className={cn("scroll-mt-24 text-3xl font-semibold tracking-tight", className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        "scroll-mt-24 border-b border-border pb-2 text-xl font-semibold tracking-tight",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn("scroll-mt-24 text-lg font-medium tracking-tight", className)}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("leading-relaxed text-foreground/85", className)} {...props} />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "font-medium text-brand underline-offset-4 hover:underline",
        className,
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn("list-disc space-y-1.5 pl-5 text-foreground/85", className)}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn("list-decimal space-y-1.5 pl-5 text-foreground/85", className)}
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("leading-relaxed", className)} {...props} />
  ),
  strong: ({ className, ...props }) => (
    <strong className={cn("font-semibold text-foreground", className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "rounded-r-xl border-l-2 border-warning bg-warning/5 py-2 pl-4 pr-3 text-foreground/85 [&>p]:my-1",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("border-border", className)} {...props} />
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className={cn("font-mono text-[13px]", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "overflow-x-auto rounded-2xl border border-border bg-card p-4 shadow-card",
        className,
      )}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
      <table className={cn("w-full text-left text-sm", className)} {...props} />
    </div>
  ),
  thead: ({ className, ...props }) => (
    <thead className={cn("border-b border-border bg-muted/40", className)} {...props} />
  ),
  th: ({ className, ...props }) => (
    <th className={cn("px-4 py-2.5 font-medium", className)} {...props} />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        "border-b border-border/60 px-4 py-2.5 text-foreground/85",
        className,
      )}
      {...props}
    />
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-5 text-[15px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
