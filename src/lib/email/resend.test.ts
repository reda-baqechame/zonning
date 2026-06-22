import { afterEach, describe, expect, it } from "vitest";
import { sendEmail } from "./resend";

describe("sendEmail", () => {
  const originalKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
  });

  it("does not report success when delivery is disabled", async () => {
    delete process.env.RESEND_API_KEY;

    await expect(
      sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      })
    ).resolves.toEqual({
      ok: false,
      error: "RESEND_API_KEY not configured",
    });
  });
});
