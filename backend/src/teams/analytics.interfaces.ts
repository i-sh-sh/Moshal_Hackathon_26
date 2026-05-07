export interface TeacherDashboardSummary {
  totalStudents: number;
  totalTeams: number;
  activeTeams: number;
  approvedTasks: number;
  totalTasks: number;
  averageProgressPercent: number;
}

export interface StudentInsight {
  userId: string;
  name: string;
  email: string;
  teamId: string | null;
  teamName: string | null;
  role: 'pm' | 'qa' | 'dev' | 'hardware' | null;
  totalActiveTimeSeconds: number;
  totalTasks: number;
  approvedTasks: number;
  hintCount: number;
  tasksPerHour: number | null;
  riskLevel: 'ok' | 'watch' | 'needs_attention';
  insightReason: string;
}

export interface TeamInsight {
  teamId: string;
  teamName: string;
  score: number;
  sprintStatus: string;
  isCompleted: boolean;
  totalTasks: number;
  approvedTasks: number;
  progressPercent: number;
  totalHints: number;
}

export interface DifficultTask {
  taskId: string;
  title: string;
  teamName: string;
  hintCount: number;
  status: string;
}

export interface TeacherDashboard {
  summary: TeacherDashboardSummary;
  students: StudentInsight[];
  teams: TeamInsight[];
  difficultTasks: DifficultTask[];
}
