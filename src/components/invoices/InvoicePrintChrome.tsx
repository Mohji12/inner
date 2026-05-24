import { Link } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InvoicePrintChromeProps {
  title: string;
  children: React.ReactNode;
  backTo: string;
  backLabel?: string;
}

/**
 * Wraps invoice content with toolbar hidden when printing (browser PDF).
 */
export function InvoicePrintChrome({ title, children, backTo, backLabel = "Back" }: InvoicePrintChromeProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background print:bg-white print:min-h-0">
      <div className="mx-auto max-w-4xl px-4 py-6 print:hidden">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-xl text-muted-foreground">{title}</h1>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="default" className="gradient-cta text-white" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print / save as PDF
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to={backTo}>{backLabel}</Link>
            </Button>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4 pb-12 print:max-w-none print:px-0 print:pb-0">
        <article className="rounded-2xl border border-border/70 bg-card p-8 shadow-sm print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none">
          {children}
        </article>
      </div>
    </div>
  );
}
