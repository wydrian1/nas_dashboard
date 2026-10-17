// Execute a visible UI action once. A delayed render is not a rejected action:
// report pending state explicitly and let the reviewer observe, never re-click.
export async function performReviewAction(page, target, action, timeout = 10000) {
  if (action.kind === 'fill') await target.fill(action.value);
  else await target[action.kind]();
  try {
    await page.locator('.game-grid[aria-busy="false"]').waitFor({ timeout });
    return {};
  } catch {
    return { pending: true, warning: 'A műveletet elküldtük, de a felület még frissül. Használd az observe műveletet; ne ismételd meg a kattintást.' };
  }
}
