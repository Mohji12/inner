import { useQuery } from "@tanstack/react-query";
import { getMyWallet } from "@/api/wallets";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

const WalletPage = () => {
  const { data: wallet, isLoading } = useQuery({
    queryKey: ["wallet", "me"],
    queryFn: () => getMyWallet(),
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Loading wallet...</p>;
  }

  if (!wallet) {
    return <p className="text-destructive">Failed to load wallet data.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-accent">Wallet</p>
        <h1 className="font-serif text-3xl">My Balance</h1>
      </div>

      <Card className="border-border/60">
        <CardContent className="flex flex-col items-center justify-center p-12">
          <p className="text-sm text-muted-foreground mb-2">Available Balance</p>
          <h2 className="text-5xl font-bold font-serif text-primary">
            {wallet.currency} {wallet.balance.toFixed(2)}
          </h2>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Recent activity in your wallet.</CardDescription>
        </CardHeader>
        <CardContent>
          {wallet.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No transactions found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
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
