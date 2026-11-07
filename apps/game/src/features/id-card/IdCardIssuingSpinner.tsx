export function IdCardIssuingSpinner() {
  return (
    <span
      role="status"
      aria-label="Issuing your ID card"
      className="block size-5 animate-spin rounded-full border-2 border-[var(--color-muted-border)] border-t-[var(--color-green-strong)]"
    />
  );
}
