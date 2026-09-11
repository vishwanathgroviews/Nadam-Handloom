import { apiRequest } from './client';

export interface StaffProfile {
  id: string;
  email: string | null;
  phone: string | null;
  roles: string[];
  name: string | null;
  employeeId: string | null;
  department: string | null;
  jobTitle: string | null;
}

export const getMe = (token: string) => apiRequest<{ data: StaffProfile }>('/user/me', { token });
