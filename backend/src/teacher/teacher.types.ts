/**
 * Shared role constants and types for the teacher workflow.
 *
 * Internal role keys stay as the original taxonomy (pm/qa/dev/hardware) so
 * the existing DB CHECK constraints, task pipeline, and JWT payload all
 * remain valid. Display labels — "Editor", "QA", "Designer", "Printer" —
 * are mapped at the UI layer (frontend ROLE_LABELS).
 *
 * @version 1.10
 */

export const ROLE_PRIORITY = ['pm', 'qa', 'dev', 'hardware'] as const;

export type StudentRole = typeof ROLE_PRIORITY[number];

export interface RoleCount {
    pm: number;
    qa: number;
    dev: number;
    hardware: number;
}

export interface StudentWithRoleHistory {
    id: string;
    name: string;
    email: string;
    currentRole: StudentRole | null;
    lastRoles: StudentRole[];
    roleCount: RoleCount;
    suggestedRole: StudentRole | null;
}
