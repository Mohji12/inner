import { apiFetch } from "./client";

export interface WalletTransaction {
  id: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
  reference_type?: string | null;
  reference_id?: string | null;
  created_at: string;
}

export interface Wallet {
  id: string;
  balance: number;
  currency: string;
  transactions: WalletTransaction[];
}

export function getMyWallet(skip = 0, limit = 50): Promise<Wallet> {
  return apiFetch<Wallet>(`/wallets/me?skip=${skip}&limit=${limit}`);
}
