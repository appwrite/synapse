export default {
  preset: "ts-jest",
  testEnvironment: "node",
  silent: true,
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "js"],
  moduleNameMapper: {
    "^node-pty$": "<rootDir>/src/__mocks__/node-pty.ts",
  },
};
