/** Common international dialing (STD) codes for phone registration. */
export type CountryDialCode = {
  iso: string;
  name: string;
  dial: string;
};

export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { iso: "NL", name: "Netherlands", dial: "+31" },
  { iso: "BE", name: "Belgium", dial: "+32" },
  { iso: "DE", name: "Germany", dial: "+49" },
  { iso: "FR", name: "France", dial: "+33" },
  { iso: "GB", name: "United Kingdom", dial: "+44" },
  { iso: "IE", name: "Ireland", dial: "+353" },
  { iso: "ES", name: "Spain", dial: "+34" },
  { iso: "IT", name: "Italy", dial: "+39" },
  { iso: "PT", name: "Portugal", dial: "+351" },
  { iso: "AT", name: "Austria", dial: "+43" },
  { iso: "CH", name: "Switzerland", dial: "+41" },
  { iso: "LU", name: "Luxembourg", dial: "+352" },
  { iso: "PL", name: "Poland", dial: "+48" },
  { iso: "SE", name: "Sweden", dial: "+46" },
  { iso: "NO", name: "Norway", dial: "+47" },
  { iso: "DK", name: "Denmark", dial: "+45" },
  { iso: "FI", name: "Finland", dial: "+358" },
  { iso: "US", name: "United States", dial: "+1" },
  { iso: "CA", name: "Canada", dial: "+1" },
  { iso: "AU", name: "Australia", dial: "+61" },
  { iso: "NZ", name: "New Zealand", dial: "+64" },
  { iso: "IN", name: "India", dial: "+91" },
  { iso: "PK", name: "Pakistan", dial: "+92" },
  { iso: "BD", name: "Bangladesh", dial: "+880" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971" },
  { iso: "SA", name: "Saudi Arabia", dial: "+966" },
  { iso: "TR", name: "Turkey", dial: "+90" },
  { iso: "EG", name: "Egypt", dial: "+20" },
  { iso: "MA", name: "Morocco", dial: "+212" },
  { iso: "ZA", name: "South Africa", dial: "+27" },
  { iso: "BR", name: "Brazil", dial: "+55" },
  { iso: "MX", name: "Mexico", dial: "+52" },
  { iso: "AR", name: "Argentina", dial: "+54" },
  { iso: "CN", name: "China", dial: "+86" },
  { iso: "JP", name: "Japan", dial: "+81" },
  { iso: "KR", name: "South Korea", dial: "+82" },
  { iso: "SG", name: "Singapore", dial: "+65" },
  { iso: "MY", name: "Malaysia", dial: "+60" },
  { iso: "ID", name: "Indonesia", dial: "+62" },
  { iso: "PH", name: "Philippines", dial: "+63" },
  { iso: "TH", name: "Thailand", dial: "+66" },
  { iso: "VN", name: "Vietnam", dial: "+84" },
  { iso: "RU", name: "Russia", dial: "+7" },
  { iso: "UA", name: "Ukraine", dial: "+380" },
  { iso: "RO", name: "Romania", dial: "+40" },
  { iso: "CZ", name: "Czechia", dial: "+420" },
  { iso: "HU", name: "Hungary", dial: "+36" },
  { iso: "GR", name: "Greece", dial: "+30" },
];

export const DEFAULT_DIAL_ISO = "NL";

export function dialCodeForIso(iso: string): string {
  return COUNTRY_DIAL_CODES.find((c) => c.iso === iso)?.dial ?? "+31";
}

/** Build E.164-style number from dial code + local digits. */
export function composeE164Phone(dialCode: string, localNumber: string): string {
  const digits = localNumber.replace(/[^\d]/g, "").replace(/^0+/, "");
  const dial = dialCode.startsWith("+") ? dialCode : `+${dialCode}`;
  if (!digits) return "";
  return `${dial}${digits}`;
}
