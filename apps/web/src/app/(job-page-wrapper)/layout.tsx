/**
 * Public Job portal layout.
 * No dashboard shell, no auth required — for candidate-facing career pages.
 */
export default function JobLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
