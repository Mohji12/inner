import { useQuery } from "@tanstack/react-query";
import { getMyWallet } from "@/api/wallets";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useLanguage } from "@/i18n/LanguageContext";

const WalletPage = () => {
  const { t } = useLanguage();
  const w = t.app.userWallet;
  const { data: wallet, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["wallet", "me"],
    queryFn: () => getMyWallet(),
  });

  if (isLoading) {
    return <p className="text-muted-foreground">{w.loading}</p>;
  }

  if (isError || !wallet) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-accent">{w.label}</p>
          <h1 className="font-serif text-3xl">{w.title}</h1>
        </div>
        <Card className="border-destructive/30">
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-destructive">{w.loadError}</p>
            <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
              {w.retry}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-accent">{w.label}</p>
        <h1 className="font-serif text-3xl">{w.title}</h1>
      </div>

      <Card className="border-border/60">
        <CardContent className="flex flex-col items-center justify-center p-12">
          <p className="text-sm text-muted-foreground mb-2">{w.balanceLabel}</p>
          <h2 className="text-5xl font-bold font-serif text-primary">
            {wallet.currency} {wallet.balance.toFixed(2)}
          </h2>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{w.historyTitle}</CardTitle>
          <CardDescription>{w.historyDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {wallet.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{w.emptyTransactions}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{w.colDate}</TableHead>
                  <TableHead>{w.colDescription}</TableHead>
                  <TableHead>{w.colType}</TableHead>
                  <TableHead className="text-right">{w.colAmount}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallet.transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(tx.created_at), "PPP")}
                    </TableCell>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell>
                      <span className={`capitalize ${tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type}
                      </span>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'credit' ? '+' : '-'}{wallet.currency} {tx.amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WalletPage;
