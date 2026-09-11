import { apiRequest } from './client';

export type GroupBy = 'day' | 'week' | 'month';
export type ChannelFilter = 'all' | 'online' | 'store' | 'whatsapp';

export interface PreviousPeriod {
  from: string;
  to: string;
  totalRevenue: number;
  orderCount: number;
  revenueChangePct: number | null;
  orderCountChangePct: number | null;
}

export interface AnalyticsSummary {
  from: string;
  to: string;
  orderCount: number;
  totalRevenue: number;
  averageOrderValue: number;
  online: { count: number; total: number };
  store: { count: number; total: number };
  whatsapp: { count: number; total: number };
  previousPeriod: PreviousPeriod;
}

export interface TopSubcategoryEntry {
  subcategoryId: string;
  subcategoryName: string;
  revenue: number;
  unitsSold: number;
}

export interface AnalyticsRangeParams {
  from?: string;
  to?: string;
  groupBy?: GroupBy;
  limit?: number;
  channel?: ChannelFilter;
}

const toQueryString = (params: AnalyticsRangeParams = {}) => {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.groupBy) qs.set('groupBy', params.groupBy);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.channel) qs.set('channel', params.channel);
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : '';
};

export const getAnalyticsSummary = (token: string, params: AnalyticsRangeParams = {}) =>
  apiRequest<{ data: AnalyticsSummary }>(`/admin/analytics/summary${toQueryString(params)}`, { token });

export const getTopSubcategories = (token: string, params: AnalyticsRangeParams = {}) =>
  apiRequest<{ data: TopSubcategoryEntry[] }>(`/admin/analytics/top-subcategories${toQueryString(params)}`, { token });
