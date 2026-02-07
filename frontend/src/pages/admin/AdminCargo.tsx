import { useState, useMemo } from 'react';
import { useCargo, useCargoBays, useCargoCategories } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import {
  useUpdateCargo,
  useCreateCargo,
  useDeleteCargo,
  useCreateCargoBay,
  useUpdateCargoBay,
  useDeleteCargoBay,
  useCreateCargoCategory,
  useUpdateCargoCategory,
  useDeleteCargoCategory,
} from '../../hooks/useMutations';
import { useQuery } from '@tanstack/react-query';
import { cargoPlacementsApi } from '../../services/api';
import type { Cargo, CargoSizeClass, CargoBay, CargoBaySize, CargoPlacement, CargoCategory } from '../../types';
import { CARGO_SHAPES, CARGO_SIZE_LABELS } from '../../utils/cargoShapes';
import './Admin.css';

const SIZE_CLASS_OPTIONS: CargoSizeClass[] = ['tiny', 'x_small', 'small', 'medium', 'large', 'x_large', 'huge'];
const BAY_SIZE_PRESETS: Record<CargoBaySize, { width: number; height: number; label: string }> = {
  small: { width: 6, height: 4, label: 'Small (6×4)' },
  medium: { width: 8, height: 6, label: 'Medium (8×6)' },
  large: { width: 10, height: 8, label: 'Large (10×8)' },
  custom: { width: 8, height: 6, label: 'Custom' },
};

type GroupByOption = 'bay' | 'category';

function generateRandomColor(): string {
  return `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')}`;
}

