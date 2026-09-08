import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/i18n/LanguageContext";

type Props = {
  open: boolean;
  remainingSeconds: number;
  urgency?: "initial" | "final";
  onExtend: () => void;
  onDismiss: () => void;
};

function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function SessionExpiryWarningDialog({
  open,
  remainingSeconds,
  urgency = "initial",
  onExtend,
  onDismiss,
}: Props) {
  const { t } = useLanguage();
  const c = t.app.chatSession;
  const isFinal = urgency === "final";
  const time = formatCountdown(remainingSeconds);

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onDismiss()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif">
            {isFinal ? c.expiryTitleFinal : c.expiryTitleInitial}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isFinal
              ? c.expiryBodyFinal.replace("{time}", time)
              : c.expiryBodyInitial.replace("{time}", time)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDismiss}>{c.continueWithoutExtending}</AlertDialogCancel>
          <AlertDialogAction onClick={onExtend}>{c.extendSession}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
