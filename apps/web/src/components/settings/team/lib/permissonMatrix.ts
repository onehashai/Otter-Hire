import { type IconName } from "@onehash/ui";

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

export const roles: { role: BackendRole; label: string; description: string; icon: IconName }[] = [
  { role: "owner", label: "Owner", description: "Full account ownership, billing, and top oversight.", icon: "Crown" },
  { role: "admin", label: "Admin", description: "System configuration, user management, and compliance.", icon: "Shield" },
  { role: "recruiter", label: "Recruiter", description: "Source candidates, schedule interviews, post jobs.", icon: "PenLine" },
  { role: "hiring_manager", label: "Hiring Manager", description: "View assigned jobs, review candidates, approve stages.", icon: "Users" },
  { role: "interviewer", label: "Interviewer", description: "View candidate profiles and submit interview feedback.", icon: "Mic" },
  { role: "employee", label: "Employee", description: "Read-only access to candidates and reports.", icon: "Eye" },
];

export const ASSIGNABLE_ROLES = roles.filter((r) => r.role !== "owner");

type DisplayRole = "Owner" | "Admin" | "Recruiter" | "Hiring Manager" | "Interviewer" | "Employee";

export const permissionMatrix: {
    category: string;
    permissions: { label: string; roles: Record<DisplayRole, boolean> }[];
  }[] = [
    {
      category: "Account & Billing",
      permissions: [
        { label: "Manage billing", roles: { Owner: true, Admin: false, Recruiter: false, "Hiring Manager": false, Interviewer: false, Employee: false } },
        { label: "Delete account", roles: { Owner: true, Admin: false, Recruiter: false, "Hiring Manager": false, Interviewer: false, Employee: false } },
      ],
    },
    {
      category: "User Management",
      permissions: [
        { label: "Add / remove users", roles: { Owner: true, Admin: true, Recruiter: false, "Hiring Manager": false, Interviewer: false, Employee: false } },
        { label: "Assign roles", roles: { Owner: true, Admin: true, Recruiter: false, "Hiring Manager": false, Interviewer: false, Employee: false } },
      ],
    },
    {
      category: "Jobs & Pipeline",
      permissions: [
        { label: "Post and edit jobs", roles: { Owner: true, Admin: true, Recruiter: true, "Hiring Manager": false, Interviewer: false, Employee: false } },
        { label: "Configure workflows", roles: { Owner: true, Admin: true, Recruiter: false, "Hiring Manager": false, Interviewer: false, Employee: false } },
        { label: "View assigned jobs", roles: { Owner: true, Admin: true, Recruiter: true, "Hiring Manager": true, Interviewer: false, Employee: false } },
      ],
    },
    {
      category: "Candidates",
      permissions: [
        { label: "Source & screen candidates", roles: { Owner: true, Admin: true, Recruiter: true, "Hiring Manager": false, Interviewer: false, Employee: false } },
        { label: "View candidate profiles", roles: { Owner: true, Admin: true, Recruiter: true, "Hiring Manager": true, Interviewer: true, Employee: true } },
        { label: "Add feedback & notes", roles: { Owner: true, Admin: true, Recruiter: true, "Hiring Manager": true, Interviewer: true, Employee: false } },
        { label: "Update hiring stages", roles: { Owner: true, Admin: true, Recruiter: true, "Hiring Manager": true, Interviewer: false, Employee: false } },
      ],
    },
    {
      category: "Interviews",
      permissions: [
        { label: "Schedule interviews", roles: { Owner: true, Admin: true, Recruiter: true, "Hiring Manager": false, Interviewer: false, Employee: false } },
        { label: "Submit interview feedback", roles: { Owner: true, Admin: true, Recruiter: true, "Hiring Manager": true, Interviewer: true, Employee: false } },
      ],
    },
    {
      category: "Reports & Settings",
      permissions: [
        { label: "Access reports", roles: { Owner: true, Admin: true, Recruiter: false, "Hiring Manager": false, Interviewer: false, Employee: true } },
        { label: "View salary data", roles: { Owner: true, Admin: true, Recruiter: false, "Hiring Manager": false, Interviewer: false, Employee: false } },
        { label: "System settings", roles: { Owner: true, Admin: true, Recruiter: false, "Hiring Manager": false, Interviewer: false, Employee: false } },
      ],
    },
  ];
