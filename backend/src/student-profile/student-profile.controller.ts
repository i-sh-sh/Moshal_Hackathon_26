import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { StudentProfileService } from './student-profile.service';

@Controller('student-profiles')
export class StudentProfileController {
    constructor(private readonly profiles: StudentProfileService) {}

    /** GET /student-profiles */
    @Get()
    getAll() {
        return this.profiles.getAllProfiles();
    }

    /** GET /student-profiles/alerts?unread=true */
    @Get('alerts')
    getAlerts(@Query('unread') unread?: string) {
        return this.profiles.getAlerts(unread !== 'false');
    }

    /** PATCH /student-profiles/alerts/read-all */
    @Patch('alerts/read-all')
    markAllRead() {
        return this.profiles.markAllAlertsRead();
    }

    /** PATCH /student-profiles/alerts/:id/read */
    @Patch('alerts/:id/read')
    markRead(@Param('id') id: string) {
        return this.profiles.markAlertRead(id);
    }

    /** GET /student-profiles/:userId */
    @Get(':userId')
    getOne(@Param('userId') userId: string) {
        return this.profiles.getProfile(userId);
    }

    /** GET /student-profiles/:userId/snapshots */
    @Get(':userId/snapshots')
    getSnapshots(@Param('userId') userId: string) {
        return this.profiles.getSnapshots(userId);
    }
}
