import { FormEvent, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { createPaymentIntent, getUserBooking, validatePromoCode } from "@/api/bookings";
import { getBookingCheckoutPreview, getCheckoutCurrencies } from "@/api/payments";
import { getMentor, getPlatformPricing } from "@/api/mentors";
import type { Booking, MentorDetail, PlatformPricing } from "@/api/types";
import { sessionPackageEur } from "@/api/types";
import { CheckoutCurrencySelect } from "@/components/CheckoutCurrencySelect";
import { guessCheckoutCurrencyFromLocale } from "@/lib/checkoutCurrencyGuess";
import { stashPendingMolliePaymentId } from "@/lib/molliePendingPayment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateLocal, formatTimeLocal } from "@/lib/timeZone";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";
import { toast } from "sonner";

const PaymentPage = () => {
  const { mentorId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const effectiveTimeZone = useEffectiveTimeZone();
  const bookingId = searchParams.get("bookingId") ?? "";

  const [mentor, setMentor] = useState<MentorDetail | undefined>();
  const [pricing, setPricing] = useState<PlatformPricing | undefined>();
  const [booking, setBooking] = useState<Booking | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [finalTotalDue, setFinalTotalDue] = useState<number | null>(null);
  const [transactionFee, setTransactionFee] = useState(0.5);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState("");
  const currenciesQuery = useQuery({
    queryKey: ["checkout-currencies"],
    queryFn: getCheckoutCurrencies,
  });
  const checkoutPreviewQuery = useQuery({
    queryKey: ["booking-checkout-preview", bookingId],
    queryFn: () => getBookingCheckoutPreview(bookingId),
    enabled: Boolean(bookingId),
  });
  const [checkoutCurrency, setCheckoutCurrency] = useState("EUR");

  useEffect(() => {
    const list = currenciesQuery.data;
    if (!list?.length) return;
    setCheckoutCurrency((prev) =>
      list.map((c) => c.toUpperCase()).includes(prev) ? prev : guessCheckoutCurrencyFromLocale(navigator.language, list),
    );
  }, [currenciesQuery.data]);

  useEffect(() => {
    const preview = checkoutPreviewQuery.data;
    if (!preview) return;
    setTransactionFee(preview.transaction_fee_eur);
  }, [checkoutPreviewQuery.data]);

  useEffect(() => {
    if (!mentorId || !bookingId) {
      setLoading(false);
      return;
    }
    Promise.all([getMentor(mentorId), getUserBooking(bookingId), getPlatformPricing()])
      .then(([m, b, p]) => {
        setMentor(m);
        setBooking(b);
        setPricing(p);
      })
      .catch(() => toast.error("Could not load booking"))
      .finally(() => setLoading(false));
  }, [mentorId, bookingId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="animate-pulse font-serif text-xl italic text-muted-foreground">Loading checkout…</p>
      </div>
    );
  }

  if (!mentor || !booking || !pricing) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppPageHeader />
        <main className="container mx-auto px-6 py-10">
          <Card className="mx-auto max-w-2xl">
            <CardHeader>
              <CardTitle className="font-serif text-3xl">Payment details not found</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/mentors">Back to coaches</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const baseAmount = sessionPackageEur(mentor, pricing, booking.duration);
  const subtotalBeforeDiscount = baseAmount + transactionFee;
  const totalDue = finalTotalDue ?? subtotalBeforeDiscount;

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    setValidatingPromo(true);
    setPromoError("");
    try {
      const res = await validatePromoCode(promoCodeInput.trim(), baseAmount, mentor.id);
      setTransactionFee(res.transaction_fee);
      if (res.is_valid) {
        setPromoCode(promoCodeInput.trim());
        setDiscountAmount(res.discount_amount);
        setFinalTotalDue(res.final_amount);
      } else {
        setPromoError(res.message || "Invalid promo code");
        setPromoCode("");
        setDiscountAmount(0);
        setFinalTotalDue(null);
      }
    } catch (e) {
      setPromoError(e instanceof Error ? e.message : "Error validating promo code");
      setPromoCode("");
      setDiscountAmount(0);
      setFinalTotalDue(null);
    } finally {
      setValidatingPromo(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPaying(true);
    setError("");
    try {
      const out = await createPaymentIntent(booking.id, {
        checkout_currency: checkoutCurrency,
        promo_code: promoCode || undefined,
      });
      if (totalDue > 0) {
        stashPendingMolliePaymentId(out.payment_id);
      }
      window.location.href = out.checkout_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppPageHeader />
      <main className="container mx-auto grid max-w-5xl grid-cols-1 gap-6 px-6 py-10 lg:grid-cols-5">
        <Card className="border-border/60 lg:col-span-3">
          <CardHeader>
            <p className="text-sm uppercase tracking-widest text-accent">Mollie payment</p>
            <CardTitle className="font-serif text-3xl">Complete your payment</CardTitle>
            <CardDescription>You will be redirected to Mollie secure checkout.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Session prices are in EUR plus a EUR {transactionFee.toFixed(2)} transaction fee. Promo codes apply to the
                total due. Mollie will show the exact amount in your selected currency.
              </p>
              {totalDue > 0 && currenciesQuery.data?.length ? (
                <CheckoutCurrencySelect
                  id="checkout-ccy"
                  value={checkoutCurrency}
                  onChange={setCheckoutCurrency}
                  currencies={currenciesQuery.data}
                  disabled={paying}
                />
              ) : null}
              {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => navigate(`/mentors/${mentor.id}`)}>
                  Back
                </Button>
                <Button type="submit" className="gradient-cta text-white" disabled={paying}>
                  {totalDue > 0
                    ? `Pay (${checkoutCurrency}) — EUR ${totalDue.toFixed(2)} total`
                    : "Confirm Booking (Free)"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl">Order summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Coach:</span> {mentor.full_name}
            </p>
            <p>
              <span className="text-muted-foreground">Duration:</span> {booking.duration} mins
            </p>
            <p>
              <span className="text-muted-foreground">Date:</span>{" "}
              {formatDateLocal(booking.start_at_utc, { year: "numeric", month: "2-digit", day: "2-digit" }, effectiveTimeZone)}
            </p>
            <p>
              <span className="text-muted-foreground">Time:</span> {formatTimeLocal(booking.start_at_utc, undefined, effectiveTimeZone)}
              {" – "}
              {formatTimeLocal(booking.end_at_utc, undefined, effectiveTimeZone)}
            </p>
            <p>
              <span className="text-muted-foreground">Booked:</span>{" "}
              {formatDateLocal(booking.created_at, { day: "numeric", month: "short", year: "numeric" }, effectiveTimeZone)}{" "}
              at {formatTimeLocal(booking.created_at, undefined, effectiveTimeZone)}
            </p>
            <hr className="border-border/70" />
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Promo code"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value)}
                  disabled={validatingPromo || paying}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleApplyPromo()}
                  disabled={validatingPromo || paying || !promoCodeInput.trim()}
                >
                  Apply
                </Button>
              </div>
              {promoError && <p className="text-xs text-destructive">{promoError}</p>}
              {promoCode && !promoError && (
                <p className="text-xs text-green-600 dark:text-green-400">Promo code applied: -EUR {discountAmount.toFixed(2)}</p>
              )}
            </div>
            <hr className="border-border/70" />
            <div className="space-y-1">
              <p className="flex justify-between">
                <span className="text-muted-foreground">Session</span>
                <span>EUR {baseAmount.toFixed(2)}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">Transaction fee</span>
                <span>EUR {transactionFee.toFixed(2)}</span>
              </p>
              {discountAmount > 0 ? (
                <p className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Promo discount</span>
                  <span>-EUR {discountAmount.toFixed(2)}</span>
                </p>
              ) : null}
              <p className="flex justify-between text-base font-semibold pt-1">
                <span>Total due</span>
                <span>EUR {totalDue.toFixed(2)}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PaymentPage;
