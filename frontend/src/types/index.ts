// User types
export interface User {
    id: string;
    email: string;
    first_name: string;
    middle_name?: string;
    last_name?: string;
    full_name: string;
    phone?: string;
    avatar_url?: string;
    status: UserStatus;
    email_verified: boolean;
    roles: RoleBasic[];
    created_at: string;
}

export enum UserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    SUSPENDED = 'suspended',
    PENDING = 'pending',
    LOCKED = 'locked',
}

export interface RoleBasic {
    id: string;
    name: string;
    display_name: string;
    level: number;
}

// Tenant types
export interface Tenant {
    id: string;
    name: string;
    slug: string;
    domain?: string;
    email: string;
    phone?: string;
    website?: string;
    logo_url?: string;
    primary_color: string;
    secondary_color: string;
    status: TenantStatus;
    timezone: string;
    locale: string;
    currency: string;
    max_users: number;
    max_students: number;
    created_at: string;
}

export enum TenantStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    SUSPENDED = 'suspended',
    TRIAL = 'trial',
    EXPIRED = 'expired',
}

// Academic types
export interface SchoolClass {
    id: string;
    tenant_id: string;
    name: string;
    section: string;
    capacity: number;
    class_teacher_id?: string;
    student_count: number;  // Actual enrolled student count
    created_at: string;
    updated_at?: string;
}

// Role types
export interface Role {
    id: string;
    name: string;
    display_name: string;
    description?: string;
    level: number;
    is_system_role: boolean;
    is_tenant_admin: boolean;
    is_active: boolean;
    icon: string;
    color: string;
    parent_role_id?: string;
    created_at: string;
}

export enum RoleLevel {
    SUPER_ADMIN = 0,
    UNIVERSITY_ADMIN = 1,
    ADMIN = 2,
    STAFF = 3,
    USER = 4,
}

export interface Permission {
    id: string;
    code: string;
    resource: string;
    action: string;
    display_name: string;
    description?: string;
    category?: string;
    module_id?: string;
    is_system: boolean;
}

// Module types
export interface Module {
    id: string;
    code: string;
    name: string;
    description?: string;
    category: ModuleCategory;
    is_core: boolean;
    is_premium: boolean;
    is_beta: boolean;
    is_active: boolean;
    icon: string;
    color: string;
    menu_order: number;
    version: string;
    depends_on: string[];
}

export enum ModuleCategory {
    CORE = 'core',
    ACADEMIC = 'academic',
    ADMINISTRATIVE = 'administrative',
    FINANCE = 'finance',
    COMMUNICATION = 'communication',
    HR = 'hr',
    ANALYTICS = 'analytics',
    INTEGRATION = 'integration',
}

export enum AccessLevel {
    NONE = 'none',
    READ = 'read',
    WRITE = 'write',
    ADMIN = 'admin',
    FULL = 'full',
}

// Auth types
export interface LoginRequest {
    email: string;
    password: string;
    remember_me?: boolean;
}

export interface LoginResponse {
    access_token: string;
    // refresh_token: string; // Removed: HttpOnly cookie
    token_type: string;
    expires_in: number;
    user: UserBasic;
}

export interface UserBasic {
    id: string;
    email: string;
    first_name: string;
    last_name?: string;
    avatar_url?: string;
    roles: string[];
    role_level: number;
    restricted_modules: string[];  // Tenant's restricted modules
    allowed_modules: string[];  // Role's allowed modules
}



// API Response types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    error_code?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
}

export interface PaginationParams {
    page?: number;
    page_size?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

// Navigation types
export interface NavItem {
    label: string;
    path: string;
    icon?: string;
    permission?: string;
    module?: string;
    children?: NavItem[];
}

export interface Breadcrumb {
    label: string;
    path?: string;
}
