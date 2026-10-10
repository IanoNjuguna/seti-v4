import { get } from './client';
import type { HomeDashboard } from './home.types';

export async function fetchHomeDashboard(userId: string): Promise<HomeDashboard> {
  return get<HomeDashboard>(`/users/${userId}/home`);
}
