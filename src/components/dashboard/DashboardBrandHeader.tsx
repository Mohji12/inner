import { APP_LOGO_SRC, APP_NAME } from "@/lib/branding";
import { dashboardBrandCardClass } from "@/components/dashboard/dashboardNav";
import { cn } from "@/lib/utils";

type Props = {
  roleLabel: string;
  className?: string;
};

export function DashboardBrandHeader({ roleLabel, className }: Props) {
  return (
    <div className={cn(dashboardBrandCardClass, "group-data-[collapsible=icon]:p-2", className)}>
      <div className="flex min-w-0 items-center gap-3 group-data-[collapsible=icon]:justify-center">
        <img
          src={APP_LOGO_SRC}
          alt={`${APP_NAME} logo`}
          className="h-9 w-9 shrink-0 rounded-md object-contain drop-shadow-sm group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
        />
        <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <p className="break-words font-serif text-2xl font-semibold leading-tight tracking-tight text-heading xl:text-3xl">
            {APP_NAME}
          </p>
          <p className="mt-0.5 break-words text-xs text-muted-foreground">{roleLabel}</p>
        </div>
      </div>
    </div>
  );
}
