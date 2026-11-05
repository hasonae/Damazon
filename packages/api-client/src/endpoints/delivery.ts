import type { DeliveryTaskStatus, DriverStatus } from '@damazon/shared-types';

import type { ApiClient } from '../client.js';

export interface DeliveryTask {
  readonly id: string;
  readonly status: DeliveryTaskStatus;
  readonly order: {
    readonly id: string;
    readonly orderNumber: string;
    readonly status: string;
    readonly businessName: string;
    readonly customerName: string;
    readonly customerPhone: string;
    readonly totalMinor: string;
    readonly currency: string;
  };
  readonly pickup: { readonly latitude: number | null; readonly longitude: number | null };
  readonly destination: { readonly latitude: number | null; readonly longitude: number | null };
  readonly driver: { readonly id: string; readonly name: string } | null;
  readonly estimatedArrivalAt: string | null;
  readonly createdAt: string;
}

export interface DeliveryDriver {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly status: DriverStatus;
  readonly vehicleType: string;
  readonly completedDeliveries: number;
}

export type DriverAvailability = 'available' | 'offline' | 'on_break';
export type DriverVehicleType = 'motorcycle' | 'bicycle' | 'car' | 'van' | 'truck' | 'walking';

export interface DriverApplication {
  readonly status: string | null;
  readonly vehicleType: string | null;
  readonly vehiclePlateNumber: string | null;
}

export interface DriverApplicationRequest {
  readonly vehicleType: DriverVehicleType;
  readonly vehiclePlateNumber?: string;
}

export class DeliveryApi {
  public constructor(private readonly client: ApiClient) {}

  public listTasks(status?: DeliveryTaskStatus): Promise<readonly DeliveryTask[]> {
    return this.client.get('/delivery/tasks', {
      ...(status === undefined ? {} : { query: { status } }),
    });
  }

  public listDrivers(): Promise<readonly DeliveryDriver[]> {
    return this.client.get('/delivery/drivers');
  }

  public driverApplication(): Promise<DriverApplication> {
    return this.client.get('/delivery/driver/application');
  }

  public applyAsDriver(request: DriverApplicationRequest): Promise<DriverApplication> {
    return this.client.post('/delivery/driver/application', request);
  }

  public getAvailability(): Promise<{ readonly status: DriverStatus }> {
    return this.client.get('/delivery/driver/availability');
  }

  public assignTask(taskId: string, driverId: string): Promise<DeliveryTask> {
    return this.client.post('/delivery/tasks/assign', { taskId, driverId });
  }

  public updateTaskStatus(
    taskId: string,
    status: DeliveryTaskStatus,
    cashCollected = false,
  ): Promise<DeliveryTask> {
    return this.client.patch(
      '/delivery/tasks/{id}/status',
      { status, ...(status === 'delivered' && cashCollected ? { cashCollected: true } : {}) },
      { pathParams: { id: taskId } },
    );
  }

  public async updateAvailability(status: DriverAvailability): Promise<void> {
    await this.client.patch('/delivery/driver/availability', { status });
    this.client.clearCache('delivery:');
  }

  public async updateLocation(latitude: number, longitude: number): Promise<void> {
    await this.client.patch('/delivery/driver/location', { latitude, longitude });
  }
}
