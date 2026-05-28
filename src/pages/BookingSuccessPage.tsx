import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import AppPageHeader from "@/components/AppPageHeader";
import { getUserBooking, getBookingCalendarUrl } from "@/api/bookings";
import { getMentor, getPlatformPricing } from "@/api/mentors";
import type { Booking, MentorDetail, PlatformPricing } from "@/api/types";
import { slotPriceForDuration } from "@/api/types";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SuccessBurst } from "@/components/ui/SuccessBurst";
import { formatDateLocal, formatTimeLocal } from "@/lib/timeZone";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";

const BookingSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const effectiveTimeZone = useEffectiveTimeZone();
  const bookingId = searchParams.get("bookingId") ?? "";

  const [booking, setBooking] = useState<Booking | undefined>();
  const [mentor, setMentor] = useState<MentorDetail | undefined>();
  const [pricing, setPricing] = useState<PlatformPricing | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }
    getUserBooking(bookingId)
      .then((b) => {
        setBooking(b);
        return Promise.all([getMentor(b.mentor_id), getPlatformPricing()]);
      })
      .then(([m, p]) => {
        setMentor(m);
        setPricing(p);
      })
      .catch(() => setMentor(undefined))
      .finally(() => setLoading(false));
  }, [bookingId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="animate-pulse font-serif text-xl italic text-muted-foreground">Confirming your session…</p>
      </div>
    );
  }

  const amount =
    booking && pricing ? slotPriceForDuration(pricing, booking.duration) : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppPageHeader />
      <main className="container mx-auto px-6 py-10">
        <Card className="mx-auto max-w-2xl border-border/60">
          <CardHeader className="items-center text-center">
            <SuccessBurst
              size="lg"
              label="Payment successful"
              description="Your session is confirmed"
              className="mb-2"
            />
            <p className="text-sm uppercase tracking-widest text-accent">Booking confirmed</p>
            <CardTitle className="font-serif text-3xl">Thank you</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {booking && mentor ? (
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm">
                <p>Coach: {mentor.full_name}</p>
                <p>Date: {formatDateLocal(booking.start_at_utc, { year: "numeric", month: "2-digit", day: "2-digit" }, effectiveTimeZone)}</p>
                <p>Time: {formatTimeLocal(booking.start_at_utc, undefined, effectiveTimeZone)}</p>
                <p>Duration: {booking.duration} mins</p>
                {amount != null ? <p>Amount paid: EUR {amount.toFixed(2)}</p> : null}
                {booking.meeting_link ? <p>Meeting: {booking.meeting_link}</p> : null}
              </div>
            ) : (
              <p className="text-muted-foreground">Your booking is saved. Open your dashboard for details.</p>
            )}
            <div className="flex flex-wrap gap-3 mt-2">
              <Button asChild className="gradient-cta text-white">
                <Link to="/user/appointments">Go to appointments</Link>
              </Button>
              {booking ? (
                <Button asChild variant="outline">
                  <a href={getBookingCalendarUrl(booking.id)} download>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    Add to Calendar
                  </a>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link to="/mentors">Book another coach</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default BookingSuccessPage;
