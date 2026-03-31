/**
 * Public Job portal layout.
 * No dashboard shell, no auth required — for candidate-facing career pages.
 */
import { SonnerToaster } from "@onehash/ui/sonner";

export default function JobLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SonnerToaster />
    </>
  );
}
