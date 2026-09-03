import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  COACH_CARD_VISIBILITY_KEYS,
  type CoachCardVisibility,
  type CoachCardVisibilityKey,
} from "@/lib/coachCardVisibility";

export type CoachCardVisibilityLabels = Record<CoachCardVisibilityKey, string>;

type CoachCardVisibilityPickerProps = {
  value: CoachCardVisibility;
  onChange: (next: CoachCardVisibility) => void;
  labels: CoachCardVisibilityLabels;
  title: string;
  description: string;
};

export default function CoachCardVisibilityPicker({
  value,
  onChange,
  labels,
  title,
  description,
}: CoachCardVisibilityPickerProps) {
  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {COACH_CARD_VISIBILITY_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/60 px-3 py-2">
            <Label htmlFor={`card-vis-${key}`} className="text-sm font-normal">
              {labels[key]}
            </Label>
            <Switch
              id={`card-vis-${key}`}
              checked={value[key]}
              onCheckedChange={(checked) => onChange({ ...value, [key]: checked })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
