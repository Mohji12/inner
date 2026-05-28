import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  downloadAdminBookingInvoicePdf,
  downloadAdminChatInvoicePdf,
  fetchAdminBookingInvoices,
  fetchAdminChatInvoices,
  fetchAdminMentorMonthlyInvoices,
  fetchAdminOnboardingInvoices,
} from "@/api/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminInvoicesPage() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const bookingQ = useQuery({ queryKey: ["admin", "booking-invoices"], queryFn: () => fetchAdminBookingInvoices() });
  const chatQ = useQuery({ queryKey: ["admin", "chat-invoices"], queryFn: fetchAdminChatInvoices });
  const mentorQ = useQuery({ queryKey: ["admin", "mentor-invoices"], queryFn: () => fetchAdminMentorMonthlyInvoices() });
  const onboardingQ = useQuery({ queryKey: ["admin", "onboarding-invoices"], queryFn: () => fetchAdminOnboardingInvoices() });

  const downloadBooking = async (bookingId: string) => {
    setDownloading(`book-${bookingId}`);
    try {
      const { blob, filename } = await downloadAdminBookingInvoicePdf(bookingId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? `booking-invoice-${bookingId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  const downloadChat = async (sessionId: string) => {
    setDownloading(`chat-${sessionId}`);
    try {
      const { blob, filename } = await downloadAdminChatInvoicePdf(sessionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? `chat-invoice-${sessionId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card className="border-border/60 glass-card">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">All invoices</CardTitle>
        <CardDescription>Booking, chat, coach monthly, and onboarding invoices</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="booking">
          <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
            <TabsTrigger value="booking">Booking</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="mentor">Coach monthly</TabsTrigger>
            <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          </TabsList>

          <TabsContent value="booking">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(bookingQ.data?.items ?? []).map((row) => (
                  <TableRow key={row.booking_id}>
                    <TableCell className="font-mono text-xs">{row.invoice_number}</TableCell>
                    <TableCell>{row.customer_name}</TableCell>
                    <TableCell>{row.mentor_name}</TableCell>
                    <TableCell>
                      {row.currency} {row.total_amount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmt(row.issued_at)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" disabled={downloading === `book-${row.booking_id}`} onClick={() => void downloadBooking(row.booking_id)}>
                        <Download className="mr-1 h-4 w-4" /> PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="chat">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(chatQ.data ?? []).map((row) => (
                  <TableRow key={row.session_id}>
                    <TableCell className="font-mono text-xs">{row.invoice_number}</TableCell>
                    <TableCell>{row.mentor_name}</TableCell>
                    <TableCell>
                      {row.currency} {row.total_amount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmt(row.issued_at)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" disabled={downloading === `chat-${row.session_id}`} onClick={() => void downloadChat(row.session_id)}>
                        <Download className="mr-1 h-4 w-4" /> PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="mentor">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coach</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(mentorQ.data?.items ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.mentor_name}</TableCell>
                    <TableCell>{String(row.invoice_month)}</TableCell>
                    <TableCell>
                      {row.currency} {row.fee_amount}
                    </TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell className="text-muted-foreground">{fmt(row.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="onboarding">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Issued</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(onboardingQ.data?.items ?? []).map((row) => (
                  <TableRow key={row.payment_id}>
                    <TableCell className="font-mono text-xs">{row.invoice_number}</TableCell>
                    <TableCell>{row.mentor_name}</TableCell>
                    <TableCell>{row.mentor_email}</TableCell>
                    <TableCell>
                      {row.currency} {row.total_amount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmt(row.issued_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
