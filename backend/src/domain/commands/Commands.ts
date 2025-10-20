// Command definitions driving changes in the Work Package aggregate

export type CreateWorkPackageCommand = {
  type: 'CreateWorkPackage';
  workPackageId: string;
  name: string;
};

export type AddTaskCommand = {
  type: 'AddTask';
  workPackageId: string;
  taskId: string;
  title: string;
  estimateHours?: number;
};

export type ReportDailyProgressCommand = {
  type: 'ReportDailyProgress';
  workPackageId: string;
  taskId?: string;
  percent?: number;
  notes?: string;
};

export type Command =
  | CreateWorkPackageCommand
  | AddTaskCommand
  | ReportDailyProgressCommand;


