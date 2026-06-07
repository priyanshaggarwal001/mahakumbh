export type Skill = 'Medical' | 'Security' | 'Translation' | 'Logistics' | 'Crowd Control';

export interface Volunteer {
  id: number;
  name: string;
  skills: Skill[];
  status: 'active' | 'off-duty';
  location_id: number | null;
  workload: number; // minutes or count of tasks
}

export interface Sector {
  id: number;
  name: string;
  capacity: number;
  current_demand: number; // 0-100 scale
  volunteer_count: number;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  required_skills: Skill[];
  sector_id: number;
  assigned_to: number | null; // volunteer_id
  status: 'pending' | 'in-progress' | 'completed';
}
