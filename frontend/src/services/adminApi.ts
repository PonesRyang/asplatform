import api from './api'
import type {
  UserGroup,
  CreateUserGroupRequest,
  CreateAdminUserRequest,
  UpdateAdminUserRequest,
  AdminUserResponse,
  TokenRecord,
  CreateTokenRequest,
  BatchCreateTokenRequest,
  BatchDeleteTokenRequest,
  CreateGrantConfigItemRequest,
  UpdateTokenRequest,
  UpdateGrantConfigItemRequest,
  GrantConfigCategory,
  GrantConfigItem,
  LiteratureDatabaseConfig,
  UpdateLiteratureDatabaseConfigRequest,
} from '../types/admin'

// ── User Groups ──

export async function listGroups(): Promise<UserGroup[]> {
  const response = await api.get<UserGroup[]>('/api/admin/groups')
  return response.data
}

export async function createGroup(data: CreateUserGroupRequest): Promise<UserGroup> {
  const response = await api.post<UserGroup>('/api/admin/groups', data)
  return response.data
}

export async function updateGroup(id: number, data: CreateUserGroupRequest): Promise<UserGroup> {
  const response = await api.put<UserGroup>(`/api/admin/groups/${id}`, data)
  return response.data
}

export async function deleteGroup(id: number): Promise<void> {
  await api.delete(`/api/admin/groups/${id}`)
}

// ── Admin Users ──

export async function listUsers(): Promise<AdminUserResponse[]> {
  const response = await api.get<AdminUserResponse[]>('/api/admin/users')
  return response.data
}

export async function createUser(data: CreateAdminUserRequest): Promise<AdminUserResponse> {
  const response = await api.post<AdminUserResponse>('/api/admin/users', data)
  return response.data
}

export async function updateUser(id: number, data: UpdateAdminUserRequest): Promise<AdminUserResponse> {
  const response = await api.put<AdminUserResponse>(`/api/admin/users/${id}`, data)
  return response.data
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/api/admin/users/${id}`)
}

// ── Service Tokens ──

export async function listTokens(search?: string): Promise<TokenRecord[]> {
  const response = await api.get<TokenRecord[]>('/api/admin/tokens', {
    params: search ? { search } : undefined,
  })
  return response.data
}

export async function createToken(data: CreateTokenRequest): Promise<TokenRecord> {
  const response = await api.post<TokenRecord>('/api/admin/tokens', data)
  return response.data
}

export async function createTokensBatch(data: BatchCreateTokenRequest): Promise<TokenRecord[]> {
  const response = await api.post<TokenRecord[]>('/api/admin/tokens/batch', data)
  return response.data
}

export async function deleteTokensBatch(ids: number[]): Promise<void> {
  const data: BatchDeleteTokenRequest = { token_ids: ids }
  await api.post('/api/admin/tokens/batch-delete', data)
}

export async function deleteToken(id: number): Promise<void> {
  await api.delete(`/api/admin/tokens/${id}`)
}

export async function updateToken(id: number, data: UpdateTokenRequest): Promise<TokenRecord> {
  const response = await api.put<TokenRecord>(`/api/admin/tokens/${id}`, data)
  return response.data
}

// ── Grant Application Config ──

export async function listGrantConfigItems(category?: GrantConfigCategory, search?: string): Promise<GrantConfigItem[]> {
  const response = await api.get<GrantConfigItem[]>('/api/admin/grant-config', {
    params: {
      ...(category ? { category } : {}),
      ...(search ? { search } : {}),
    },
  })
  return response.data
}

export async function createGrantConfigItem(data: CreateGrantConfigItemRequest): Promise<GrantConfigItem> {
  const response = await api.post<GrantConfigItem>('/api/admin/grant-config', data)
  return response.data
}

export async function updateGrantConfigItem(id: number, data: UpdateGrantConfigItemRequest): Promise<GrantConfigItem> {
  const response = await api.put<GrantConfigItem>(`/api/admin/grant-config/${id}`, data)
  return response.data
}

export async function deleteGrantConfigItem(id: number): Promise<void> {
  await api.delete(`/api/admin/grant-config/${id}`)
}

// ── Literature Database Config ──

export async function listLiteratureDatabases(): Promise<LiteratureDatabaseConfig[]> {
  const response = await api.get<LiteratureDatabaseConfig[]>('/api/admin/literature-databases')
  return response.data
}

export async function updateLiteratureDatabase(
  id: number,
  data: UpdateLiteratureDatabaseConfigRequest,
): Promise<LiteratureDatabaseConfig> {
  const response = await api.put<LiteratureDatabaseConfig>(`/api/admin/literature-databases/${id}`, data)
  return response.data
}
