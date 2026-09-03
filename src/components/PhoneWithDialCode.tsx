import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COUNTRY_DIAL_CODES,
  DEFAULT_DIAL_ISO,
  dialCodeForIso,
} from "@/lib/countryDialCodes";
import { cn } from "@/lib/utils";

type PhoneWithDialCodeProps = {
  id?: string;
  dialIso: string;
  localNumber: string;
  onDialIsoChange: (iso: string) => void;
  onLocalNumberChange: (value: string) => void;
  className?: string;
  autoComplete?: string;
};

export default function PhoneWithDialCode({
  id = "phone",
  dialIso,
  localNumber,
  onDialIsoChange,
  onLocalNumberChange,
  className,
  autoComplete = "tel-national",
}: PhoneWithDialCodeProps) {
  const selectedIso = dialIso || DEFAULT_DIAL_ISO;
  const selectedDial = dialCodeForIso(selectedIso);

  return (
    <div className={cn("flex gap-2", className)}>
      <Select value={selectedIso} onValueChange={onDialIsoChange}>
        <SelectTrigger
          className="h-10 w-[8.5rem] shrink-0 rounded-full border-border/80 bg-background/80"
          aria-label="Country dialing code"
        >
          <SelectValue>
            {selectedIso} {selectedDial}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {COUNTRY_DIAL_CODES.map((c) => (
            <SelectItem key={c.iso} value={c.iso}>
              {c.iso} {c.dial} · {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        placeholder="612345678"
        value={localNumber}
        onChange={(e) => onLocalNumberChange(e.target.value)}
        className="min-w-0 flex-1"
      />
    </div>
  );
}
