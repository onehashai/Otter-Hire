import { JobWorkspaceStageProvider } from "./context";

export default function JobStageLayout({ children }: { children: React.ReactNode }) {
  return <JobWorkspaceStageProvider>{children}</JobWorkspaceStageProvider>;
}
