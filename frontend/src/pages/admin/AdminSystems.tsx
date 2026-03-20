import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSystemStates, useSystemCategories } from '../../hooks/useShipData';
import {
  useUpdateSystemState,
  useCreateSystemState,
  useDeleteSystemState,
  useCreateSystemCategory,
  useUpdateSystemCategory,
  useDeleteSystemCategory,
} from '../../hooks/useMutations';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { computeLayout } from '../../utils/graphLayout';
import { D20Loader } from '../../components/ui/D20Loader';
import { ThresholdEditor } from '../../components/admin/ThresholdEditor';
import type { SystemStatus, SystemState, StatusThresholds, SystemCategory } from '../../types';
import '../../components/admin/ShipEditModal.css';
import './Admin.css';

function generateRandomColor(): string {
  const colors = ['#00ffcc', '#3fb950', '#8957e5', '#d4a72c', '#238636', '#f85149', '#6e7681', '#db6d28'];
  return colors[Math.floor(Math.random() * colors.length)];
}

type ViewMode = 'table' | 'tree' | 'graph';

interface TreeNode {
  system: SystemState;
  children: TreeNode[];
  depth: number;
}

interface GraphNode {
  id: string;
  name: string;
  status: SystemStatus;
  effectiveStatus: SystemStatus;
  isCapped: boolean;
  x: number;
  y: number;
  depth: number;
}

interface GraphEdge {
  from: string;
  to: string;
}

