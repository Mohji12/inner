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

/** How long the user must wait for the coach before the no-show alert appears. */
export const COACH_NO_SHOW_ALERT_MS = 5 * 60 * 1000;

type Props = {
  open: boolean;
  ending?: boolean;
  onKeepWaiting: () => void;
  onEndAndFindCoach: () => void;
};

export function CoachNoShowDialog({ open, ending, onKeepWaiting, onEndAndFindCoach }: Props) {
  const { t } = useLanguage();
  const c = t.app.chatSession;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !ending) onKeepWaiting();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif">{c.coachNoShowTitle}</AlertDialogTitle>
          <AlertDialogDescription>{c.coachNoShowBody}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={ending} onClick={onKeepWaiting}>
            {c.coachNoShowKeepWaiting}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={ending}
            onClick={(e) => {
              e.preventDefault();
              onEndAndFindCoach();
            }}
          >
            {ending ? c.coachNoShowEnding : c.coachNoShowEndAndFind}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
