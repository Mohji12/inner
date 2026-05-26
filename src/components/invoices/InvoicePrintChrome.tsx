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
    <div className="relative min-h-screen bg-gradient-to-b from-muted/30 to-background print:bg-white print:min-h-0">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden print:fixed print:inset-0"
      >
        <img
          src="/lifepath%20logo.png"
          alt=""
          className="max-h-[55vh] max-w-[70vw] opacity-[0.07] print:opacity-[0.08]"
        />
        <span className="absolute rotate-[42deg] select-none text-5xl font-bold tracking-wide text-[#6b7358]/10 print:text-[#6b7358]/12">
          Mijn Levenspad
        </span>
      </div>
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-6 print:hidden">
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
      <div className="relative z-10 mx-auto max-w-4xl px-4 pb-12 print:max-w-none print:px-0 print:pb-0">
        <article className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-8 shadow-sm print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none">
          {children}
        </article>
      </div>
    </div>
  );
}
