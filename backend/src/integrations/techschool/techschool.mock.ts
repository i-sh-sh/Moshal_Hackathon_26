/**
 * Mock Tech School provider — five fixture missions covering the three spec
 * sprint themes. Enough to drive offline development of any feature that
 * depends on mission metadata.
 *
 * @version 1.00
 */

import { Injectable, Logger } from '@nestjs/common';
import {
    ListMissionsFilters,
    TechSchoolMission,
    TechSchoolProvider,
} from './techschool.interface';

const FIXTURES: readonly TechSchoolMission[] = [
    {
        id: 'tsm-gift-01',
        title: 'Sketch a personal gift in Fusion 360',
        description:
            'Use Sketch + Extrude to design a 3D object with personal meaning. ' +
            'Max height 10cm. Must be printable without supports.',
        englishTerms: ['Sketch', 'Extrude', 'Constraint', 'Origin Plane'],
        difficulty: 1,
        estimatedMinutes: 45,
        topic: 'gift',
    },
    {
        id: 'tsm-gift-02',
        title: 'Export STL and run a slicer simulation',
        description:
            'Export the model to STL, validate wall thickness ≥ 1.2mm, and ' +
            'add supports in the slicer where needed.',
        englishTerms: ['STL', 'Slicer', 'Supports', 'Layer Height', 'Wall Thickness'],
        difficulty: 2,
        estimatedMinutes: 30,
        topic: 'gift',
    },
    {
        id: 'tsm-games-01',
        title: 'Multi-component game piece',
        description:
            'Design a game with at least two interlocking parts. Use Combine ' +
            'and Joint tools. Tolerance 0.2mm for fit.',
        englishTerms: ['Combine', 'Joint', 'Tolerance', 'Assembly'],
        difficulty: 2,
        estimatedMinutes: 60,
        topic: 'games',
    },
    {
        id: 'tsm-branding-01',
        title: 'Personal logo as a 3D-printable medallion',
        description:
            'Convert a logo into an extruded 3D shape with chamfered edges. ' +
            'Test print at 50% scale before final.',
        englishTerms: ['Extrude', 'Chamfer', 'Scale', 'Test Print'],
        difficulty: 2,
        estimatedMinutes: 50,
        topic: 'branding',
    },
    {
        id: 'tsm-branding-02',
        title: 'Multi-material composition for the makeathon entry',
        description:
            'Combine two filament types in a single design. Plan support ' +
            'placement to avoid colour bleed.',
        englishTerms: ['Multi-material', 'Filament', 'Pause Layer', 'Z-seam'],
        difficulty: 3,
        estimatedMinutes: 90,
        topic: 'branding',
    },
];

@Injectable()
export class MockTechSchoolProvider implements TechSchoolProvider {
    private readonly logger = new Logger(MockTechSchoolProvider.name);

    async listMissions(filters?: ListMissionsFilters): Promise<TechSchoolMission[]> {
        this.logger.warn('[MOCK] listMissions — set TECHSCHOOL_PROVIDER=real to use live data');
        return FIXTURES.filter(
            (m) =>
                (!filters?.topic || m.topic === filters.topic) &&
                (!filters?.maxDifficulty || m.difficulty <= filters.maxDifficulty),
        ).map((m) => ({ ...m }));
    }

    async getMission(id: string): Promise<TechSchoolMission | null> {
        const m = FIXTURES.find((x) => x.id === id);
        return m ? { ...m } : null;
    }
}
