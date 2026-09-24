import { describe, expect, it } from "vitest";

import { assertNever } from "./index";

describe("assertNever", () => {
  it("throws for unexpected runtime values", () => {
    expect(() => assertNever("unexpected" as never)).toThrow("Unexpected value: unexpected");
  });
});
