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
  type OrgUserResponse,
  type InviteDetailsResponse,
} from "./auth/auth";

// Organization
export * from "./organization/index";

// Jobs
export * from "./job/index";
export * from "./job/types";

// Invite
export { getInviteDetails, acceptInvite, declineInvite } from "./invite/index";

// Health
export { getHealth, type HealthResponse } from "./health/status";