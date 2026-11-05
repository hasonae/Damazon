/**
 * Dashboard data loading.
 *
 * The console talks to the same API as every other client, through
 * `@damazon/api-client`. Until the analytics and orders endpoints exist, this
 * returns an empty set rather than inventing numbers: an operator must never see
 * a fabricated total.
 */

import { useCallback, useEffect, useState } from 'react';

import { useConsoleSession } from '../core/console-session.js';

export interface DashboardMetric {
  readonly key: 'orders' | 'businesses' | 'pendingBusinesses';
  readonly label: string;
  readonly value: string;
  readonly caption: string;
}

export interface RecentOrderRow {
  readonly id: string;
  readonly business: string;
  readonly city: string;
  readonly status: string;
  readonly totalMinorUnits: string;
  readonly currency: string;
}

export interface DashboardData {
  readonly metrics: readonly DashboardMetric[];
  readonly recentOrders: readonly RecentOrderRow[];
}

const EMPTY: DashboardData = { metrics: [], recentOrders: [] };

export function useDashboardMetrics(): DashboardData & {
  readonly isLoading: boolean;
  readonly error: string | null;
} {
  const { client, status, can } = useConsoleSession();
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (status !== 'authenticated') {
      setData(EMPTY);
      setIsLoading(false);
      return;
    }

    if (!can('orders:read') || !can('businesses:read')) {
      setData(EMPTY);
      setError('لا تتوفر صلاحيات قراءة الطلبات والشركات لهذا القسم.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const dashboard = await client.admin.dashboard();
      setData({
        metrics: [
          {
            key: 'orders',
            label: 'إجمالي الطلبات',
            value: dashboard.totalOrders.toLocaleString('ar-SY'),
            caption: `منها ${dashboard.openOrders.toLocaleString('ar-SY')} طلب مفتوح`,
          },
          {
            key: 'businesses',
            label: 'الأنشطة الفعالة',
            value: dashboard.activeBusinesses.toLocaleString('ar-SY'),
            caption: 'معتمدة ونشطة',
          },
          {
            key: 'pendingBusinesses',
            label: 'طلبات اعتماد الأنشطة',
            value: dashboard.businessesAwaitingReview.toLocaleString('ar-SY'),
            caption: 'بانتظار المراجعة',
          },
        ],
        recentOrders: dashboard.recentOrders.map((order) => ({
          id: order.orderNumber,
          business: order.business,
          city: order.city,
          status: order.status,
          totalMinorUnits: order.totalMinorUnits,
          currency: order.currency,
        })),
      });
    } catch {
      setError('تعذّر تحميل مؤشرات لوحة الإدارة.');
    } finally {
      setIsLoading(false);
    }
  }, [can, client, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...data, isLoading, error };
}
