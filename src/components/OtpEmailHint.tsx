import { Inbox } from "lucide-react";

type OtpEmailHintProps = {
  title: string;
  body: string;
};

const OtpEmailHint = ({ title, body }: OtpEmailHintProps) => (
  <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Inbox className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold leading-snug text-foreground">{title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  </div>
);

export default OtpEmailHint;
