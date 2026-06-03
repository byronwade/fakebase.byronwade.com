import { listDocs } from "@/lib/docs";
import { DocsSidebar } from "@/components/site/docs-sidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const docs = listDocs();
  return (
    <div className="mx-auto max-w-6xl px-5 pb-10 pt-24">
      <div className="lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">
        <DocsSidebar docs={docs} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
