import { useQuery } from "@tanstack/react-query";
import { fetchAdminFilterOptions, fetchAdminMentors, fetchAdminUsers } from "@/api/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/i18n/LanguageContext";

export type AdminEntityFilterValues = {
  coachId: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
};

export type AdminEntityApiFilters = {
  coach_id?: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
};

type Props = {
  value: AdminEntityFilterValues;
  onChange: (next: AdminEntityFilterValues) => void;
  onApply: () => void;
  onClear: () => void;
  showCoach?: boolean;
  showUser?: boolean;
  className?: string;
};

const ALL = "__all__";

export const emptyAdminEntityFilters = (): AdminEntityFilterValues => ({
  coachId: "",
  userId: "",
  dateFrom: "",
  dateTo: "",
});

export function toAdminEntityApiFilters(f: AdminEntityFilterValues): AdminEntityApiFilters {
  return {
    coach_id: f.coachId.trim() || undefined,
    user_id: f.userId.trim() || undefined,
    date_from: f.dateFrom || undefined,
    date_to: f.dateTo || undefined,
  };
}

export function AdminEntityFilters({
  value,
  onChange,
  onApply,
  onClear,
  showCoach = true,
  showUser = true,
  className,
}: Props) {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;

  const optionsQ = useQuery({
    queryKey: ["admin", "filter-options"],
    queryFn: async () => {
      try {
        return await fetchAdminFilterOptions();
      } catch {
        // Fallback when /admin/filter-options is unavailable (older API / transient error).
        const [mentors, users] = await Promise.all([
          showCoach ? fetchAdminMentors(0, 200) : Promise.resolve({ items: [] as { id: string; full_name: string; email: string }[] }),
          showUser ? fetchAdminUsers(0, 200) : Promise.resolve({ items: [] as { id: string; full_name: string; email: string }[] }),
        ]);
        return {
          coaches: mentors.items.map((m) => ({
            id: m.id,
            full_name: m.full_name,
            email: m.email,
          })),
          users: users.items.map((u) => ({
            id: u.id,
            full_name: u.full_name,
            email: u.email,
          })),
        };
      }
    },
    staleTime: 60_000,
    retry: 1,
  });

  const coaches = optionsQ.data?.coaches ?? [];
  const users = optionsQ.data?.users ?? [];
  const optionsError = optionsQ.isError;
  const optionsEmpty =
    !optionsQ.isLoading && !optionsError && coaches.length === 0 && users.length === 0;

  return (
    <div className={className ?? "rounded-lg border border-border/60 bg-muted/20 p-4"}>
      <p className="mb-3 text-sm font-medium">{d.filtersTitle}</p>
      {optionsQ.isLoading ? (
        <p className="mb-3 text-xs text-muted-foreground">{d.tableLoading}</p>
      ) : null}
      {optionsError ? (
        <p className="mb-3 text-xs text-destructive">
          {d.filterOptionsError ?? "Could not load coach/user lists. Check that the API is running, then refresh."}
        </p>
      ) : null}
      {optionsEmpty ? (
        <p className="mb-3 text-xs text-muted-foreground">
          {d.filterOptionsEmpty ?? "No coaches or users found in the database."}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {showCoach ? (
          <div className="space-y-1.5">
            <Label htmlFor="admin-filter-coach">{d.filterCoachName}</Label>
            <Select
              value={value.coachId || ALL}
              onValueChange={(v) => onChange({ ...value, coachId: v === ALL ? "" : v })}
              disabled={optionsQ.isLoading}
            >
              <SelectTrigger id="admin-filter-coach">
                <SelectValue placeholder={d.filterCoachPlaceholder} />
              </SelectTrigger>
              <SelectContent className="z-[100] max-h-72">
                <SelectItem value={ALL}>{d.filterAllCoaches}</SelectItem>
                {coaches.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name}
                    {c.email ? ` · ${c.email}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!optionsQ.isLoading && coaches.length > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                {(d.filterCoachCount ?? "{count} coaches").replace("{count}", String(coaches.length))}
              </p>
            ) : null}
          </div>
        ) : null}
        {showUser ? (
          <div className="space-y-1.5">
            <Label htmlFor="admin-filter-user">{d.filterUserName}</Label>
            <Select
              value={value.userId || ALL}
              onValueChange={(v) => onChange({ ...value, userId: v === ALL ? "" : v })}
              disabled={optionsQ.isLoading}
            >
              <SelectTrigger id="admin-filter-user">
                <SelectValue placeholder={d.filterUserPlaceholder} />
              </SelectTrigger>
              <SelectContent className="z-[100] max-h-72">
                <SelectItem value={ALL}>{d.filterAllUsers}</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name}
                    {u.email ? ` · ${u.email}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!optionsQ.isLoading && users.length > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                {(d.filterUserCount ?? "{count} users").replace("{count}", String(users.length))}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="admin-filter-from">{d.filterDateFrom}</Label>
          <Input
            id="admin-filter-from"
            type="date"
            value={value.dateFrom}
            onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-filter-to">{d.filterDateTo}</Label>
          <Input
            id="admin-filter-to"
            type="date"
            value={value.dateTo}
            onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onApply}>
          {d.applyFilters}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClear}>
          {d.clearFilters}
        </Button>
      </div>
    </div>
  );
}
