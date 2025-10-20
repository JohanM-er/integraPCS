import { config } from 'dotenv';

config({ path: '.env.test' });

// Increase timeout for integration tests
jest.setTimeout(30000);

// Setup test environment hooks
beforeAll(() => {
  if (process.env.NODE_ENV === 'test') {
    // eslint-disable-next-line no-console
    console.log('Setting up test environment...');
  }
});

afterAll(() => {
  if (process.env.NODE_ENV === 'test') {
    // eslint-disable-next-line no-console
    console.log('Cleaning up test environment...');
  }
});