export function AdminCargo() {
  const shipId = useCurrentShipId();
  const { data: cargo, isLoading: cargoLoading } = useCargo();
  const { data: bays, isLoading: baysLoading } = useCargoBays();
  const { data: categories, isLoading: categoriesLoading } = useCargoCategories();
  const { data: placements } = useQuery({
    queryKey: ['all-cargo-placements'],
    queryFn: () => cargoPlacementsApi.list(),
    refetchInterval: 5000,
  });

  // UI State
  const [groupBy, setGroupBy] = useState<GroupByOption>('bay');
  const [editingCargoId, setEditingCargoId] = useState<string | null>(null);
  const [editingBayId, setEditingBayId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [showCreateCargoForm, setShowCreateCargoForm] = useState(false);
  const [showCreateBayForm, setShowCreateBayForm] = useState(false);
  const [showCreateCategoryForm, setShowCreateCategoryForm] = useState(false);
  const [showCategoriesSection, setShowCategoriesSection] = useState(false);

  // Edit state for cargo
  const [editCargoData, setEditCargoData] = useState<Partial<Cargo>>({});

  // Edit state for bays
  const [editBayData, setEditBayData] = useState<Partial<CargoBay>>({});

  // Edit state for categories
  const [editCategoryData, setEditCategoryData] = useState<Partial<CargoCategory>>({});

  // Create state for cargo
  const [newCargo, setNewCargo] = useState<Partial<Cargo>>({
    name: '',
    category_id: undefined,
    notes: '',
    size_class: 'small',
    shape_variant: 0,
    color: undefined,
  });

  // Create state for bay
  const [newBay, setNewBay] = useState<Partial<CargoBay> & { bay_size: CargoBaySize }>({
    name: '',
    bay_size: 'medium',
    width: 8,
    height: 6,
  });

  // Create state for category
  const [newCategory, setNewCategory] = useState<Partial<CargoCategory>>({
    name: '',
    color: generateRandomColor(),
  });

  // Mutation hooks
  const updateCargo = useUpdateCargo();
  const createCargo = useCreateCargo();
  const deleteCargo = useDeleteCargo();
  const createBay = useCreateCargoBay();
  const updateBay = useUpdateCargoBay();
  const deleteBay = useDeleteCargoBay();
  const createCategory = useCreateCargoCategory();
  const updateCategory = useUpdateCargoCategory();
  const deleteCategory = useDeleteCargoCategory();

  // Build category map for lookups
  const categoryMap = useMemo(() => {
    const map = new Map<string, CargoCategory>();
    categories?.forEach((cat) => map.set(cat.id, cat));
    return map;
  }, [categories]);

  // Build placement map: cargo_id -> bay_id
  const placementMap = useMemo(() => {
    const map = new Map<string, string>();
    placements?.forEach((p: CargoPlacement) => {
      map.set(p.cargo_id, p.bay_id);
    });
    return map;
  }, [placements]);

  // Group cargo based on selected grouping
  const groupedCargo = useMemo(() => {
    if (!cargo) return {};

    if (groupBy === 'category') {
      // Group by category
      const groups: Record<string, { label: string; items: Cargo[] }> = {};

      // Initialize with all categories
      categories?.forEach((cat) => {
        groups[cat.id] = { label: cat.name, items: [] };
      });
      groups['uncategorized'] = { label: 'Uncategorized', items: [] };

      // Group cargo items
      cargo.forEach((item) => {
        if (item.category_id && groups[item.category_id]) {
          groups[item.category_id].items.push(item);
        } else {
          groups['uncategorized'].items.push(item);
        }
      });

      return groups;
    } else {
      // Group by bay
      const groups: Record<string, { label: string; bay?: CargoBay; items: Cargo[] }> = {};

      // Initialize with all bays
      bays?.forEach((bay) => {
        groups[bay.id] = { label: `${bay.name} (${bay.width}×${bay.height})`, bay, items: [] };
      });
      groups['unplaced'] = { label: 'Unplaced', items: [] };

      // Group cargo items
      cargo.forEach((item) => {
        const bayId = placementMap.get(item.id);
        if (bayId && groups[bayId]) {
          groups[bayId].items.push(item);
        } else {
          groups['unplaced'].items.push(item);
        }
      });

      return groups;
    }
  }, [cargo, bays, categories, placementMap, groupBy]);

  // Cargo handlers
  const startEditingCargo = (item: Cargo) => {
    setEditingCargoId(item.id);
    setEditCargoData({
      category_id: item.category_id,
      notes: item.notes,
      size_class: item.size_class,
      shape_variant: item.shape_variant,
      color: item.color,
    });
  };

  const saveCargoChanges = (cargoId: string) => {
    updateCargo.mutate(
      { id: cargoId, data: editCargoData },
      { onSuccess: () => setEditingCargoId(null) }
    );
  };

  const handleCreateCargo = () => {
    if (!newCargo.name) {
      alert('Please enter a cargo name');
      return;
    }
    createCargo.mutate(
      { ...newCargo, ship_id: shipId ?? '' },
      {
        onSuccess: () => {
          setShowCreateCargoForm(false);
          setNewCargo({
            name: '',
            category_id: undefined,
            notes: '',
            size_class: 'small',
            shape_variant: 0,
            color: undefined,
          });
        },
      }
    );
  };

  const handleDeleteCargo = (id: string, name: string) => {
    if (window.confirm(`Delete ${name}? This cannot be undone.`)) {
      deleteCargo.mutate(id);
    }
  };

  // Bay handlers
  const startEditingBay = (bay: CargoBay) => {
    setEditingBayId(bay.id);
    setEditBayData({
      name: bay.name,
      bay_size: bay.bay_size,
      width: bay.width,
      height: bay.height,
    });
  };

  const saveBayChanges = (bayId: string) => {
    updateBay.mutate(
      { id: bayId, data: editBayData },
      { onSuccess: () => setEditingBayId(null) }
    );
  };

  const handleCreateBay = () => {
    if (!newBay.name) {
      alert('Please enter a bay name');
      return;
    }
    createBay.mutate(
      { ...newBay, ship_id: shipId ?? '' },
      {
        onSuccess: () => {
          setShowCreateBayForm(false);
          setNewBay({
            name: '',
            bay_size: 'medium',
            width: 8,
            height: 6,
          });
        },
      }
    );
  };

  const handleDeleteBay = (id: string, name: string) => {
    // Check if bay has cargo
    const hasCargoInBay = Array.from(placementMap.values()).some((bayId) => bayId === id);
    const message = hasCargoInBay
      ? `Delete ${name}? This bay has cargo placed in it. The cargo will become unplaced.`
      : `Delete ${name}? This cannot be undone.`;

    if (window.confirm(message)) {
      deleteBay.mutate(id);
    }
  };

  const handleBaySizeChange = (size: CargoBaySize, isNew = true) => {
    const preset = BAY_SIZE_PRESETS[size];
    if (isNew) {
      setNewBay({
        ...newBay,
        bay_size: size,
        width: preset.width,
        height: preset.height,
      });
    } else {
      setEditBayData({
        ...editBayData,
        bay_size: size,
        width: preset.width,
        height: preset.height,
      });
    }
  };

  // Category handlers
  const startEditingCategory = (cat: CargoCategory) => {
    setEditingCategoryId(cat.id);
    setEditCategoryData({
      name: cat.name,
      color: cat.color,
    });
  };

  const saveCategoryChanges = (categoryId: string) => {
    updateCategory.mutate(
      { id: categoryId, data: editCategoryData },
      { onSuccess: () => setEditingCategoryId(null) }
    );
  };

  const handleCreateCategory = () => {
    if (!newCategory.name) {
      alert('Please enter a category name');
      return;
    }
    createCategory.mutate(
      { ...newCategory, ship_id: shipId ?? '' },
      {
        onSuccess: () => {
          setShowCreateCategoryForm(false);
          setNewCategory({
            name: '',
            color: generateRandomColor(),
          });
        },
      }
    );
  };

  const handleDeleteCategory = (id: string, name: string) => {
    const cargoCount = cargo?.filter((c) => c.category_id === id).length ?? 0;
    const message = cargoCount > 0
      ? `Delete "${name}"? ${cargoCount} cargo item${cargoCount > 1 ? 's' : ''} will become uncategorized.`
      : `Delete "${name}"? This cannot be undone.`;

    if (window.confirm(message)) {
      deleteCategory.mutate(id);
    }
  };

  // Helper to get effective color for cargo item
  const getCargoDisplayColor = (item: Cargo): string | undefined => {
    if (item.color) return item.color;
    if (item.category_id) {
      const cat = categoryMap.get(item.category_id);
      if (cat) return cat.color;
    }
    return undefined;
  };

  if (cargoLoading || baysLoading || categoriesLoading) {
    return <div className="loading">Loading cargo inventory...</div>;
  }

  return (
    <div className="admin-systems">
      {/* Header with actions */}
      <div className="admin-header">
        <h2 className="admin-page-title">Cargo Inventory</h2>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Group by:</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
            style={{ padding: '4px 8px', fontSize: '12px' }}
          >
            <option value="bay">Cargo Bay</option>
            <option value="category">Category</option>
          </select>
          <button
            className="btn"
            onClick={() => {
              setShowCreateBayForm(!showCreateBayForm);
              setShowCreateCargoForm(false);
              setShowCreateCategoryForm(false);
            }}
          >
            {showCreateBayForm ? 'Cancel' : '+ New Bay'}
          </button>
          <button
            className="btn"
            onClick={() => {
              setShowCategoriesSection(!showCategoriesSection);
            }}
          >
            {showCategoriesSection ? 'Hide Categories' : 'Categories'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowCreateCargoForm(!showCreateCargoForm);
              setShowCreateBayForm(false);
              setShowCreateCategoryForm(false);
            }}
          >
            {showCreateCargoForm ? 'Cancel' : '+ New Cargo'}
          </button>
        </div>
      </div>

      {/* Categories Section */}
      {showCategoriesSection && (
        <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--color-surface)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              Cargo Categories ({categories?.length ?? 0})
            </h3>
            <button
              className="btn btn-small"
              onClick={() => setShowCreateCategoryForm(!showCreateCategoryForm)}
            >
              {showCreateCategoryForm ? 'Cancel' : '+ New Category'}
            </button>
          </div>

          {/* Create Category Form */}
          {showCreateCategoryForm && (
            <div className="create-form" style={{ marginBottom: '16px' }}>
              <div className="form-grid">
                <div className="form-field">
                  <label>Name</label>
                  <input
                    type="text"
                    value={newCategory.name || ''}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    placeholder="e.g., Life Support"
                  />
                </div>
                <div className="form-field">
                  <label>Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={newCategory.color || '#888888'}
                      onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                      style={{ width: '40px', height: '32px', padding: 0, border: 'none' }}
                    />
                    <input
                      type="text"
                      value={newCategory.color || ''}
                      onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                      placeholder="#ff5500"
                      style={{ width: '80px' }}
                    />
                    <button
                      className="btn btn-small"
                      onClick={() => setNewCategory({ ...newCategory, color: generateRandomColor() })}
                      title="Random color"
                    >
                      🎲
                    </button>
                  </div>
                </div>
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleCreateCategory}>
                  Add Category
                </button>
                <button className="btn" onClick={() => setShowCreateCategoryForm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Categories Table */}
          {categories && categories.length > 0 ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Color</th>
                  <th>Name</th>
                  <th>Items</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => {
                  const itemCount = cargo?.filter((c) => c.category_id === cat.id).length ?? 0;
                  return (
                    <tr key={cat.id}>
                      <td style={{ width: '60px' }}>
                        {editingCategoryId === cat.id ? (
                          <input
                            type="color"
                            value={editCategoryData.color ?? cat.color}
                            onChange={(e) => setEditCategoryData({ ...editCategoryData, color: e.target.value })}
                            style={{ width: '32px', height: '24px', padding: 0, border: 'none' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '4px',
                              background: cat.color,
                              border: '1px solid var(--color-border)',
                            }}
                          />
                        )}
                      </td>
                      <td>
                        {editingCategoryId === cat.id ? (
                          <input
                            type="text"
                            value={editCategoryData.name ?? cat.name}
                            onChange={(e) => setEditCategoryData({ ...editCategoryData, name: e.target.value })}
                            style={{ width: '150px' }}
                          />
                        ) : (
                          <strong>{cat.name}</strong>
                        )}
                      </td>
                      <td>{itemCount}</td>
                      <td>
                        {editingCategoryId === cat.id ? (
                          <>
                            <button
                              className="btn btn-small btn-primary"
                              onClick={() => saveCategoryChanges(cat.id)}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-small"
                              onClick={() => setEditingCategoryId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn btn-small"
                              onClick={() => startEditingCategory(cat)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-small btn-danger"
                              onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '16px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No categories defined. Create one to organize your cargo.
            </div>
          )}
        </div>
      )}

      {/* Create Bay Form */}
      {showCreateBayForm && (
        <div className="create-form">
          <h3>Add Cargo Bay</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Name</label>
              <input
                type="text"
                value={newBay.name || ''}
                onChange={(e) => setNewBay({ ...newBay, name: e.target.value })}
                placeholder="e.g., Main Cargo Hold"
              />
            </div>

            <div className="form-field">
              <label>Size Preset</label>
              <select
                value={newBay.bay_size}
                onChange={(e) => handleBaySizeChange(e.target.value as CargoBaySize, true)}
              >
                {Object.entries(BAY_SIZE_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>{preset.label}</option>
                ))}
              </select>
            </div>

            {newBay.bay_size === 'custom' && (
              <>
                <div className="form-field">
                  <label>Width (cells)</label>
                  <input
                    type="number"
                    min={4}
                    max={20}
                    value={newBay.width || 8}
                    onChange={(e) => setNewBay({ ...newBay, width: Number(e.target.value) })}
                  />
                </div>
                <div className="form-field">
                  <label>Height (cells)</label>
                  <input
                    type="number"
                    min={4}
                    max={20}
                    value={newBay.height || 6}
                    onChange={(e) => setNewBay({ ...newBay, height: Number(e.target.value) })}
                  />
                </div>
              </>
            )}
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleCreateBay}>
              Add Bay
            </button>
            <button className="btn" onClick={() => setShowCreateBayForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Create Cargo Form */}
      {showCreateCargoForm && (
        <div className="create-form">
          <h3>Add Cargo Item</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Name</label>
              <input
                type="text"
                value={newCargo.name || ''}
                onChange={(e) => setNewCargo({ ...newCargo, name: e.target.value })}
                placeholder="e.g., Emergency Rations"
              />
            </div>

            <div className="form-field">
              <label>Category</label>
              <select
                value={newCargo.category_id || ''}
                onChange={(e) => setNewCargo({ ...newCargo, category_id: e.target.value || undefined })}
              >
                <option value="">— None —</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Size Class</label>
              <select
                value={newCargo.size_class || 'small'}
                onChange={(e) => setNewCargo({
                  ...newCargo,
                  size_class: e.target.value as CargoSizeClass,
                  shape_variant: 0,
                })}
              >
                {SIZE_CLASS_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {CARGO_SIZE_LABELS[size]} ({CARGO_SHAPES[size].length} shape{CARGO_SHAPES[size].length > 1 ? 's' : ''})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Shape</label>
              <select
                value={newCargo.shape_variant ?? 0}
                onChange={(e) => setNewCargo({ ...newCargo, shape_variant: Number(e.target.value) })}
              >
                {CARGO_SHAPES[newCargo.size_class || 'small'].map((shape, idx) => (
                  <option key={idx} value={idx}>{shape.name}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Custom Color (optional)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={newCargo.color || '#888888'}
                  onChange={(e) => setNewCargo({ ...newCargo, color: e.target.value })}
                  style={{ width: '40px', height: '32px', padding: 0, border: 'none' }}
                />
                <input
                  type="text"
                  value={newCargo.color || ''}
                  onChange={(e) => setNewCargo({ ...newCargo, color: e.target.value || undefined })}
                  placeholder="Use category color"
                  style={{ width: '120px' }}
                />
                {newCargo.color && (
                  <button
                    className="btn btn-small"
                    onClick={() => setNewCargo({ ...newCargo, color: undefined })}
                    title="Clear custom color"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <textarea
                value={newCargo.notes || ''}
                onChange={(e) => setNewCargo({ ...newCargo, notes: e.target.value })}
                placeholder="Optional notes (quantity, value, description, etc.)"
                rows={2}
              />
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleCreateCargo}>
              Add Cargo
            </button>
            <button className="btn" onClick={() => setShowCreateCargoForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bay Management Section (when grouped by bay) */}
      {groupBy === 'bay' && bays && bays.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '12px', color: 'var(--color-text-secondary)' }}>
            Cargo Bays ({bays.length})
          </h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Dimensions</th>
                <th>Items</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bays.map((bay) => {
                const itemCount = cargo?.filter((c) => placementMap.get(c.id) === bay.id).length ?? 0;
                return (
                  <tr key={bay.id}>
                    <td>
                      {editingBayId === bay.id ? (
                        <input
                          type="text"
                          value={editBayData.name ?? bay.name}
                          onChange={(e) => setEditBayData({ ...editBayData, name: e.target.value })}
                          style={{ width: '150px' }}
                        />
                      ) : (
                        <strong>{bay.name}</strong>
                      )}
                    </td>
                    <td>
                      {editingBayId === bay.id ? (
                        <select
                          value={editBayData.bay_size ?? bay.bay_size}
                          onChange={(e) => handleBaySizeChange(e.target.value as CargoBaySize, false)}
                          style={{ width: '100px' }}
                        >
                          {Object.entries(BAY_SIZE_PRESETS).map(([key, preset]) => (
                            <option key={key} value={key}>{preset.label}</option>
                          ))}
                        </select>
                      ) : (
                        BAY_SIZE_PRESETS[bay.bay_size]?.label || bay.bay_size
                      )}
                    </td>
                    <td>
                      {editingBayId === bay.id && editBayData.bay_size === 'custom' ? (
                        <span>
                          <input
                            type="number"
                            min={4}
                            max={20}
                            value={editBayData.width ?? bay.width}
                            onChange={(e) => setEditBayData({ ...editBayData, width: Number(e.target.value) })}
                            style={{ width: '50px' }}
                          />
                          ×
                          <input
                            type="number"
                            min={4}
                            max={20}
                            value={editBayData.height ?? bay.height}
                            onChange={(e) => setEditBayData({ ...editBayData, height: Number(e.target.value) })}
                            style={{ width: '50px' }}
                          />
                        </span>
                      ) : (
                        `${bay.width}×${bay.height}`
                      )}
                    </td>
                    <td>{itemCount}</td>
                    <td>
                      {editingBayId === bay.id ? (
                        <>
                          <button
                            className="btn btn-small btn-primary"
                            onClick={() => saveBayChanges(bay.id)}
                          >
                            Save
                          </button>
                          <button
                            className="btn btn-small"
                            onClick={() => setEditingBayId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-small"
                            onClick={() => startEditingBay(bay)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-small btn-danger"
                            onClick={() => handleDeleteBay(bay.id, bay.name)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Cargo Tables */}
      {Object.entries(groupedCargo).map(([key, group]) => (
        <div key={key} style={{ marginBottom: '32px' }}>
          <h3 style={{ marginBottom: '12px', color: 'var(--color-text-secondary)' }}>
            {group.label} ({group.items.length})
          </h3>
          {group.items.length > 0 ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>Color</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Size</th>
                  <th>Shape</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => {
                  const displayColor = getCargoDisplayColor(item);
                  const categoryName = item.category_id ? categoryMap.get(item.category_id)?.name : undefined;
                  return (
                    <tr key={item.id}>
                      <td>
                        {editingCargoId === item.id ? (
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <input
                              type="color"
                              value={editCargoData.color || displayColor || '#888888'}
                              onChange={(e) => setEditCargoData({ ...editCargoData, color: e.target.value })}
                              style={{ width: '28px', height: '24px', padding: 0, border: 'none' }}
                            />
                            {editCargoData.color && (
                              <button
                                className="btn btn-small"
                                onClick={() => setEditCargoData({ ...editCargoData, color: undefined })}
                                title="Use category color"
                                style={{ padding: '2px 4px', fontSize: '10px' }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ) : displayColor ? (
                          <div
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '3px',
                              background: displayColor,
                              border: '1px solid var(--color-border)',
                            }}
                            title={item.color ? 'Custom color' : 'Category color'}
                          />
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>
                      <td><strong>{item.name}</strong></td>
                      <td>
                        {editingCargoId === item.id ? (
                          <select
                            value={editCargoData.category_id ?? item.category_id ?? ''}
                            onChange={(e) => setEditCargoData({ ...editCargoData, category_id: e.target.value || undefined })}
                            style={{ width: '120px' }}
                          >
                            <option value="">— None —</option>
                            {categories?.map((cat) => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                        ) : (
                          categoryName || <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {editingCargoId === item.id ? (
                          <select
                            value={editCargoData.size_class ?? item.size_class}
                            onChange={(e) => setEditCargoData({
                              ...editCargoData,
                              size_class: e.target.value as CargoSizeClass,
                              shape_variant: 0,
                            })}
                            style={{ width: '90px' }}
                          >
                            {SIZE_CLASS_OPTIONS.map((size) => (
                              <option key={size} value={size}>{CARGO_SIZE_LABELS[size]}</option>
                            ))}
                          </select>
                        ) : (
                          CARGO_SIZE_LABELS[item.size_class] || item.size_class
                        )}
                      </td>
                      <td>
                        {editingCargoId === item.id ? (
                          <select
                            value={editCargoData.shape_variant ?? item.shape_variant}
                            onChange={(e) => setEditCargoData({ ...editCargoData, shape_variant: Number(e.target.value) })}
                            style={{ width: '80px' }}
                          >
                            {CARGO_SHAPES[editCargoData.size_class ?? item.size_class].map((shape, idx) => (
                              <option key={idx} value={idx}>{shape.name}</option>
                            ))}
                          </select>
                        ) : (
                          CARGO_SHAPES[item.size_class]?.[item.shape_variant]?.name || `Variant ${item.shape_variant}`
                        )}
                      </td>
                      <td style={{ maxWidth: '200px' }}>
                        {editingCargoId === item.id ? (
                          <textarea
                            value={editCargoData.notes ?? item.notes ?? ''}
                            onChange={(e) => setEditCargoData({ ...editCargoData, notes: e.target.value })}
                            style={{ width: '100%', minHeight: '40px', resize: 'vertical' }}
                            placeholder="Notes..."
                          />
                        ) : (
                          <span
                            style={{
                              display: 'block',
                              maxWidth: '200px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: item.notes ? 'inherit' : 'var(--color-text-muted)',
                            }}
                            title={item.notes || ''}
                          >
                            {item.notes || '—'}
                          </span>
                        )}
                      </td>
                      <td>
                        {editingCargoId === item.id ? (
                          <>
                            <button
                              className="btn btn-small btn-primary"
                              onClick={() => saveCargoChanges(item.id)}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-small"
                              onClick={() => setEditingCargoId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn btn-small"
                              onClick={() => startEditingCargo(item)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-small btn-danger"
                              onClick={() => handleDeleteCargo(item.id, item.name)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '16px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No cargo items in this {groupBy === 'bay' ? 'bay' : 'category'}
            </div>
          )}
        </div>
      ))}

      {(!cargo || cargo.length === 0) && (!bays || bays.length === 0) && (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-secondary)' }}>
          No cargo bays or items found. Create a bay first, then add cargo items.
        </div>
      )}
    </div>
  );
}
