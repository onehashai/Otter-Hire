export type BackendRole = "owner" | "admin" | "recruiter" | "hiring_manager" | "interviewer" | "employee";

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

export const roles: { role: BackendRole; label: string}[] = [
  { role: "admin", label: "Admin"},
  { role: "recruiter", label: "Recruiter"},
  { role: "hiring_manager", label: "Hiring Manager"},
  { role: "interviewer", label: "Interviewer"},
  { role: "employee", label: "Employee"},
];

export const ASSIGNABLE_ROLES = roles.filter((r) => r.role !== "owner");

type DisplayRole = "Admin" | "Recruiter" | "Hiring Manager" | "Interviewer" | "Employee";

export const permissionMatrix: {
    category: string;
    permissions: { label: string; roles: Record<DisplayRole, boolean> }[];
  }[] = [
    {
      category: "User Management",
      permissions: [
        { label: "Add / remove users", roles: { Admin: true, Recruiter: false, "Hiring Manager": false, Interviewer: false, Employee: false } },
        { label: "Assign roles", roles: { Admin: true, Recruiter: false, "Hiring Manager": false, Interviewer: false, Employee: false } },
      ],
    },
    {
      category: "Jobs & Pipeline",
      permissions: [
        { label: "Post and edit jobs", roles: { Admin: true, Recruiter: true, "Hiring Manager": false, Interviewer: false, Employee: false } },
        { label: "Configure workflows", roles: { Admin: true, Recruiter: false, "Hiring Manager": false, Interviewer: false, Employee: false } },
        { label: "View assigned jobs", roles: { Admin: true, Recruiter: true, "Hiring Manager": true, Interviewer: false, Employee: false } },
      ],
    },
    {
      category: "Candidates",
      permissions: [
        { label: "Source & screen candidates", roles: { Admin: true, Recruiter: true, "Hiring Manager": false, Interviewer: false, Employee: false } },
        { label: "View candidate profiles", roles: { Admin: true, Recruiter: true, "Hiring Manager": true, Interviewer: true, Employee: true } },
        { label: "Add feedback & notes", roles: { Admin: true, Recruiter: true, "Hiring Manager": true, Interviewer: true, Employee: false } },
        { label: "Update hiring stages", roles: { Admin: true, Recruiter: true, "Hiring Manager": true, Interviewer: false, Employee: false } },
      ],
    },
    {
      category: "Interviews",
      permissions: [
        { label: "Schedule interviews", roles: { Admin: true, Recruiter: true, "Hiring Manager": false, Interviewer: false, Employee: false } },
        { label: "Submit interview feedback", roles: { Admin: true, Recruiter: true, "Hiring Manager": true, Interviewer: true, Employee: false } },
      ],
    },
    {
      category: "Reports & Settings",
      permissions: [
        { label: "Access reports", roles: { Admin: true, Recruiter: false, "Hiring Manager": false, Interviewer: false, Employee: true } },
        { label: "View salary data", roles: { Admin: true, Recruiter: false, "Hiring Manager": false, Interviewer: false, Employee: false } },
        { label: "System settings", roles: { Admin: true, Recruiter: false, "Hiring Manager": false, Interviewer: false, Employee: false } },
      ],
    },
    {
        category: "Account & Billing",
        permissions: [
          { label: "Manage billing", roles: { Admin: false, Recruiter: false, "Hiring Manager": false, Interviewer: false, Employee: false } },
        ],
    },
  ];
