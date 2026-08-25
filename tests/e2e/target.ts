/** Never run mutating Playwright flows against production. */

export function isProductionTarget(url = process.env["BASE_URL"] || "") {
  return /uygulamamcebimde\.online/i.test(url || "");
}

export function stagingMailboxEnabled() {
  return Boolean(
    process.env["STAGING_APP_URL"] &&
      process.env["STAGING_TEST_EMAIL"] &&
      process.env["STAGING_MAILBOX_IMAP_HOST"] &&
      process.env["STAGING_MAILBOX_USER"] &&
      process.env["STAGING_MAILBOX_PASSWORD"],
  );
}
