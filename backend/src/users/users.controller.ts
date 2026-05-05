import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
    constructor(private readonly users: UsersService) {}

    @Get()
    findAll() {
        return this.users.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.users.findOne(id);
    }
}
