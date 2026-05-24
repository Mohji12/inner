import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CheckoutCurrencySelect(props: {
  id?: string;
  label?: string;
  value: string;
  onChange: (currency: string) => void;
  currencies: string[];
  disabled?: boolean;
}) {
  const { id, label = "Checkout currency", value, onChange, currencies, disabled } = props;
  const sorted = [...currencies].map((c) => c.toUpperCase()).sort();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled || sorted.length === 0}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="EUR" />
        </SelectTrigger>
        <SelectContent>
          {sorted.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
