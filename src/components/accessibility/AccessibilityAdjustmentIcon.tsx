type Props = {
  className?: string;
};

/** Universal access symbol — green circle with white figure. */
export function AccessibilityAdjustmentIcon({ className }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="32" cy="32" r="32" fill="hsl(var(--primary))" />
      <g fill="hsl(var(--primary-foreground))">
        <circle cx="32" cy="16.5" r="5.5" />
        <rect x="29.5" y="22" width="5" height="9" />
        <rect x="13" y="27" width="38" height="4.5" rx="0.5" />
        <path d="M28.5 31 19 53 23.5 54.5 32 40.5 40.5 54.5 45 53 35.5 31Z" />
      </g>
    </svg>
  );
}
