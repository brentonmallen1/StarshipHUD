import type { Asset, Cargo, Contact, SystemState } from '../types';

// Validation error type
export interface ValidationErrors {
  [fieldName: string]: string;
}

// ============================================================================
// ASSET VALIDATION
// ============================================================================

export function useValidateAsset() {
  return (data: Partial<Asset>): ValidationErrors => {
    const errors: ValidationErrors = {};

    // Name validation
    if (data.name !== undefined && data.name.trim() === '') {
      errors.name = 'Name is required';
    }

    // Ammo validation
    if (data.ammo_current !== undefined && data.ammo_max !== undefined) {
      if (data.ammo_current < 0) {
        errors.ammo_current = 'Ammo cannot be negative';
      }
      if (data.ammo_current > data.ammo_max) {
        errors.ammo_current = 'Current ammo exceeds maximum';
      }
    }

    // Range validation
    if (data.range !== undefined && data.range < 0) {
      errors.range = 'Range cannot be negative';
    }

    // Accuracy validation
    if (data.accuracy !== undefined) {
      if (data.accuracy < 0 || data.accuracy > 100) {
        errors.accuracy = 'Accuracy must be between 0 and 100';
      }
    }

    // Charge time validation
    if (data.charge_time !== undefined && data.charge_time < 0) {
      errors.charge_time = 'Charge time cannot be negative';
    }

    // Cooldown validation
    if (data.cooldown !== undefined && data.cooldown < 0) {
      errors.cooldown = 'Cooldown cannot be negative';
    }

    // Damage validation
    if (data.damage !== undefined && data.damage < 0) {
      errors.damage = 'Damage cannot be negative';
    }

    return errors;
  };
}

// ============================================================================
// CARGO VALIDATION
// ============================================================================

export function useValidateCargo() {
  return (data: Partial<Cargo>): ValidationErrors => {
    const errors: ValidationErrors = {};

    // Name validation
    if (data.name !== undefined && data.name.trim() === '') {
      errors.name = 'Name is required';
    }

    // Quantity validation
    if (data.quantity !== undefined && data.quantity < 0) {
      errors.quantity = 'Quantity cannot be negative';
    }

    // Value validation
    if (data.value !== undefined && data.value < 0) {
      errors.value = 'Value cannot be negative';
    }

    return errors;
  };
}

// ============================================================================
// CONTACT VALIDATION
// ============================================================================

export function useValidateContact() {
  return (data: Partial<Contact>): ValidationErrors => {
    const errors: ValidationErrors = {};

    // Name validation
    if (data.name !== undefined && data.name.trim() === '') {
      errors.name = 'Name is required';
    }

    // Tags validation (ensure tags is an array if provided)
    if (data.tags !== undefined && !Array.isArray(data.tags)) {
      errors.tags = 'Tags must be an array';
    }

    return errors;
  };
}

// ============================================================================
// SYSTEM STATE VALIDATION
// ============================================================================

export function useValidateSystemState() {
  return (data: Partial<SystemState>): ValidationErrors => {
    const errors: ValidationErrors = {};

    // Name validation
    if (data.name !== undefined && data.name.trim() === '') {
      errors.name = 'Name is required';
    }

    // Value validation
    if (data.value !== undefined && data.max_value !== undefined) {
      if (data.value < 0) {
        errors.value = 'Value cannot be negative';
      }
      if (data.value > data.max_value) {
        errors.value = 'Value exceeds maximum';
      }
    }

    // Max value validation
    if (data.max_value !== undefined && data.max_value <= 0) {
      errors.max_value = 'Max value must be greater than zero';
    }

    return errors;
  };
}

// ============================================================================
// GENERIC VALIDATION HELPER
// ============================================================================

export function useValidateData(
  dataType: 'assets' | 'cargo' | 'contacts' | 'systemStates'
) {
  const validateAsset = useValidateAsset();
  const validateCargo = useValidateCargo();
  const validateContact = useValidateContact();
  const validateSystemState = useValidateSystemState();

  return (data: Partial<Asset | Cargo | Contact | SystemState>): ValidationErrors => {
    switch (dataType) {
      case 'assets':
        return validateAsset(data as Partial<Asset>);
      case 'cargo':
        return validateCargo(data as Partial<Cargo>);
      case 'contacts':
        return validateContact(data as Partial<Contact>);
      case 'systemStates':
        return validateSystemState(data as Partial<SystemState>);
      default:
        return {};
    }
  };
}

// ============================================================================
// REQUIRED FIELDS CHECKER
// ============================================================================

export function hasRequiredFields(
  dataType: 'assets' | 'cargo' | 'contacts' | 'systemStates',
  data: Partial<Asset | Cargo | Contact | SystemState>
): boolean {
  // Check for required fields based on data type
  switch (dataType) {
    case 'assets':
      return !!(data as Partial<Asset>).name;
    case 'cargo':
      return !!(data as Partial<Cargo>).name;
    case 'contacts':
      return !!(data as Partial<Contact>).name;
    case 'systemStates':
      return !!(data as Partial<SystemState>).name;
    default:
      return false;
  }
}
