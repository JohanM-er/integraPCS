import { gql } from '@apollo/client';

export const GET_WORK_PACKAGE = gql`
  query GetWorkPackage($id: ID!) {
    workPackage(id: $id) {
      id
      name
      tasks { id title status }
      lastUpdatedAt
    }
  }
`;


