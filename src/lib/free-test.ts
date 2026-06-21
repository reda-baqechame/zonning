export function isFreeTestMode(): boolean {
  return process.env.ZONNING_FREE_TEST_MODE !== "false";
}

export const FREE_TEST_PRINCIPAL_ID = "free-test";
