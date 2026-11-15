import { expect, test } from "vitest";

// Deliberately failing (task 49): CI must report a failure and the squad must stop.
test("deliberately failing check", () => {
  expect(1 + 1).toBe(3);
});
