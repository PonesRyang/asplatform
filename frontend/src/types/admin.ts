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
