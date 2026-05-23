import { UToolsAdapter } from '@/lib/utools';

export const wnd = {
  setExpendHeight(height: number): boolean {
    return UToolsAdapter.setExpendHeight(height);
  },
};
