import { useRole, type Role } from '../contexts/RoleContext';
import {
  PLAYER_PERMISSIONS,
  GM_PERMISSIONS,
  getFieldPermission as getFieldPermissionHelper,
  isFieldEditable as isFieldEditableHelper,
  type RolePermissions,
  type DataTypePermissions,
  type FieldPermission,
} from '../permissions/dataPermissions';

// Get all permissions for the current role
export function usePermissions(): RolePermissions {
  const { role } = useRole();
  return role === 'gm' ? GM_PERMISSIONS : PLAYER_PERMISSIONS;
}

// Get permissions for a specific data type
export function useDataPermissions(
  dataType: 'assets' | 'systemStates' | 'cargo' | 'contacts'
): DataTypePermissions {
  const permissions = usePermissions();
  return permissions[dataType];
}

// Get permission level for a specific field
export function useFieldPermission(
  dataType: 'assets' | 'systemStates' | 'cargo' | 'contacts',
  fieldName: string
): FieldPermission {
  const dataPermissions = useDataPermissions(dataType);
  return getFieldPermissionHelper(dataPermissions, fieldName);
}

// Check if a field is editable
export function useIsFieldEditable(
  dataType: 'assets' | 'systemStates' | 'cargo' | 'contacts',
  fieldName: string
): boolean {
  const dataPermissions = useDataPermissions(dataType);
  return isFieldEditableHelper(dataPermissions, fieldName);
}

// Check if current user can create records for a data type
export function useCanCreate(
  dataType: 'assets' | 'systemStates' | 'cargo' | 'contacts'
): boolean {
  const dataPermissions = useDataPermissions(dataType);
  return dataPermissions.create;
}

// Check if current user can delete records for a data type
export function useCanDelete(
  dataType: 'assets' | 'systemStates' | 'cargo' | 'contacts'
): boolean {
  const dataPermissions = useDataPermissions(dataType);
  return dataPermissions.delete;
}

// Helper to get permissions without hook (for use in non-component contexts)
export function getPermissionsForRole(role: Role): RolePermissions {
  return role === 'gm' ? GM_PERMISSIONS : PLAYER_PERMISSIONS;
}
