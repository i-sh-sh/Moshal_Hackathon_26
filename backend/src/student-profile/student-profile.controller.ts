import { Controller, Get, Param } from '@nestjs/common';
import { StudentProfileService } from './student-profile.service';

@Controller('student-profiles')
export class StudentProfileController {
    constructor(private readonly profiles: StudentProfileService) {}

    /** GET /student-profiles — all profiles (teacher view) */
    @Get()
    getAll() {
        return this.profiles.getAllProfiles();
    }

    /** GET /student-profiles/:userId */
    @Get(':userId')
    getOne(@Param('userId') userId: string) {
        return this.profiles.getProfile(userId);
    }

    /** GET /student-profiles/:userId/snapshots — progress history */
    @Get(':userId/snapshots')
    getSnapshots(@Param('userId') userId: string) {
        return this.profiles.getSnapshots(userId);
    }
}
