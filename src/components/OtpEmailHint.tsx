import { AlertTriangle, Inbox, MailOpen } from "lucide-react";

type OtpEmailHintProps = {
  title: string;
  body: string;
  badge?: string;
  spamTip?: string;
};

const OtpEmailHint = ({
  title,
  body,
  badge = "Important",
  spamTip = "Look in Inbox first — then Spam / Junk if it is missing",
}: OtpEmailHintProps) => (
  <aside
    role="note"
    aria-label={title}
    className="relative overflow-hidden rounded-2xl border-2 border-amber-500/70 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100/90 p-5 shadow-md shadow-amber-900/10 dark:border-amber-400/50 dark:from-amber-950/80 dark:via-orange-950/50 dark:to-amber-900/40"
  >
    <div
      className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-400/25 blur-2xl dark:bg-amber-300/10"
      aria-hidden
    />
    <div className="relative flex gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-700/30 ring-4 ring-amber-200/80 dark:ring-amber-800/60">
        <Inbox className="h-6 w-6" strokeWidth={2.25} aria-hidden />
      </div>
      <div className="min-w-0 space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm dark:bg-amber-500">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          {badge}
        </span>
        <p className="font-serif text-lg font-bold leading-snug tracking-tight text-amber-950 dark:text-amber-50 sm:text-xl">
          {title}
        </p>
        <p className="text-sm font-medium leading-relaxed text-amber-950/85 dark:text-amber-100/90">{body}</p>
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
          <MailOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {spamTip}
        </p>
      </div>
    </div>
  </aside>
);

export default OtpEmailHint;
