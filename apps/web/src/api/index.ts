// Client & health
export {
  API_BASE_URL,
  getHealth,
  handle429Error,
  parseErrorResponse,
  type HealthResponse,
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
export {
  getInviteDetails,
  acceptInvite,
  declineInvite,
  type InviteDetailsResponse,
} from "./team/invites";
