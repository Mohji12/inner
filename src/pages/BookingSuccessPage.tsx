import { Link, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import AppPageHeader from "@/components/AppPageHeader";
import { getUserBooking, getBookingCalendarUrl } from "@/api/bookings";
import { getMentor, getPlatformPricing } from "@/api/mentors";
import { syncMolliePaymentAfterCheckout } from "@/api/payments";
import type { Booking, MentorDetail, PlatformPricing } from "@/api/types";
import { slotPriceForDuration } from "@/api/types";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SuccessBurst } from "@/components/ui/SuccessBurst";
import { formatDateLocal, formatTimeLocal } from "@/lib/timeZone";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  clearPendingMolliePaymentId,
  peekPendingMolliePaymentId,
} from "@/lib/molliePendingPayment";
import { initMetaPixel, trackPurchase } from "@/lib/metaPixel";

type PageState = "loading" | "paid" | "pending" | "failed" | "not_found";

const BookingSuccessPage = () => {
  const { t } = useLanguage();
  const b = t.app.bookingSuccess;
  const [searchParams] = useSearchParams();
  const effectiveTimeZone = useEffectiveTimeZone();
  const bookingId = searchParams.get("bookingId") ?? "";

  const [booking, setBooking] = useState<Booking | undefined>();
  const [mentor, setMentor] = useState<MentorDetail | undefined>();
  const [pricing, setPricing] = useState<PlatformPricing | undefined>();
  const [pageState, setPageState] = useState<PageState>("loading");
  const trackedRef = useRef(false);

  const loadBookingDetails = useCallback(async () => {
    if (!bookingId) {
      setBooking(undefined);
      setMentor(undefined);
      setPricing(undefined);
      setPageState("not_found");
      return;
    }
    setPageState("loading");
    try {
      const loadedBooking = await getUserBooking(bookingId);
      setBooking(loadedBooking);
      const [loadedMentor, loadedPricing] = await Promise.all([
        getMentor(loadedBooking.mentor_id),
        getPlatformPricing(),
      ]);
      setMentor(loadedMentor);
      setPricing(loadedPricing);
      if (loadedBooking.payment_status === "paid") {
        setPageState("paid");
      } else if (loadedBooking.payment_status === "failed") {
        setPageState("failed");
      } else {
        setPageState("pending");
      }
    } catch {
      setBooking(undefined);
      setMentor(undefined);
      setPricing(undefined);
      setPageState("not_found");
    }
  }, [bookingId]);

  useEffect(() => {
    const pending = peekPendingMolliePaymentId();
    if (!pending) {
      void loadBookingDetails();
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await syncMolliePaymentAfterCheckout(pending);
        if (cancelled) return;
        clearPendingMolliePaymentId();
      } catch {
        /* webhook may arrive later */
      } finally {
        if (!cancelled) {
          void loadBookingDetails();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadBookingDetails]);

  useEffect(() => {
    if (trackedRef.current || pageState !== "paid" || !bookingId || !booking || !pricing) {
      return;
    }
    trackedRef.current = true;
    initMetaPixel();
    trackPurchase({
      eventId: `booking-paid-${bookingId}`,
      value: slotPriceForDuration(pricing, booking.duration),
      currency: "EUR",
      contentName: "session_booking",
    });
  }, [pageState, bookingId, booking, pricing]);

  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="animate-pulse font-serif text-xl italic text-muted-foreground">{b.confirming}</p>
      </div>
    );
  }

  const amount = booking && pricing ? slotPriceForDuration(pricing, booking.duration) : null;

  const header =
    pageState === "paid"
      ? {
          burstLabel: b.successLabel,
          burstDescription: b.successDescription,
          kicker: b.confirmedLabel,
          title: b.thankYou,
        }
      : pageState === "pending"
        ? {
            burstLabel: b.pendingLabel,
            burstDescription: b.pendingDescription,
            kicker: b.pendingLabel,
            title: b.thankYou,
          }
        : {
            burstLabel: b.failedLabel,
            burstDescription: b.failedDescription,
            kicker: b.failedLabel,
            title: b.failedLabel,
          };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppPageHeader />
      <main className="container mx-auto px-6 py-10">
        <Card className="mx-auto max-w-2xl border-border/60">
          <CardHeader className="items-center text-center">
            {pageState === "paid" ? (
              <SuccessBurst size="lg" label={header.burstLabel} description={header.burstDescription} className="mb-2" />
            ) : pageState === "pending" ? (
              <div className="mb-2 flex flex-col items-center gap-2">
                <Loader2 className="h-10 w-10 animate-spin text-accent" aria-hidden />
                <p className="font-medium">{header.burstLabel}</p>
                <p className="text-sm text-muted-foreground">{header.burstDescription}</p>
              </div>
            ) : (
              <div className="mb-2 space-y-1">
                <p className="font-medium text-destructive">{header.burstLabel}</p>
                <p className="text-sm text-muted-foreground">{header.burstDescription}</p>
              </div>
            )}
            <p className="text-sm uppercase tracking-widest text-accent">{header.kicker}</p>
            <CardTitle className="font-serif text-3xl">{header.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pageState === "pending" ? (
              <p className="text-sm text-muted-foreground text-center">{b.pendingHint}</p>
            ) : null}
            {pageState === "failed" || pageState === "not_found" ? (
              <p className="text-sm text-muted-foreground text-center">
                {pageState === "not_found" ? b.notFoundDescription : b.failedHint}
              </p>
            ) : null}
            {booking && mentor ? (
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm">
                <p>
                  {b.coach}: {mentor.full_name}
                </p>
                <p>
                  {b.date}:{" "}
                  {formatDateLocal(
                    booking.start_at_utc,
                    { year: "numeric", month: "2-digit", day: "2-digit" },
                    effectiveTimeZone,
                  )}
                </p>
                <p>
                  {b.time}: {formatTimeLocal(booking.start_at_utc, undefined, effectiveTimeZone)}
                </p>
                <p>
                  {b.duration}: {booking.duration} mins
                </p>
                {pageState === "paid" && amount != null ? (
                  <p>
                    {b.amountPaid}: EUR {amount.toFixed(2)}
                  </p>
                ) : null}
                {booking.meeting_link ? (
                  <p>
                    {b.meeting}: {booking.meeting_link}
                  </p>
                ) : null}
              </div>
            ) : pageState === "paid" ? (
              <p className="text-muted-foreground text-center">{b.savedFallback}</p>
            ) : null}
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {pageState === "pending" ? (
                <Button type="button" variant="outline" onClick={() => void loadBookingDetails()}>
                  {b.retry}
                </Button>
              ) : null}
              <Button asChild className="gradient-cta text-white">
                <Link to="/user/appointments">{b.goAppointments}</Link>
              </Button>
              {booking && pageState === "paid" ? (
                <Button asChild variant="outline">
                  <a href={getBookingCalendarUrl(booking.id)} download>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {b.addCalendar}
                  </a>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link to="/mentors">{b.bookAnother}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default BookingSuccessPage;
