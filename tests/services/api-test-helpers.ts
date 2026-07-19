/**
 * Shared mock for the apiClient singleton, used across services/api/*.test.ts.
 */
export const mockApiClient = {
  get: jest.fn(),
  post: jest.fn(),
  postUrlEncoded: jest.fn(),
  postFormData: jest.fn(),
  getApiFeatures: jest.fn(() => ({})),
  getServer: jest.fn(),
  setServer: jest.fn(),
};
