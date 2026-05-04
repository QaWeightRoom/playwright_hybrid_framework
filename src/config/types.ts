export const APP_ENVS = ['local', 'dev', 'staging', 'prod'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export const USER_ROLES = ['admin', 'standard'] as const;
export type UserRole = (typeof USER_ROLES)[number];
