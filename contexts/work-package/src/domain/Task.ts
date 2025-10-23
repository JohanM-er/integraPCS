export interface Task {
  id: string;
  title: string;
  estimateHours?: number;
  status: 'todo' | 'in_progress' | 'done';
}