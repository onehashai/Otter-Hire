/**
 * Shared types and mock data for the pipeline (jobs list + job kanban).
 * Replace with API calls when backend is ready.
 */

export interface PipelineCandidate {
  id: string;
  name: string;
  role: string;
  score: number;
  stageId: string;
}

export interface PipelineJob {
  id: string;
  title: string;
  dept: string;
  location: string;
  status: "Open" | "Draft" | "Closed";
  candidates: PipelineCandidate[];
  stages: { id: string; name: string }[];
  lastActivity: string;
}

export const pipelineJobs: PipelineJob[] = [
  {
    id: "1",
    title: "Senior Frontend Engineer",
    dept: "Engineering",
    location: "San Francisco, US",
    status: "Open",
    stages: [
      { id: "s1", name: "Applied" },
      { id: "s2", name: "Screening" },
      { id: "s3", name: "Technical Interview" },
      { id: "s4", name: "Culture Fit" },
      { id: "s5", name: "Offer" },
      { id: "s6", name: "Hired" },
    ],
    candidates: [
      { id: "c1", name: "Emma Wilson", role: "Frontend Engineer", score: 78, stageId: "s1" },
      { id: "c2", name: "Liam Park", role: "Frontend Engineer", score: 65, stageId: "s1" },
      { id: "c3", name: "Alex Rivera", role: "Sr. Frontend Engineer", score: 92, stageId: "s3" },
      { id: "c4", name: "Jordan Lee", role: "Frontend Lead", score: 85, stageId: "s4" },
      { id: "c5", name: "Sam Chen", role: "Frontend Developer", score: 76, stageId: "s2" },
    ],
    lastActivity: "2h ago",
  },
  {
    id: "2",
    title: "Product Designer",
    dept: "Design",
    location: "Remote",
    status: "Open",
    stages: [
      { id: "s1", name: "Applied" },
      { id: "s2", name: "Portfolio Review" },
      { id: "s3", name: "Design Challenge" },
      { id: "s4", name: "Interview" },
      { id: "s5", name: "Offer" },
      { id: "s6", name: "Hired" },
    ],
    candidates: [
      { id: "c6", name: "Maria Kim", role: "Product Designer", score: 88, stageId: "s4" },
      { id: "c7", name: "Noah Patel", role: "UI/UX Designer", score: 72, stageId: "s2" },
    ],
    lastActivity: "5h ago",
  },
  {
    id: "3",
    title: "Data Scientist",
    dept: "Data",
    location: "Berlin, DE",
    status: "Draft",
    stages: [
      { id: "s1", name: "Applied" },
      { id: "s2", name: "Screening" },
      { id: "s3", name: "Interview" },
      { id: "s4", name: "Offer" },
      { id: "s5", name: "Hired" },
    ],
    candidates: [],
    lastActivity: "1d ago",
  },
  {
    id: "4",
    title: "Engineering Manager",
    dept: "Engineering",
    location: "New York, US",
    status: "Open",
    stages: [
      { id: "s1", name: "Applied" },
      { id: "s2", name: "Screening" },
      { id: "s3", name: "Hiring Manager Interview" },
      { id: "s4", name: "Panel Interview" },
      { id: "s5", name: "Reference Check" },
      { id: "s6", name: "Offer" },
      { id: "s7", name: "Hired" },
    ],
    candidates: [
      { id: "c8", name: "Taylor Brooks", role: "Engineering Manager", score: 90, stageId: "s3" },
      { id: "c9", name: "Casey Morgan", role: "Tech Lead", score: 82, stageId: "s1" },
      { id: "c10", name: "Riley Nguyen", role: "Sr. Engineer", score: 79, stageId: "s2" },
    ],
    lastActivity: "3h ago",
  },
  {
    id: "5",
    title: "Marketing Lead",
    dept: "Marketing",
    location: "London, UK",
    status: "Closed",
    stages: [
      { id: "s1", name: "Applied" },
      { id: "s2", name: "Screening" },
      { id: "s3", name: "Interview" },
      { id: "s4", name: "Offer" },
      { id: "s5", name: "Hired" },
    ],
    candidates: [
      { id: "c11", name: "Avery Thompson", role: "Marketing Manager", score: 86, stageId: "s5" },
    ],
    lastActivity: "5d ago",
  },
];

export const statusVariant = (s: string): "default" | "secondary" | "outline" =>
  s === "Open" ? "default" : s === "Draft" ? "secondary" : "outline";
