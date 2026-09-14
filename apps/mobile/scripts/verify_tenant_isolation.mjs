import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function requireText(relativePath, text, reason) {
  const source = read(relativePath);
  if (!source.includes(text)) {
    throw new Error(`${relativePath}: missing required tenant-isolation invariant: ${reason}\nExpected: ${text}`);
  }
}

function forbidText(relativePath, text, reason) {
  const source = read(relativePath);
  if (source.toLowerCase().includes(text.toLowerCase())) {
    throw new Error(`${relativePath}: forbidden tenant leak: ${reason}\nFound: ${text}`);
  }
}

const hostProfiles = 'apps/mobile/src/hosting/hostProfiles.ts';
requireText(hostProfiles, "requireActiveOrganizationId", 'host profile lists must resolve the active tenant');
requireText(hostProfiles, ".eq('platform_organization_id', platformOrganizationId)", 'host profile queries must filter by active platform organization');
requireText(hostProfiles, 'assertHostOrganizationInActiveTenant', 'host profile mutations and deep links must fail closed across tenants');
requireText(hostProfiles, 'tenantStoragePath', 'host profile media must use tenant-prefixed storage');

const profileSetup = 'apps/mobile/src/hosting/hostProfileSetup.ts';
requireText(profileSetup, 'assertHostOrganizationInActiveTenant', 'profile setup mutations must validate active tenant ownership');
requireText(profileSetup, "platformOrganizationId: tenant.platformOrganizationId", 'profile imports must send explicit tenant identity');
requireText(profileSetup, 'tenantStoragePath', 'profile imports and galleries must use tenant-prefixed storage');

const vendors = 'apps/mobile/src/hosting/vendors.ts';
requireText(vendors, 'requireActiveOrganizationId', 'Vendor Center must resolve active tenant');
requireText(vendors, ".eq('organization_id', organizationId)", 'Vendor Center queries must filter active tenant');
forbidText(vendors, "return 'Go Melanated Verified'", 'verification copy on shared surfaces must be tenant-neutral');

const library = 'apps/mobile/src/hosting/library.ts';
requireText(library, 'requireActiveOrganizationId', 'reusable library must resolve active tenant');
requireText(library, ".eq('organization_id', organizationId)", 'reusable library must filter active tenant');

const opportunities = 'apps/mobile/src/management/opportunities.ts';
requireText(opportunities, 'requireActiveOrganizationId', 'opportunity workspace must resolve active tenant');
requireText(opportunities, ".eq('organization_id', organizationId)", 'opportunity reads and writes must filter active tenant');
requireText(opportunities, 'organization_id: organizationId', 'new opportunities must persist tenant identity');

const neutralUiFiles = [
  'apps/mobile/src/management/TenantOpportunitiesScreen.tsx',
  'apps/mobile/src/hosting/HostCopilotCard.tsx',
];
for (const file of neutralUiFiles) {
  forbidText(file, 'Melanated Adventurers', 'neutral tenant UI cannot inherit flagship identity');
  forbidText(file, 'Go Melanated meetup', 'neutral tenant UI cannot create flagship-specific event types');
  forbidText(file, 'Find events around Jacksonville', 'neutral tenant UI cannot inherit flagship geography');
}

const opportunityScreen = 'apps/mobile/src/management/TenantOpportunitiesScreen.tsx';
requireText(opportunityScreen, 'listOpportunityDiscoverySources', 'Opportunity sources must come from tenant configuration');
requireText(opportunityScreen, 'No discovery sources configured', 'non-configured tenants need a neutral empty state');
forbidText(opportunityScreen, 'city_jacksonville', 'Jacksonville sources belong only to configured/default tenant service data');
forbidText(opportunityScreen, "state || 'FL'", 'shared event creation cannot default another client to Florida');

