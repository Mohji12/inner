/** Legacy demo-only shapes for `src/data/seed.ts`. Live UI uses `@/api/types`. */
export type SessionDuration = 10 | 20 | 30;

export type SessionPrices = Record<SessionDuration, number>;

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "paid";

export interface Mentor {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  expertise: string;
  bio: string;
  languages: string[];
  yearsExperience: number;
  availability: string[];
  sessionPrices: SessionPrices;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  goals: string;
  preferredLanguage: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  mentorId: string;
  userId: string;
  reason: string;
  date: string;
  time: string;
  duration: SessionDuration;
  amount: number;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  status: BookingStatus;
  createdAt: string;
}
