// Client
export {
  API_BASE_URL,
  getApiBase,
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
  refreshSession,
  getGoogleAuthEnabled,
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
export {
  getInviteDetails,
  acceptInvite,
  declineInvite,
  acceptExistingInvite,
} from "./invite/index";

// Health
export { getHealth, type HealthResponse } from "./health/status";

// Public
export * from "./public/index";

// Job Categories
export * from "./job-categories/index";

// Candidates
export * from "./candidates/index";

// Users
export * from "./users/index";

// Platform admin
export * from "./admin/index";

// Integrations
export * from "./integrations/index";

// Conversations
export * from "./conversations/index";

// Templates
export * from "./templates/index";
