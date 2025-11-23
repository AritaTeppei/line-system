import { Module } from '@nestjs/common';
import { AdminTenantsController } from './admin-tenants.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AdminTenantUsersController } from './admin-tenant-users.controller';

@Module({
  controllers: [AdminTenantsController, AdminTenantUsersController],
  providers: [PrismaService],
})
export class AdminModule {}
