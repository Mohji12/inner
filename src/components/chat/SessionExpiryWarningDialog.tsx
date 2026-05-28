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
  const isFinal = urgency === "final";

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onDismiss()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif">
            {isFinal ? "Session about to end" : "Session ending soon"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isFinal
              ? `Your session is about to end (${formatCountdown(remainingSeconds)} left). If you want to extend, you can extend it now.`
              : `Your session expires in ${formatCountdown(remainingSeconds)}. Would you like to extend?`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDismiss}>Continue without extending</AlertDialogCancel>
          <AlertDialogAction onClick={onExtend}>Extend session</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
