export function getAppHost(): string {
  const subdomain = process.env.NEXT_PUBLIC_APP_SUBDOMAIN;
  const rootHost = process.env.NEXT_PUBLIC_APP_ROOT_HOST;

  if (!subdomain || !rootHost) {
    if (typeof window !== "undefined") {
      return window.location.host;
    }
    return "localhost:3000";
  }

  return `${subdomain}.${rootHost}`;
}

export function getAppBaseUrl(): string {
  const host = getAppHost();
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}