const copilotUi = 'apps/mobile/src/hosting/HostCopilotCard.tsx';
forbidText(copilotUi, 'verified Black- and brown-owned', 'shared Copilot UI cannot impose flagship organization priorities');
forbidText(copilotUi, 'sunset hike', 'shared Copilot example must not assume an outdoor client');

const profileImportFunction = 'supabase/functions/host-profile-import-preview/index.ts';
requireText(profileImportFunction, 'platformOrganizationId', 'profile import service must receive explicit tenant identity');
requireText(profileImportFunction, 'safeTenantImportPath', 'profile import service must reject cross-tenant file paths');
requireText(profileImportFunction, 'organization_has_permission', 'profile import service must verify tenant permission');
forbidText(profileImportFunction, 'GoMelanated-ProfileImporter', 'shared import service must use neutral product identity');

const opportunityFunction = 'supabase/functions/opportunity-discover/index.ts';
requireText(opportunityFunction, 'event_builder_settings', 'discovery sources must be read from active organization settings');
requireText(opportunityFunction, 'activeOrganization.is_platform_default === true', 'legacy flagship sources must be explicitly gated');
requireText(opportunityFunction, 'event.relevanceLabel = null', 'non-default tenants must not inherit flagship demographic relevance labels');
requireText(opportunityFunction, 'action === "list_sources"', 'client must be able to load only active-tenant discovery sources');

const copilotFunction = 'supabase/functions/host-copilot/index.ts';
requireText(copilotFunction, 'activeOrganization.is_platform_default === true', 'flagship-only Copilot priorities must be explicitly gated');
requireText(copilotFunction, 'organization_has_permission', 'Host Copilot must verify active-tenant AI permission');
requireText(copilotFunction, 'Do not assume the organization is an outdoor group', 'shared Copilot must remain industry-neutral');

const hardeningMigration = 'supabase/migrations/20260914170000_tenant_isolation_hardening_v1.sql';
requireText(hardeningMigration, 'alter column platform_organization_id set not null', 'public host identities must always belong to a platform tenant');
requireText(hardeningMigration, 'drop policy if exists "Authenticated users can read vendor profiles"', 'global Vendor Center reads must be removed');
requireText(hardeningMigration, 'organization_id = private.active_organization_for_profile', 'private Host Center policies must enforce active tenant');
requireText(hardeningMigration, "(storage.foldername(name))[1] = 'tenants'", 'new Host Center storage must require tenant-prefixed paths');
requireText(hardeningMigration, 'It no longer provisions a tenant as a side effect', 'public profile identity must not mutate/provision parent tenant identity');
forbidText(hardeningMigration, 'insert into public.organizations', 'host profile synchronization must never create another tenant');

const failClosedMigration = 'supabase/migrations/20260914170200_tenant_host_identity_fail_closed_v2.sql';
requireText(failClosedMigration, 'o.legacy_host_organization_id = h.id', 'legacy host identities must reconcile from explicit historical ownership');
requireText(failClosedMigration, 'o.primary_host_organization_id = h.id', 'primary host identities must reconcile from explicit tenant ownership');
requireText(failClosedMigration, "raise exception 'A platform organization is required for every host profile'", 'new host identities must fail closed without explicit tenant ownership');
forbidText(failClosedMigration, 'active_organization_for_profile', 'host identity assignment must not infer ownership from the currently selected tenant');
forbidText(failClosedMigration, 'is_platform_default = true', 'host identity assignment must not fall back to the flagship tenant');

const bridgeMigration = 'supabase/migrations/20260914170100_tenant_host_access_bridge_v1.sql';
requireText(bridgeMigration, 'o.is_platform_default = false', 'tenant RBAC bridge must preserve flagship-specific host approval semantics');
requireText(bridgeMigration, "private.has_organization_permission(o.id, 'events.manage'", 'non-default client hosts must authorize through tenant RBAC');
requireText(bridgeMigration, 'Active tenant hosts read opportunities', 'opportunity RLS must be active-tenant scoped');

console.log('Tenant isolation invariants verified.');
