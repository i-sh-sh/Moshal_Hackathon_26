/**
 * Shared role constants and types for the teacher workflow.
 *
 * Roles correspond to the 3D-print mission pipeline:
 *   designer → editor → qa → printer
 *
 * @version 1.00
 */

export const ROLE_PRIORITY = ['designer', 'editor', 'qa', 'printer'] as const;

export type StudentRole = typeof ROLE_PRIORITY[number];

export interface RoleCount {
    designer: number;
    editor: number;
    qa: number;
    printer: number;
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
