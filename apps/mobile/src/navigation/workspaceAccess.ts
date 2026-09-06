import { getOutingHostAccess } from '../hosting/api';
import { getVendorAccess } from '../vendor/vendorAccess';

export type WorkspaceAccess = {
  hostApproved: boolean;
  vendorApproved: boolean;
};

export async function getWorkspaceAccess(): Promise<WorkspaceAccess> {
  const [host, vendor] = await Promise.all([
    getOutingHostAccess().catch(() => ({ approved: false } as const)),
    getVendorAccess().catch(() => ({ approved: false, record: null })),
  ]);

  return {
    hostApproved: host.approved === true,
    vendorApproved: vendor.approved === true,
  };
}
