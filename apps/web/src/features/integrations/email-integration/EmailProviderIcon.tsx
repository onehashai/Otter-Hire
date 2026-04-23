"use client";

type ProviderKey = "google" | "microsoft" | "zoho";

export function EmailProviderIcon({
  provider,
  className = "h-4 w-4",
}: {
  provider: ProviderKey;
  className?: string;
}) {
  if (provider === "google") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path
          fill="#EA4335"
          d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.6 3.6 14.5 2.7 12 2.7A9.3 9.3 0 0 0 2.7 12 9.3 9.3 0 0 0 12 21.3c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.6H12Z"
        />
        <path
          fill="#34A853"
          d="M2.7 7.5 5.9 9.8A6 6 0 0 1 12 6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.6 3.6 14.5 2.7 12 2.7c-3.6 0-6.8 2.1-8.3 4.8Z"
        />
        <path
          fill="#FBBC05"
          d="M2.7 16.5 6 14a6 6 0 0 1 0-4L2.7 7.5A9.3 9.3 0 0 0 1.7 12c0 1.6.4 3.1 1 4.5Z"
        />
        <path
          fill="#4285F4"
          d="M12 21.3c2.4 0 4.5-.8 6-2.3l-2.8-2.2c-.8.5-1.8.9-3.2.9-3.8 0-5.2-2.5-5.4-3.8l-3.2 2.5c1.5 2.9 4.6 4.9 8.6 4.9Z"
        />
      </svg>
    );
  }
  if (provider === "microsoft") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" fill="#F25022" />
        <rect x="13" y="3" width="8" height="8" fill="#7FBA00" />
        <rect x="3" y="13" width="8" height="8" fill="#00A4EF" />
        <rect x="13" y="13" width="8" height="8" fill="#FFB900" />
      </svg>
    );
  }
  if (provider === "zoho") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <g transform="rotate(-8 12 12)">
          <rect x="2" y="5" width="5" height="12" rx="1" fill="#E42527" />
          <rect x="7.2" y="4" width="5" height="12" rx="1" fill="#F89B1C" />
          <rect x="12.4" y="5" width="5" height="12" rx="1" fill="#0380C4" />
          <rect x="17" y="4" width="5" height="12" rx="1" fill="#54A135" />
        </g>
      </svg>
    );
  }
  return null;
}
