import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type UrlVisitRow = {
  label: string;
  views: number;
  unique_visitors: number;
};

export function UrlVisitTable({
  rows,
  urlLabel,
  viewsLabel,
  visitorsLabel,
  emptyLabel,
}: {
  rows: UrlVisitRow[];
  urlLabel: string;
  viewsLabel: string;
  visitorsLabel: string;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{urlLabel}</TableHead>
            <TableHead className="text-right">{viewsLabel}</TableHead>
            <TableHead className="text-right">{visitorsLabel}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell className="max-w-[28rem] break-all font-mono text-xs sm:text-sm">{row.label}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{row.views}</TableCell>
              <TableCell className="text-right tabular-nums">{row.unique_visitors}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
