// Client
export {
  API_BASE_URL,
  handle429Error,
  parseErrorResponse,
  type ApiGetOptions,
  type ApiPostOptions,
} from "./client/client";

// Auth
export {
  login,
  signup,
  logout,
  getAuthSession,
  getMe,
  verifyEmail,
  resendVerification,
  completeOnboarding,
  type AuthSessionResponse,
  type MeResponse,
  type AuthPayload,
} from "./auth/auth";

// Invites
export * from "./team/index";

// Health
export { getHealth, type HealthResponse } from "./health/status";