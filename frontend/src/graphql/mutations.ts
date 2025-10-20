import { gql } from '@apollo/client';

export const CREATE_WORK_PACKAGE = gql`
  mutation CreateWorkPackage($id: ID!, $name: String!) {
    createWorkPackage(id: $id, name: $name) { type }
  }
`;

export const ADD_TASK = gql`
  mutation AddTask($workPackageId: ID!, $taskId: ID!, $title: String!, $estimateHours: Float) {
    addTask(workPackageId: $workPackageId, taskId: $taskId, title: $title, estimateHours: $estimateHours) { type }
  }
`;

export const REPORT_DAILY_PROGRESS = gql`
  mutation ReportDailyProgress($workPackageId: ID!, $taskId: ID, $percent: Float, $notes: String) {
    reportDailyProgress(workPackageId: $workPackageId, taskId: $taskId, percent: $percent, notes: $notes) { type }
  }
`;


