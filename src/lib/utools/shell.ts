import { UToolsAdapter } from '@/lib/utools';

export const shell = {
  openUrl(url: string, useInternalBrowser = true): void {
    UToolsAdapter.openUrl(url, useInternalBrowser);
  },
};
