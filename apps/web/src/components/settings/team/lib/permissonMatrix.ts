export type BackendRole =
  | "owner"
  | "admin"
  | "recruiter"
  | "hiring_manager"
  | "interviewer"
  | "employee";

export type Role = BackendRole;

export const ROLE_LABELS: Record<BackendRole, string> = {
  owner: "Owner",
  admin: "Admin",
  recruiter: "Recruiter",
  hiring_manager: "Hiring Manager",
  interviewer: "Interviewer",
  employee: "Employee",
};

export function formatRole(role: string): string {
  return ROLE_LABELS[role as BackendRole] ?? role;
}

export const roles: { role: BackendRole; label: string }[] = [
  { role: "admin", label: "Admin" },
  { role: "recruiter", label: "Recruiter" },
  { role: "hiring_manager", label: "Hiring Manager" },
  { role: "interviewer", label: "Interviewer" },
  { role: "employee", label: "Employee" },
];

export const ASSIGNABLE_ROLES = roles.filter((r) => r.role !== "owner");

type DisplayRole = "Admin" | "Recruiter" | "Hiring Manager" | "Interviewer" | "Employee";

export const permissionMatrix: {
  category: string;
  permissions: { label: string; roles: Record<DisplayRole, boolean> }[];
}[] = [
  {
    category: "Team Management",
    permissions: [
      {
        label: "Invite & remove members",
        roles: {
          Admin: true,
          Recruiter: false,
          "Hiring Manager": false,
          Interviewer: false,
          Employee: false,
        },
      },
      {
        label: "Assign & change roles",
        roles: {
          Admin: true,
          Recruiter: false,
          "Hiring Manager": false,
          Interviewer: false,
          Employee: false,
        },
      },
    ],
  },
  {
    category: "Jobs",
    permissions: [
      {
        label: "View jobs",
        roles: {
          Admin: true,
          Recruiter: true,
          "Hiring Manager": true,
          Interviewer: false,
          Employee: false,
        },
      },
      {
        label: "Create & edit jobs",
        roles: {
          Admin: true,
          Recruiter: true,
          "Hiring Manager": false,
          Interviewer: false,
          Employee: false,
        },
      },
      {
        label: "Publish / unpublish jobs",
        roles: {
          Admin: true,
          Recruiter: false,
          "Hiring Manager": false,
          Interviewer: false,
          Employee: false,
        },
      },
      {
        label: "Archive / unarchive jobs",
        roles: {
          Admin: true,
          Recruiter: false,
          "Hiring Manager": false,
          Interviewer: false,
          Employee: false,
        },
      },
    ],
  },
  {
    category: "Candidates",
    permissions: [
      {
        label: "View candidates",
        roles: {
          Admin: true,
          Recruiter: true,
          "Hiring Manager": true,
          Interviewer: true,
          Employee: true,
        },
      },
      {
        label: "Source candidates",
        roles: {
          Admin: true,
          Recruiter: true,
          "Hiring Manager": false,
          Interviewer: false,
          Employee: false,
        },
      },
      {
        label: "Move hiring stages",
        roles: {
          Admin: true,
          Recruiter: true,
          "Hiring Manager": true,
          Interviewer: false,
          Employee: false,
        },
      },
      {
        label: "Add feedback & notes",
        roles: {
          Admin: true,
          Recruiter: true,
          "Hiring Manager": true,
          Interviewer: true,
          Employee: false,
        },
      },
    ],
  },
  {
    category: "Templates",
    permissions: [
      {
        label: "View templates",
        roles: {
          Admin: true,
          Recruiter: true,
          "Hiring Manager": false,
          Interviewer: false,
          Employee: false,
        },
      },
      {
        label: "Create / Edit / Delete templates",
        roles: {
          Admin: true,
          Recruiter: true,
          "Hiring Manager": false,
          Interviewer: false,
          Employee: false,
        },
      },
    ],
  },
  {
    category: "Automations",
    permissions: [
      {
        label: "View automations",
        roles: {
          Admin: true,
          Recruiter: true,
          "Hiring Manager": false,
          Interviewer: false,
          Employee: false,
        },
      },
      {
        label: "Create / Edit / Delete automations",
        roles: {
          Admin: true,
          Recruiter: true,
          "Hiring Manager": false,
          Interviewer: false,
          Employee: false,
        },
      },
    ],
  },
  {
    category: "Settings",
    permissions: [
      {
        label: "System settings",
        roles: {
          Admin: true,
          Recruiter: false,
          "Hiring Manager": false,
          Interviewer: false,
          Employee: false,
        },
      },
      {
        label: "Manage inbox",
        roles: {
          Admin: true,
          Recruiter: false,
          "Hiring Manager": false,
          Interviewer: false,
          Employee: false,
        },
      },
    ],
  },
];
