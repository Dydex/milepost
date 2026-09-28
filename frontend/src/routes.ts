/**
 * Every route the app exposes, as one source of truth.
 *
 * `App.tsx` renders these paths and the header Menu lists them — sharing one
 * array means a new route is reachable from the Menu the moment it is added
 * here, instead of the two silently drifting apart.
 */
export interface AppRoute {
  path: string;
  label: string;
  title: string;
}

export const APP_ROUTES: AppRoute[] = [
  { path: '/directory', label: 'Programme directory', title: 'Programme Directory' },
  { path: '/programme', label: 'Programme detail', title: 'Programme Detail' },
  { path: '/funders', label: 'Funders', title: 'Funder Dashboard' },
  { path: '/recipients', label: 'Recipients', title: 'Recipient Dashboard' },
  { path: '/recipients/standing', label: 'Standing', title: 'Recipient Standing' },
  { path: '/recipients/award-progress', label: 'Award progress', title: 'Award Progress' },
  { path: '/recipients/application-timeline', label: 'Application timeline', title: 'Application Timeline' },
  { path: '/verifiers', label: 'Verifiers', title: 'Verifier Dashboard' },
  { path: '/finalize', label: 'Finalize awards', title: 'Finalize Awards' },
  { path: '/policy', label: 'Spend policy', title: 'Spend Policy' },
  { path: '/admin', label: 'Admin', title: 'Admin' },
  { path: '/admin/standing', label: 'Admin standing lookup', title: 'Admin Standing Lookup' },
  { path: '/attestations', label: 'Attestation lookup', title: 'Attestation Lookup' },
  { path: '/schemas/register', label: 'Register schema', title: 'Register Schema' },
  { path: '/keepalive', label: 'Keepalive', title: 'Keepalive' },
  { path: '/admin/payees', label: 'Payee management', title: 'Payee Management' },
  { path: '/directory', label: 'Programme directory' },
  { path: '/programme', label: 'Programme detail' },
  { path: '/funders', label: 'Funders' },
  { path: '/recipients', label: 'Recipients' },
  { path: '/recipients/standing', label: 'Standing' },
  { path: '/recipients/award-progress', label: 'Award progress' },
  { path: '/recipients/application-timeline', label: 'Application timeline' },
  { path: '/verifiers', label: 'Verifiers' },
  { path: '/finalize', label: 'Finalize awards' },
  { path: '/policy', label: 'Spend policy' },
  { path: '/admin', label: 'Admin' },
  { path: '/admin/standing', label: 'Standing writers' },
  { path: '/attestations', label: 'Attestation lookup' },
  { path: '/schemas/register', label: 'Register schema' },
  { path: '/keepalive', label: 'Keepalive' },
  { path: '/admin/payees', label: 'Payee management' },
];

/**
 * In-page anchors on the home landing page, for the header Menu's
 * "On this page" group.
 *
 * Grows as the remaining landing sections (how it works, modes, roles) land
 * in their own issues. Listing only sections that exist keeps every entry a
 * working link instead of a placeholder anchor with nothing to scroll to.
 */
export interface HomeAnchor {
  id: string;
  label: string;
}

export const HOME_ANCHORS: HomeAnchor[] = [
  { id: 'how', label: 'How it works' },
  { id: 'roles', label: 'Roles' },
  { id: 'developers', label: 'Developers' },
];