export function AdminSystems() {
  const { data: systems, isLoading } = useSystemStates();
  const { data: categories } = useSystemCategories();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editValue, setEditValue] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<SystemStatus>('operational');
  const [editDependsOn, setEditDependsOn] = useState<string[]>([]);
  const [editSystemCategoryId, setEditSystemCategoryId] = useState<string>('');
  const [originalName, setOriginalName] = useState<string>('');
  const [originalValue, setOriginalValue] = useState<number>(0);
  const [originalStatus, setOriginalStatus] = useState<SystemStatus>('operational');
  const [originalDependsOn, setOriginalDependsOn] = useState<string[]>([]);
  const [originalSystemCategoryId, setOriginalSystemCategoryId] = useState<string>('');
  const [showDepsDropdown, setShowDepsDropdown] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Graph view state
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, transformX: 0, transformY: 0 });
  const graphContainerRef = useRef<HTMLDivElement>(null);

  // Threshold editor state
  const [thresholdEditorSystem, setThresholdEditorSystem] = useState<SystemState | null>(null);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSystemName, setNewSystemName] = useState('');
  const [newSystemCategoryId, setNewSystemCategoryId] = useState('');
  const [newSystemMaxValue, setNewSystemMaxValue] = useState(100);
  const [newSystemUnit, setNewSystemUnit] = useState('%');

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Category management state
  const [showCategoriesSection, setShowCategoriesSection] = useState(false);
  const [showCreateCategoryForm, setShowCreateCategoryForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryData, setEditCategoryData] = useState<Partial<SystemCategory>>({});
  const [newCategory, setNewCategory] = useState({ name: '', color: generateRandomColor(), sort_order: 0 });

  // Mutation hooks
  const shipId = useCurrentShipId();
  const updateSystem = useUpdateSystemState();
  const createSystem = useCreateSystemState();
  const deleteSystem = useDeleteSystemState();
  const createCategory = useCreateSystemCategory();
  const updateCategory = useUpdateSystemCategory();
  const deleteCategory = useDeleteSystemCategory();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDepsDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize expanded nodes when switching to tree view - expand all by default
  useEffect(() => {
    if (viewMode === 'tree' && systems) {
      setExpandedNodes(new Set(systems.map(s => s.id)));
    }
  }, [viewMode, systems]);

  const startEditing = (id: string, name: string, value: number, status: SystemStatus, dependsOn: string[], categoryId?: string) => {
    setEditingId(id);
    setEditName(name);
    setEditValue(value);
    setEditStatus(status);
    setEditDependsOn(dependsOn || []);
    setEditSystemCategoryId(categoryId || '');
    setOriginalName(name);
    setOriginalValue(value);
    setOriginalStatus(status);
    setOriginalDependsOn(dependsOn || []);
    setOriginalSystemCategoryId(categoryId || '');
    setShowDepsDropdown(false);
    if (viewMode === 'graph') {
      setSelectedNode(id);
    }
  };

  const saveChanges = (systemId: string) => {
    const data: { name?: string; value?: number; status?: SystemStatus; depends_on?: string[]; category_id?: string; category?: string } = {};

    if (editName.trim() !== originalName) {
      data.name = editName.trim();
    }

    if (editValue !== originalValue) {
      data.value = editValue;
    }

    if (editStatus !== originalStatus) {
      data.status = editStatus;
    }

    const depsChanged = JSON.stringify(editDependsOn.sort()) !== JSON.stringify(originalDependsOn.sort());
    if (depsChanged) {
      data.depends_on = editDependsOn;
    }

    if (editSystemCategoryId !== originalSystemCategoryId) {
      data.category_id = editSystemCategoryId || undefined;
      // Also update category name for backward compatibility
      const selectedCat = categories?.find(c => c.id === editSystemCategoryId);
      data.category = selectedCat?.name;
    }

    if (Object.keys(data).length > 0) {
      updateSystem.mutate(
        { id: systemId, data },
        { onSuccess: () => setEditingId(null) }
      );
    } else {
      setEditingId(null);
    }
  };

  const toggleDependency = (depId: string) => {
    setEditDependsOn(prev =>
      prev.includes(depId)
        ? prev.filter(id => id !== depId)
        : [...prev, depId]
    );
  };

  const getSystemName = (id: string) => {
    return systems?.find(s => s.id === id)?.name || id;
  };

  const handleSaveThresholds = (thresholds: StatusThresholds | null, maxValue?: number, unit?: string) => {
    if (thresholdEditorSystem) {
      const data: { status_thresholds: StatusThresholds | null; max_value?: number; unit?: string } = {
        status_thresholds: thresholds,
      };
      if (maxValue !== undefined) {
        data.max_value = maxValue;
      }
      if (unit !== undefined) {
        data.unit = unit;
      }
      updateSystem.mutate(
        { id: thresholdEditorSystem.id, data },
        { onSuccess: () => setThresholdEditorSystem(null) }
      );
    }
  };

  const handleCreateSystem = () => {
    if (!shipId || !newSystemName.trim()) return;

    // Get the category name for backward compatibility
    const selectedCategory = categories?.find(c => c.id === newSystemCategoryId);

    createSystem.mutate(
      {
        id: crypto.randomUUID(),
        ship_id: shipId,
        name: newSystemName.trim(),
        category: selectedCategory?.name, // Keep category name for backward compat
        category_id: newSystemCategoryId || undefined,
        max_value: newSystemMaxValue,
        unit: newSystemUnit,
        value: newSystemMaxValue, // Start at max
        status: 'operational',
      },
      {
        onSuccess: () => {
          setShowCreateModal(false);
          setNewSystemName('');
          setNewSystemCategoryId('');
          setNewSystemMaxValue(100);
          setNewSystemUnit('%');
        },
      }
    );
  };

  const handleDeleteSystem = (id: string) => {
    deleteSystem.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Category handlers
  const startEditingCategory = (cat: SystemCategory) => {
    setEditingCategoryId(cat.id);
    setEditCategoryData({ name: cat.name, color: cat.color, sort_order: cat.sort_order });
  };

  const saveCategoryChanges = (categoryId: string) => {
    updateCategory.mutate(
      { id: categoryId, data: editCategoryData },
      { onSuccess: () => setEditingCategoryId(null) }
    );
  };

  const handleCreateCategory = () => {
    if (!newCategory.name || !shipId) return;
    createCategory.mutate(
      { ...newCategory, ship_id: shipId },
      {
        onSuccess: () => {
          setShowCreateCategoryForm(false);
          setNewCategory({ name: '', color: generateRandomColor(), sort_order: categories?.length ?? 0 });
        },
      }
    );
  };

  const handleDeleteCategory = (id: string, name: string) => {
    const systemCount = systems?.filter(s => s.category_id === id).length ?? 0;
    const message = systemCount > 0
      ? `Delete "${name}"? ${systemCount} system${systemCount > 1 ? 's' : ''} will become uncategorized.`
      : `Delete "${name}"? This cannot be undone.`;
    if (window.confirm(message)) {
      deleteCategory.mutate(id);
    }
  };

  const getSystemCountForCategory = (categoryId: string) => {
    return systems?.filter(s => s.category_id === categoryId).length ?? 0;
  };

  // Build tree structure
  const treeData = useMemo(() => {
    if (!systems) return [];

    const childrenMap = new Map<string, SystemState[]>();

    // Build children map (reverse of depends_on)
    systems.forEach(system => {
      (system.depends_on || []).forEach(parentId => {
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId)!.push(system);
      });
    });

    // Find roots (systems with no dependencies)
    const roots = systems.filter(s => !s.depends_on || s.depends_on.length === 0);

    function buildNode(system: SystemState, depth: number, visited: Set<string>): TreeNode | null {
      if (visited.has(system.id)) return null;
      visited.add(system.id);

      const children = (childrenMap.get(system.id) || [])
        .map(child => buildNode(child, depth + 1, new Set(visited)))
        .filter((n): n is TreeNode => n !== null)
        .sort((a, b) => a.system.name.localeCompare(b.system.name));

      return { system, children, depth };
    }

    return roots
      .map(root => buildNode(root, 0, new Set()))
      .filter((n): n is TreeNode => n !== null)
      .sort((a, b) => a.system.name.localeCompare(b.system.name));
  }, [systems]);

  // Build graph structure with dagre layout
  const graphData = useMemo(() => {
    if (!systems) return { nodes: [], edges: [], width: 200, height: 200 };

    const edges: GraphEdge[] = [];

    // Create edges (parent -> child)
    systems.forEach(system => {
      (system.depends_on || []).forEach(parentId => {
        edges.push({ from: parentId, to: system.id });
      });
    });

    // Compute layout using dagre
    const layoutNodes = systems.map(s => ({ id: s.id, width: 80, height: 50 }));
    const layout = computeLayout(layoutNodes, edges, {
      direction: 'TB',
      rankSep: 60,
      nodeSep: 40,
      marginX: 40,
      marginY: 40,
    });

    // Create nodes with positions from dagre
    const nodes: GraphNode[] = systems.map(system => {
      const isCapped = system.effective_status && system.effective_status !== system.status;
      const pos = layout.nodes.get(system.id) || { x: 100, y: 100, width: 80, height: 50 };

      return {
        id: system.id,
        name: system.name,
        status: system.status,
        effectiveStatus: (system.effective_status || system.status) as SystemStatus,
        isCapped: !!isCapped,
        x: pos.x,
        y: pos.y,
        depth: 0,
      };
    });

    return { nodes, edges, width: layout.width, height: layout.height };
  }, [systems]);

  // Graph zoom to fit
  const handleZoomToFit = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  // Graph pan/zoom handlers
  const handleZoom = useCallback((delta: number) => {
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.5, Math.min(3, prev.scale + delta))
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !e.defaultPrevented) {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        transformX: transform.x,
        transformY: transform.y
      };
    }
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setTransform(prev => ({
        ...prev,
        x: panStartRef.current.transformX + dx,
        y: panStartRef.current.transformY + dy
      }));
    }
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const getStatusColor = (status: SystemStatus): string => {
    const colors: Record<SystemStatus, string> = {
      optimal: '#00ffcc',
      operational: '#3fb950',
      degraded: '#d4a72c',
      compromised: '#db6d28',
      critical: '#f85149',
      destroyed: '#8b0000',
      offline: '#6e7681',
    };
    return colors[status] || '#6e7681';
  };

  if (isLoading) {
    return (
      <div className="admin-loading">
        <D20Loader size={48} speed={3.4} />
        <span>Loading systems...</span>
      </div>
    );
  }

  const renderEditPanel = (system: SystemState | undefined) => {
    if (!system || editingId !== system.id) return null;

    return (
      <div className="graph-edit-panel">
        <div className="edit-panel-header">
          <span className="edit-panel-title">Edit System</span>
          <button className="edit-panel-close" onClick={() => setEditingId(null)}>×</button>
        </div>
        <div className="edit-panel-body">
          <div className="edit-field">
            <label>Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div className="edit-field">
            <label>Value</label>
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(Number(e.target.value))}
              min={0}
              max={system.max_value}
            />
          </div>
          <div className="edit-field">
            <label>Status</label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as SystemStatus)}
            >
              <option value="optimal">Optimal</option>
              <option value="operational">Operational</option>
              <option value="degraded">Degraded</option>
              <option value="compromised">Compromised</option>
              <option value="critical">Critical</option>
              <option value="destroyed">Destroyed</option>
              <option value="offline">Offline</option>
            </select>
          </div>
          <div className="edit-field" ref={dropdownRef}>
            <label>Depends On</label>
            <button
              className="deps-dropdown-btn"
              onClick={() => setShowDepsDropdown(!showDepsDropdown)}
            >
              {editDependsOn.length === 0
                ? 'None'
                : `${editDependsOn.length} selected`}
              <span className="dropdown-arrow">▼</span>
            </button>
            {showDepsDropdown && (
              <div className="deps-dropdown">
                {systems
                  ?.filter(s => s.id !== system.id)
                  .map(s => (
                    <label key={s.id} className="deps-option">
                      <input
                        type="checkbox"
                        checked={editDependsOn.includes(s.id)}
                        onChange={() => toggleDependency(s.id)}
                      />
                      {s.name}
                    </label>
                  ))}
              </div>
            )}
          </div>
          <div className="edit-panel-actions">
            <button
              className="btn btn-small btn-primary"
              onClick={() => saveChanges(system.id)}
            >
              Save
            </button>
            <button
              className="btn btn-small"
              onClick={() => setEditingId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Minimal file-explorer style tree node
  const renderTreeNode = (node: TreeNode): React.JSX.Element => {
    const { system, children, depth } = node;
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(system.id);
    const isCapped = system.effective_status && system.effective_status !== system.status;
    const isEditing = editingId === system.id;
    const effectiveStatus = system.effective_status || system.status;

    return (
      <div key={system.id} className="file-tree-node">
        <div
          className={`file-tree-row ${isEditing ? 'editing' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
          onClick={() => !isEditing && startEditing(system.id, system.name, system.value, system.status, system.depends_on, system.category_id)}
        >
          <span
            className={`file-tree-toggle ${hasChildren ? '' : 'hidden'}`}
            onClick={(e) => {
              e.stopPropagation();
              hasChildren && toggleExpanded(system.id);
            }}
          >
            {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
          </span>
          <span className={`file-tree-status-dot status-${effectiveStatus}`} />
          <span className="file-tree-name">{system.name}</span>
          {isCapped && <span className="file-tree-capped" title={`Own: ${system.status}`}>⚠</span>}
          <span className="file-tree-value">{system.value}{system.unit}</span>
        </div>
        {isEditing && (
          <div className="file-tree-edit" style={{ paddingLeft: `${depth * 16 + 24}px` }}>
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(Number(e.target.value))}
              min={0}
              max={system.max_value}
              onClick={(e) => e.stopPropagation()}
            />
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as SystemStatus)}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="optimal">Fully Op</option>
              <option value="operational">Online</option>
              <option value="degraded">Degraded</option>
              <option value="compromised">Compromised</option>
              <option value="critical">Critical</option>
              <option value="destroyed">Destroyed</option>
              <option value="offline">Offline</option>
            </select>
            <button className="btn btn-small btn-primary" onClick={(e) => { e.stopPropagation(); saveChanges(system.id); }}>Save</button>
            <button className="btn btn-small" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>Cancel</button>
          </div>
        )}
        {hasChildren && isExpanded && (
          <div className="file-tree-children">
            {children.map(child => renderTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="admin-systems">
      <div className="admin-header-row">
        <h2 className="admin-page-title">System States</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn"
            onClick={() => setShowCategoriesSection(!showCategoriesSection)}
          >
            {showCategoriesSection ? 'Hide Categories' : 'Categories'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            + Add System
          </button>
        </div>
        <div className="view-toggle" style={{ marginLeft: '24px' }}>
          <button
            className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
          >
            Table
          </button>
          <button
            className={`view-btn ${viewMode === 'tree' ? 'active' : ''}`}
            onClick={() => setViewMode('tree')}
          >
            Tree
          </button>
          <button
            className={`view-btn ${viewMode === 'graph' ? 'active' : ''}`}
            onClick={() => setViewMode('graph')}
          >
            Graph
          </button>
        </div>
      </div>

      {/* Categories Section */}
      {showCategoriesSection && (
        <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--color-surface)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
              System Categories ({categories?.length ?? 0})
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
            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Name</label>
                  <input
                    type="text"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    placeholder="e.g., Power Systems"
                    style={{ width: '180px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Color</label>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={newCategory.color}
                      onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                      style={{ width: '32px', height: '28px', padding: 0, border: 'none', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={newCategory.color}
                      onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                      style={{ width: '75px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
                <button className="btn btn-small btn-primary" onClick={handleCreateCategory} disabled={!newCategory.name}>
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Categories Table */}
          {categories && categories.length > 0 ? (
            <table className="admin-table" style={{ fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '50px', padding: '6px 8px' }}>Color</th>
                  <th style={{ padding: '6px 8px' }}>Name</th>
                  <th style={{ width: '70px', padding: '6px 8px' }}>Systems</th>
                  <th style={{ width: '120px', padding: '6px 8px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id}>
                    <td style={{ padding: '4px 8px' }}>
                      {editingCategoryId === cat.id ? (
                        <input
                          type="color"
                          value={editCategoryData.color ?? cat.color}
                          onChange={(e) => setEditCategoryData({ ...editCategoryData, color: e.target.value })}
                          style={{ width: '28px', height: '22px', padding: 0, border: 'none', cursor: 'pointer' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '3px',
                            background: cat.color,
                            border: '1px solid var(--color-border)',
                          }}
                        />
                      )}
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      {editingCategoryId === cat.id ? (
                        <input
                          type="text"
                          value={editCategoryData.name ?? cat.name}
                          onChange={(e) => setEditCategoryData({ ...editCategoryData, name: e.target.value })}
                          style={{ width: '150px', fontSize: '0.9rem' }}
                        />
                      ) : (
                        <span>{cat.name}</span>
                      )}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>{getSystemCountForCategory(cat.id)}</td>
                    <td style={{ padding: '4px 8px' }}>
                      {editingCategoryId === cat.id ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-small btn-primary" onClick={() => saveCategoryChanges(cat.id)}>Save</button>
                          <button className="btn btn-small" onClick={() => setEditingCategoryId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-small" onClick={() => startEditingCategory(cat)}>Edit</button>
                          <button className="btn btn-small btn-danger" onClick={() => handleDeleteCategory(cat.id, cat.name)}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
              No categories defined. Create one to organize your systems.
            </div>
          )}
        </div>
      )}

      {viewMode === 'table' && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>System</th>
              <th>Category</th>
              <th>Value</th>
              <th>Status</th>
              <th>Depends On</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {systems?.map((system) => {
              const isCapped = system.effective_status && system.effective_status !== system.status;

              return (
                <tr key={system.id}>
                  <td>
                    {editingId === system.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ minWidth: '120px' }}
                      />
                    ) : (
                      system.name
                    )}
                  </td>
                  <td>
                    {editingId === system.id ? (
                      <select
                        value={editSystemCategoryId}
                        onChange={(e) => setEditSystemCategoryId(e.target.value)}
                        style={{ minWidth: '100px' }}
                      >
                        <option value="">None</option>
                        {categories?.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="badge">{system.category || '—'}</span>
                    )}
                  </td>
                  <td>
                    {editingId === system.id ? (
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(Number(e.target.value))}
                        min={0}
                        max={system.max_value}
                        style={{ width: '80px' }}
                      />
                    ) : (
                      <span className={`status-${system.effective_status || system.status}`}>
                        {system.value}{system.unit}
                      </span>
                    )}
                  </td>
                  <td>
                    {editingId === system.id ? (
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as SystemStatus)}
                      >
                        <option value="optimal">Optimal</option>
                        <option value="operational">Operational</option>
                        <option value="degraded">Degraded</option>
                        <option value="compromised">Compromised</option>
                        <option value="critical">Critical</option>
                        <option value="destroyed">Destroyed</option>
                        <option value="offline">Offline</option>
                      </select>
                    ) : (
                      <div className="status-cell">
                        <span className={`status-badge status-${system.effective_status || system.status}`}>
                          {(system.effective_status || system.status).replace('_', ' ')}
                        </span>
                        {isCapped && (
                          <span className="capped-indicator" title={`Own status: ${system.status.replace('_', ' ')} (capped by dependency)`}>
                            ⚠
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {editingId === system.id ? (
                      <div className="deps-editor" ref={dropdownRef}>
                        <button
                          className="deps-dropdown-btn"
                          onClick={() => setShowDepsDropdown(!showDepsDropdown)}
                        >
                          {editDependsOn.length === 0
                            ? 'None'
                            : `${editDependsOn.length} selected`}
                          <span className="dropdown-arrow">▼</span>
                        </button>
                        {showDepsDropdown && (
                          <div className="deps-dropdown">
                            {systems
                              ?.filter(s => s.id !== system.id)
                              .map(s => (
                                <label key={s.id} className="deps-option">
                                  <input
                                    type="checkbox"
                                    checked={editDependsOn.includes(s.id)}
                                    onChange={() => toggleDependency(s.id)}
                                  />
                                  {s.name}
                                </label>
                              ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="deps-list">
                        {system.depends_on?.length > 0
                          ? system.depends_on.map(getSystemName).join(', ')
                          : '—'}
                      </span>
                    )}
                  </td>
                  <td>
                    {editingId === system.id ? (
                      <>
                        <button
                          className="btn btn-small btn-primary"
                          onClick={() => saveChanges(system.id)}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-small"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <div className="table-actions">
                        <button
                          className="btn btn-small"
                          onClick={() =>
                            startEditing(system.id, system.name, system.value, system.status, system.depends_on, system.category_id)
                          }
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-small"
                          onClick={() => setThresholdEditorSystem(system)}
                          title={system.status_thresholds ? 'Edit thresholds (discrete mode)' : 'Configure thresholds'}
                          style={{ fontSize: "1.25rem" }}
                        >
                          ⚙
                        </button>
                        {deleteConfirmId === system.id ? (
                          <>
                            <button
                              className="btn btn-small btn-danger"
                              onClick={() => handleDeleteSystem(system.id)}
                            >
                              Confirm
                            </button>
                            <button
                              className="btn btn-small"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-small btn-danger"
                            onClick={() => setDeleteConfirmId(system.id)}
                            title="Delete system"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {viewMode === 'tree' && (
        <div className="file-tree-view">
          {treeData.map(node => renderTreeNode(node))}
        </div>
      )}

      {viewMode === 'graph' && (
        <div className="graph-view-container">
          <div
            ref={graphContainerRef}
            className={`graph-canvas-admin ${isPanning ? 'panning' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <svg
              viewBox={`0 0 ${graphData.width} ${graphData.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <g
                style={{
                  transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                  transformOrigin: `${graphData.width / 2}px ${graphData.height / 2}px`
                }}
              >
                {/* Edges - curved bezier paths */}
                {graphData.edges.map((edge, idx) => {
                  const fromNode = graphData.nodes.find(n => n.id === edge.from);
                  const toNode = graphData.nodes.find(n => n.id === edge.to);
                  if (!fromNode || !toNode) return null;

                  const midY = (fromNode.y + toNode.y) / 2;
                  const path = `M ${fromNode.x} ${fromNode.y} C ${fromNode.x} ${midY}, ${toNode.x} ${midY}, ${toNode.x} ${toNode.y}`;

                  return (
                    <path
                      key={`edge-${idx}`}
                      d={path}
                      fill="none"
                      stroke={toNode.isCapped ? 'var(--color-degraded)' : 'var(--color-border)'}
                      strokeWidth={1.5}
                      strokeOpacity={toNode.isCapped ? 0.6 : 0.4}
                    />
                  );
                })}

                {/* Nodes */}
                {graphData.nodes.map(node => {
                  const isSelected = selectedNode === node.id;
                  const color = getStatusColor(node.effectiveStatus);

                  return (
                    <g
                      key={node.id}
                      className="graph-node-admin"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedNode(node.id);
                        const system = systems?.find(s => s.id === node.id);
                        if (system) {
                          startEditing(system.id, system.name, system.value, system.status, system.depends_on, system.category_id);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Glow */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={14}
                        fill={color}
                        opacity={isSelected ? 0.5 : 0.25}
                      />
                      {/* Capped indicator */}
                      {node.isCapped && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={16}
                          fill="none"
                          stroke="#d4a72c"
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                          opacity="0.7"
                        />
                      )}
                      {/* Node circle */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={10}
                        fill={color}
                        stroke={isSelected ? '#fff' : color}
                        strokeWidth={isSelected ? 2 : 1}
                      />
                      {/* Label */}
                      <text
                        x={node.x}
                        y={node.y + 24}
                        textAnchor="middle"
                        fill="#a0a0a0"
                        fontSize={10}
                        fontFamily="var(--font-mono)"
                      >
                        {node.name}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Zoom controls */}
            <div className="graph-zoom-controls">
              <button onClick={() => handleZoom(0.2)} title="Zoom in">+</button>
              <button onClick={handleZoomToFit} title="Fit to view">⊡</button>
              <button onClick={() => handleZoom(-0.2)} title="Zoom out">−</button>
            </div>
          </div>

          {/* Edit panel for graph view */}
          {selectedNode && renderEditPanel(systems?.find(s => s.id === selectedNode))}
        </div>
      )}

      {/* Threshold Editor Modal */}
      {thresholdEditorSystem && (
        <ThresholdEditor
          isOpen={!!thresholdEditorSystem}
          system={thresholdEditorSystem}
          onSave={handleSaveThresholds}
          onCancel={() => setThresholdEditorSystem(null)}
          isLoading={updateSystem.isPending}
        />
      )}

      {/* Create System Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div
            className="modal-content modal-small"
            role="dialog"
            aria-modal="true"
            aria-label="Add System"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">Add System</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="system-name">Name</label>
                <input
                  id="system-name"
                  type="text"
                  value={newSystemName}
                  onChange={e => setNewSystemName(e.target.value)}
                  placeholder="e.g., Hull Integrity"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="system-category">Category</label>
                {categories && categories.length > 0 ? (
                  <select
                    id="system-category"
                    value={newSystemCategoryId}
                    onChange={e => setNewSystemCategoryId(e.target.value)}
                  >
                    <option value="">Select category…</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ padding: '8px', background: 'var(--color-surface)', borderRadius: '4px', fontSize: '0.875rem' }}>
                    No categories defined. Use the <strong>Categories</strong> button above to create one.
                  </div>
                )}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="system-max">Max Value</label>
                  <input
                    id="system-max"
                    type="number"
                    value={newSystemMaxValue}
                    onChange={e => setNewSystemMaxValue(Number(e.target.value))}
                    min={1}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="system-unit">Unit</label>
                  <input
                    id="system-unit"
                    type="text"
                    value={newSystemUnit}
                    onChange={e => setNewSystemUnit(e.target.value)}
                    placeholder="%"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateSystem}
                disabled={!newSystemName.trim() || createSystem.isPending}
              >
                {createSystem.isPending ? 'Adding...' : 'Add System'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
