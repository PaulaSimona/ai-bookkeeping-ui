// Shape of the /api/user/me `user` payload. is_superuser was added for SPA
// Tier 2 feature gating; has_tier2 (§21 D-21-3) is the entitlement flag the
// route/nav gates key on (true iff an active membership in a tier2-enabled org).
export interface MeUser {
  role: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  has_tier2: boolean;
}

export interface profileType {
  email: string;
  role: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  is_active: boolean;
  company_name: string;
  company_business_number: string;
  company_address: string;
  company_number: string;
  company_province: string;
  company_city: string;
  company_postal_code: string;
}
