import { apiFetch } from "./client";

export interface CoachApplicationSubmitBody {
  full_name: string;
  email: string;
  phone_number: string;
  headline: string;
  motivation: string;
  years_of_experience: number;
  languages_spoken?: string[];
  website_or_social?: string | null;
}

export function submitCoachApplication(body: CoachApplicationSubmitBody): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/coach-applications", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}
