/** 单页面历史版本硬上限。超过时只淘汰最旧的非里程碑。 */
export const MAX_VERSIONS_PER_PAGE = 50;

export function selectEvictedVersionIds(
  versions: Array<{ versionId: string; isMilestone?: boolean }>,
  max = MAX_VERSIONS_PER_PAGE,
): string[] {
  if (versions.length <= max) return [];
  const evictCount = versions.length - max;
  return versions
    .filter((version) => !version.isMilestone)
    .slice(0, evictCount)
    .map((version) => version.versionId);
}
