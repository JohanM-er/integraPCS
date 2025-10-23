
export const typeDefs = /* GraphQL */ `
  # Work Package GraphQL Schema

  type WorkPackage {
    id: ID!
    name: String!
    tasks: [Task!]!
    lastUpdatedAt: String!
  }

  type Task {
    id: ID!
    title: String!
    status: String!
  }

  type Event {
    type: String!
  }

  extend type Query {
    workPackage(id: ID!): WorkPackage
  }

  type Mutation {
    createWorkPackage(id: ID!, name: String!): [Event!]!
    addTask(workPackageId: ID!, taskId: ID!, title: String!, estimateHours: Float): [Event!]!
    reportDailyProgress(workPackageId: ID!, taskId: ID, percent: Float, notes: String): [Event!]!
  }
`;

// Frontend does not export server-side resolvers