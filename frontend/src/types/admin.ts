export interface UserGroup {
  id: number;
  name: string;
  description?: string;
  permissions: string;
}

export interface CreateUserGroupRequest {
  name: string;
  description?: string;
  permissions: string;
}

export interface AdminUserResponse {
  id: number;
  username: string;
  full_name?: string;
  email?: string;
  is_active: boolean;
  group_id?: number;
  group?: UserGroup;
}

export interface CreateAdminUserRequest {
  username: string;
  password: string;
  full_name?: string;
  email?: string;
  is_active?: boolean;
  group_id?: number;
}

export interface UpdateAdminUserRequest {
  full_name?: string;
  email?: string;
  is_active?: boolean;
  group_id?: number;
}

export interface TokenRecord {
  id: number;
  token: string;
  created_at: string;
  expires_at?: string;
  is_active: boolean;
  ai_quota: number;
  used_quota: number;
  permissions: string;
}

export interface CreateTokenRequest {
  ai_quota?: number;
  permissions?: string | string[];
  expires_days?: number;
}

export interface BatchCreateTokenRequest {
  ai_quota?: number;
  permissions?: string | string[];
  expires_days?: number;
  count?: number;
}

export interface BatchDeleteTokenRequest {
  token_ids: number[];
}

export interface UpdateTokenRequest {
  ai_quota?: number;
  is_active?: boolean;
  permissions?: string;
  expires_at?: string;
}

export type GrantConfigCategory = 'fund_type' | 'research_area' | 'disease' | 'variable_type' | 'phenotype';

export interface GrantConfigItem {
  id: number;
  category: GrantConfigCategory;
  label: string;
  value: string;
  parent_id?: number | null;
  parent_label?: string | null;
  sort_order: number;
  is_active: boolean;
  source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateGrantConfigItemRequest {
  category: GrantConfigCategory;
  label: string;
  value?: string;
  parent_id?: number | null;
  sort_order?: number;
  is_active?: boolean;
  source?: string;
}

export interface UpdateGrantConfigItemRequest {
  label?: string;
  value?: string;
  parent_id?: number | null;
  sort_order?: number;
  is_active?: boolean;
  source?: string;
}
