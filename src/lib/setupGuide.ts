/** A reopened guide is visible without resetting the saved first-run flag. */
export function isSetupGuideVisible(settings: {
  _hasHydrated: boolean;
  setupGuideOpen: boolean;
  setupGuideSeen: boolean;
}): boolean {
  return settings._hasHydrated &&
    (settings.setupGuideOpen || !settings.setupGuideSeen);
}
