import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import { HealthService, type HealthReport } from './health.service.js';

@Controller('health')
export class HealthController {
  public constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Public()
  @Get()
  public live(): Promise<HealthReport> {
    return this.healthService.check();
  }

  @Public()
  @Get('ready')
  public async ready(): Promise<HealthReport> {
    const report = await this.healthService.check();
    if (report.status !== 'ok') {
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'One or more dependencies are not ready',
      });
    }
    return report;
  }
}
