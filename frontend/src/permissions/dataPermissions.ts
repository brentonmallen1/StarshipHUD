// Permission level per field
export type FieldPermission = 'read' | 'edit' | 'none';

// Permission configuration per data type
export interface DataTypePermissions {
  create: boolean; // Can create new records
  delete: boolean; // Can delete records
  fields: Record<string, FieldPermission>;
}

// Role-based permissions
export interface RolePermissions {
  assets: DataTypePermissions;
  systemStates: DataTypePermissions;
  cargo: DataTypePermissions;
  contacts: DataTypePermissions;
}

// Player permissions - restricted to specific fields
export const PLAYER_PERMISSIONS: RolePermissions = {
  assets: {
    create: false,
    delete: false,
    fields: {
      ammo_current: 'edit',
      status: 'edit',
      is_armed: 'edit',
      is_ready: 'edit',
      // All other fields default to 'read'
      name: 'read',
      asset_type: 'read',
      ammo_max: 'read',
      ammo_type: 'read',
      range: 'read',
      range_unit: 'read',
      damage: 'read',
      accuracy: 'read',
      charge_time: 'read',
      cooldown: 'read',
      fire_mode: 'read',
      current_target: 'read',
      mount_location: 'read',
    },
  },
  systemStates: {
    create: false,
    delete: false,
    fields: {
      status: 'edit',
      value: 'edit',
      // All other fields default to 'read'
      name: 'read',
      category: 'read',
      max_value: 'read',
      unit: 'read',
    },
  },
  cargo: {
    create: true,
    delete: false,
    fields: {
      name: 'edit',
      notes: 'edit',
      category_id: 'read',
      size_class: 'read',
      shape_variant: 'read',
    },
  },
  contacts: {
    create: true,
    delete: false,
    fields: {
      // All fields editable for contacts
      name: 'edit',
      affiliation: 'edit',
      threat_level: 'edit',
      role: 'edit',
      notes: 'edit',
      tags: 'edit',
      last_contacted_at: 'edit',
      image_url: 'edit',
    },
  },
};

// GM permissions - full access to everything
export const GM_PERMISSIONS: RolePermissions = {
  assets: {
    create: true,
    delete: true,
    fields: {
      // All fields editable
      name: 'edit',
      asset_type: 'edit',
      status: 'edit',
      ammo_current: 'edit',
      ammo_max: 'edit',
      ammo_type: 'edit',
      range: 'edit',
      range_unit: 'edit',
      damage: 'edit',
      accuracy: 'edit',
      charge_time: 'edit',
      cooldown: 'edit',
      fire_mode: 'edit',
      is_armed: 'edit',
      is_ready: 'edit',
      current_target: 'edit',
      mount_location: 'edit',
    },
  },
  systemStates: {
    create: true,
    delete: true,
    fields: {
      name: 'edit',
      category: 'edit',
      status: 'edit',
      value: 'edit',
      max_value: 'edit',
      unit: 'edit',
    },
  },
  cargo: {
    create: true,
    delete: true,
    fields: {
      name: 'edit',
      notes: 'edit',
      category_id: 'edit',
      size_class: 'edit',
      shape_variant: 'edit',
      color: 'edit',
    },
  },
  contacts: {
    create: true,
    delete: true,
    fields: {
      name: 'edit',
      affiliation: 'edit',
      threat_level: 'edit',
      role: 'edit',
      notes: 'edit',
      tags: 'edit',
      last_contacted_at: 'edit',
      image_url: 'edit',
    },
  },
};

// Helper to get default field permission if not explicitly set
export function getFieldPermission(
  permissions: DataTypePermissions,
  fieldName: string
): FieldPermission {
  return permissions.fields[fieldName] || 'read';
}

// Helper to check if a field is editable
export function isFieldEditable(
  permissions: DataTypePermissions,
  fieldName: string
): boolean {
  return getFieldPermission(permissions, fieldName) === 'edit';
}
