import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
    TeacherDashboard,
    StudentInsight,
    TeamInsight,
    DifficultTask,
} from './analytics.interfaces';

@Injectable()
export class TeamsService {
    private readonly logger = new Logger(TeamsService.name);

    constructor(private readonly supabase: SupabaseService) {}

    async getTeacherDashboard(): Promise<TeacherDashboard> {
        // 1. Fetch data from views and tables
        let studentAnalytics: any[] = [];
        let teamLeaderboard: any[] = [];
        let allTeams: any[] = [];
        let allTasks: any[] = [];
        let allHints: any[] = [];

        try {
            const [
                { data: sData, error: sErr },
                { data: tData, error: tErr },
                { data: teamsData, error: teamsErr },
                { data: tasksData, error: tasksErr },
                { data: hintsData, error: hintsErr },
            ] = await Promise.all([
                this.supabase.db.from('teacher_analytics').select('*'),
                this.supabase.db.from('group_leaderboard').select('*'),
                this.supabase.db.from('teams').select('id, name'),
                this.supabase.db.from('tasks').select('id, title, team_id, status'),
                this.supabase.db.from('hint_logs').select('id, user_id, team_id, task_id'),
            ]);

            if (sErr) this.logger.error(`Student analytics fetch error: ${sErr.message}`);
            if (tErr) this.logger.error(`Team leaderboard fetch error: ${tErr.message}`);
            if (teamsErr) this.logger.error(`Teams fetch error: ${teamsErr.message}`);
            if (tasksErr) this.logger.error(`Tasks fetch error: ${tasksErr.message}`);
            if (hintsErr) this.logger.error(`Hints fetch error: ${hintsErr.message}`);

            studentAnalytics = sData ?? [];
            teamLeaderboard = tData ?? [];
            allTeams = teamsData ?? [];
            allTasks = tasksData ?? [];
            allHints = hintsData ?? [];
        } catch (err) {
            this.logger.error(`Unexpected error during teacher dashboard data fetch: ${err}`);
        }

        const teamsMap = new Map(allTeams.map((t) => [t.id, t.name]));

        // 2. Process Students
        const students: StudentInsight[] = studentAnalytics.map((s) => {
            const userHints = allHints.filter((h) => h.user_id === s.user_id).length;
            const activeTime = s.total_active_time ?? 0;
            const approved = s.approved_tasks ?? 0;

            let riskLevel: StudentInsight['riskLevel'] = 'ok';
            let insightReason = 'Normal progress';

            // Risk Scoring Logic
            if (activeTime > 3600 && approved === 0) {
                riskLevel = 'needs_attention';
                insightReason = 'High active time but no tasks approved';
            } else if (userHints >= 4) {
                riskLevel = 'needs_attention';
                insightReason = 'High hint usage (potential blocker)';
            } else if (activeTime < 900 && approved > 2) {
                riskLevel = 'watch';
                insightReason = 'Unusually fast task completion';
            } else if (userHints >= 2) {
                riskLevel = 'watch';
                insightReason = 'Moderate hint usage';
            } else if (activeTime > 1800 && approved < 1) {
                riskLevel = 'watch';
                insightReason = 'Low progress relative to time spent';
            }

            return {
                userId: s.user_id,
                name: s.name,
                email: s.email,
                teamId: s.current_team_id,
                teamName: s.current_team_id ? teamsMap.get(s.current_team_id) || null : null,
                role: s.current_role,
                totalActiveTimeSeconds: activeTime,
                totalTasks: s.total_tasks ?? 0,
                approvedTasks: approved,
                hintCount: userHints,
                tasksPerHour: s.tasks_per_hour ?? null,
                riskLevel,
                insightReason,
            };
        });

        // 3. Process Teams
        const teams: TeamInsight[] = teamLeaderboard.map((t) => {
            const teamTasks = allTasks.filter((tk) => tk.team_id === t.id);
            const teamHints = allHints.filter((h) => h.team_id === t.id).length;
            const total = teamTasks.length;
            const approved = t.approved_task_count ?? 0;
            const progress = total > 0 ? Math.round((approved / total) * 100) : 0;

            return {
                teamId: t.id,
                teamName: t.name,
                score: t.accumulated_score ?? 0,
                sprintStatus: t.sprint_status,
                isCompleted: t.is_completed ?? false,
                totalTasks: total,
                approvedTasks: approved,
                progressPercent: progress,
                totalHints: teamHints,
            };
        });

        // 4. Process Difficult Tasks (top 5 by hint count)
        const taskHints = new Map<string, number>();
        allHints.forEach((h) => {
            if (h.task_id) {
                taskHints.set(h.task_id, (taskHints.get(h.task_id) || 0) + 1);
            }
        });

        const difficultTasks: DifficultTask[] = allTasks
            .map((tk) => ({
                taskId: tk.id,
                title: tk.title,
                teamName: teamsMap.get(tk.team_id) || 'Unknown',
                hintCount: taskHints.get(tk.id) || 0,
                status: tk.status,
            }))
            .filter((tk) => tk.hintCount > 0)
            .sort((a, b) => b.hintCount - a.hintCount)
            .slice(0, 5);

        // 5. Summary
        const totalTasksSummary = teams.reduce((acc, t) => acc + t.totalTasks, 0);
        const approvedTasksSummary = teams.reduce((acc, t) => acc + t.approvedTasks, 0);
        const activeTeams = teams.filter((t) => t.totalTasks > 0 && !t.isCompleted).length;

        return {
            summary: {
                totalStudents: students.length,
                totalTeams: teams.length,
                activeTeams,
                approvedTasks: approvedTasksSummary,
                totalTasks: totalTasksSummary,
                averageProgressPercent: teams.length > 0
                    ? Math.round(teams.reduce((acc, t) => acc + t.progressPercent, 0) / teams.length)
                    : 0,
            },
            students,
            teams,
            difficultTasks,
        };
    }

    async checkAndCompleteTeam(teamId: string, sprintId: string): Promise<void> {
        const { data: tasks } = await this.supabase.db
            .from('tasks')
            .select('status')
            .eq('team_id', teamId)
            .eq('sprint_id', sprintId);

        if (!tasks || tasks.length === 0) return;

        const allApproved = tasks.every((t) => t.status === 'approved');

        if (allApproved) {
            await this.supabase.db
                .from('teams')
                .update({ is_completed: true, sprint_status: 'completed' })
                .eq('id', teamId);

            this.logger.log(`Team ${teamId} completed sprint ${sprintId}`);
        }
    }

    async getGroupLeaderboard(): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('group_leaderboard')
            .select('*');
        return data ?? [];
    }

    async getIndividualLeaderboard(): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('individual_leaderboard')
            .select('*')
            .lte('rank', 3);
        return data ?? [];
    }

    async getTeacherAnalytics(): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('teacher_analytics')
            .select('*');
        return data ?? [];
    }

    async getTeamById(id: string): Promise<unknown> {
        const { data } = await this.supabase.db
            .from('teams')
            .select(`
                id, name, accumulated_score, sprint_status, is_completed,
                current_challenge_id, current_sprint_id,
                sprints:current_sprint_id (id, title, description)
            `)
            .eq('id', id)
            .maybeSingle();

        return data ?? null;
    }

    async getSprintProgress(teamId: string, sprintId: string): Promise<unknown> {
        const { data: tasks } = await this.supabase.db
            .from('tasks')
            .select('status')
            .eq('team_id', teamId)
            .eq('sprint_id', sprintId);

        const total = tasks?.length ?? 0;
        const approved = tasks?.filter((t) => t.status === 'approved').length ?? 0;
        return { total, approved };
    }
}
