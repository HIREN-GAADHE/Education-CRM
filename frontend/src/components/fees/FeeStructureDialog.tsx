import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Button, Dialog, DialogTitle, DialogContent,
    TextField, IconButton, Grid, Card, CardContent, CardActions, Chip, Divider,
    FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
    Collapse, Alert,
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import {
    useGetFeeStructuresQuery,
    useCreateFeeStructureMutation,
    useUpdateFeeStructureMutation,
    useDeleteFeeStructureMutation,
} from '@/store/api/feeApi';
import type { FeeStructure, FeeComponent } from '@/store/api/feeApi';
import { toast } from 'react-toastify';

interface FeeStructureDialogProps {
    open: boolean;
    onClose: () => void;
}

const FEE_COMPONENT_TYPES = [
    'tuition', 'admission', 'examination', 'laboratory', 'library',
    'transport', 'sports', 'hostel', 'development', 'activity', 'other'
];

const emptyComponent: FeeComponent = { name: '', type: 'tuition', amount: 0, optional: false };

const emptyForm = {
    name: '',
    description: '',
    course: '',
    department: '',
    batch: '',
    academic_year: '',
    fee_components: [{ ...emptyComponent }] as FeeComponent[],
    total_amount: 0,
    is_active: true,
};

const FeeStructureDialog: React.FC<FeeStructureDialogProps> = ({ open, onClose }) => {
    const { data: structures, isLoading } = useGetFeeStructuresQuery({ active_only: false });
    const [createStructure, { isLoading: isCreating }] = useCreateFeeStructureMutation();
    const [updateStructure, { isLoading: isUpdating }] = useUpdateFeeStructureMutation();
    const [deleteStructure] = useDeleteFeeStructureMutation();

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...emptyForm });

    // Recalculate total whenever components change
    useEffect(() => {
        const total = form.fee_components.reduce((sum, c) => sum + (c.amount || 0), 0);
        setForm(prev => ({ ...prev, total_amount: total }));
    }, [form.fee_components]);

    const handleNew = () => {
        setEditingId(null);
        setForm({ ...emptyForm, fee_components: [{ ...emptyComponent }] });
        setShowForm(true);
    };

    const handleEdit = (s: FeeStructure) => {
        setEditingId(s.id);
        setForm({
            name: s.name,
            description: s.description || '',
            course: s.course || '',
            department: s.department || '',
            batch: s.batch || '',
            academic_year: s.academic_year || '',
            fee_components: s.fee_components?.length ? [...s.fee_components] : [{ ...emptyComponent }],
            total_amount: s.total_amount,
            is_active: s.is_active,
        });
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this fee structure?')) return;
        try {
            await deleteStructure(id).unwrap();
            toast.success('Fee structure deleted');
        } catch {
            toast.error('Failed to delete');
        }
    };

    const handleAddComponent = () => {
        setForm(prev => ({
            ...prev,
            fee_components: [...prev.fee_components, { ...emptyComponent }],
        }));
    };

    const handleRemoveComponent = (index: number) => {
        setForm(prev => ({
            ...prev,
            fee_components: prev.fee_components.filter((_, i) => i !== index),
        }));
    };

    const handleComponentChange = (index: number, field: keyof FeeComponent, value: any) => {
        setForm(prev => {
            const updated = [...prev.fee_components];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, fee_components: updated };
        });
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error('Name is required');
            return;
        }
        if (form.total_amount <= 0) {
            toast.error('Total amount must be greater than 0');
            return;
        }

        // Clean empty components
        const cleanComponents = form.fee_components.filter(c => c.name.trim() && c.amount > 0);

        const payload = {
            name: form.name.trim(),
            description: form.description.trim() || undefined,
            course: form.course.trim() || undefined,
            department: form.department.trim() || undefined,
            batch: form.batch.trim() || undefined,
            academic_year: form.academic_year.trim() || undefined,
            fee_components: cleanComponents,
            total_amount: form.total_amount,
            is_active: form.is_active,
        };

        try {
            if (editingId) {
                await updateStructure({ id: editingId, data: payload }).unwrap();
                toast.success('Fee structure updated');
            } else {
                await createStructure(payload).unwrap();
                toast.success('Fee structure created');
            }
            setShowForm(false);
            setEditingId(null);
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Failed to save');
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Manage Fee Structures
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
                {!showForm ? (
                    <>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                                Fee structures define preset fees with component breakdowns. Use them in Bulk Generate to auto-fill amounts.
                            </Typography>
                            <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={handleNew}>
                                New Structure
                            </Button>
                        </Box>

                        {isLoading && <Typography>Loading...</Typography>}

                        {!isLoading && (!structures || structures.length === 0) && (
                            <Alert severity="info" sx={{ mt: 2 }}>
                                No fee structures yet. Create one to streamline bulk fee generation.
                            </Alert>
                        )}

                        {structures?.map((s) => (
                            <Card key={s.id} variant="outlined" sx={{ mb: 1.5 }}>
                                <CardContent sx={{ pb: 1, '&:last-child': { pb: 1 } }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Box>
                                            <Typography variant="subtitle1" fontWeight={600}>
                                                {s.name}
                                                {!s.is_active && <Chip label="Inactive" size="small" color="default" sx={{ ml: 1 }} />}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {[s.course, s.department, s.academic_year].filter(Boolean).join(' • ') || 'General'}
                                            </Typography>
                                        </Box>
                                        <Typography variant="h6" color="primary" fontWeight={700}>
                                            ₹{s.total_amount.toLocaleString()}
                                        </Typography>
                                    </Box>

                                    {/* Expandable component breakdown */}
                                    {s.fee_components?.length > 0 && (
                                        <>
                                            <Button
                                                size="small"
                                                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                                                endIcon={expandedId === s.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                sx={{ mt: 0.5, textTransform: 'none' }}
                                            >
                                                {s.fee_components.length} component{s.fee_components.length > 1 ? 's' : ''}
                                            </Button>
                                            <Collapse in={expandedId === s.id}>
                                                <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5, mt: 0.5 }}>
                                                    {s.fee_components.map((c, i) => (
                                                        <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                                                            <Typography variant="body2">
                                                                {c.name}
                                                                {c.optional && <Chip label="Optional" size="small" sx={{ ml: 0.5, height: 18, fontSize: 10 }} />}
                                                            </Typography>
                                                            <Typography variant="body2" fontWeight={600}>₹{c.amount.toLocaleString()}</Typography>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </Collapse>
                                        </>
                                    )}
                                </CardContent>
                                <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                                    <IconButton size="small" onClick={() => handleEdit(s)}><EditIcon fontSize="small" /></IconButton>
                                    <IconButton size="small" color="error" onClick={() => handleDelete(s.id)}><DeleteIcon fontSize="small" /></IconButton>
                                </CardActions>
                            </Card>
                        ))}
                    </>
                ) : (
                    /* Form for creating/editing */
                    <Box>
                        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                            {editingId ? 'Edit Fee Structure' : 'Create New Fee Structure'}
                        </Typography>

                        <Grid container spacing={2}>
                            <Grid item xs={12} md={8}>
                                <TextField
                                    fullWidth size="small" label="Structure Name *" required
                                    placeholder="e.g. Annual Tuition Fee 2025-26"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <FormControlLabel
                                    control={<Switch checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />}
                                    label="Active"
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth size="small" label="Description"
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    fullWidth size="small" label="Course"
                                    placeholder="e.g. B.Tech, MBA"
                                    value={form.course}
                                    onChange={(e) => setForm({ ...form, course: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    fullWidth size="small" label="Department"
                                    value={form.department}
                                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    fullWidth size="small" label="Academic Year"
                                    placeholder="e.g. 2025-2026"
                                    value={form.academic_year}
                                    onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
                                />
                            </Grid>
                        </Grid>

                        {/* Fee Components Section */}
                        <Divider sx={{ my: 2 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle2" fontWeight={600}>Fee Components</Typography>
                            <Button size="small" startIcon={<AddIcon />} onClick={handleAddComponent}>
                                Add Component
                            </Button>
                        </Box>

                        {form.fee_components.map((comp, idx) => (
                            <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                                <TextField
                                    size="small" label="Component Name" sx={{ flex: 2 }}
                                    placeholder="e.g. Tuition, Lab Fee"
                                    value={comp.name}
                                    onChange={(e) => handleComponentChange(idx, 'name', e.target.value)}
                                />
                                <FormControl size="small" sx={{ flex: 1, minWidth: 120 }}>
                                    <InputLabel>Type</InputLabel>
                                    <Select
                                        value={comp.type}
                                        label="Type"
                                        onChange={(e) => handleComponentChange(idx, 'type', e.target.value)}
                                    >
                                        {FEE_COMPONENT_TYPES.map(t => (
                                            <MenuItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField
                                    size="small" label="Amount (₹)" type="number" sx={{ flex: 1 }}
                                    value={comp.amount || ''}
                                    onChange={(e) => handleComponentChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                                />
                                <IconButton
                                    size="small" color="error"
                                    onClick={() => handleRemoveComponent(idx)}
                                    disabled={form.fee_components.length <= 1}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        ))}

                        {/* Total */}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, p: 1.5, bgcolor: 'primary.main', borderRadius: 1, color: 'primary.contrastText' }}>
                            <Typography variant="h6" fontWeight={700}>
                                Total: ₹{form.total_amount.toLocaleString()}
                            </Typography>
                        </Box>

                        {/* Form Actions */}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                            <Button onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
                            <Button
                                variant="contained"
                                onClick={handleSave}
                                disabled={isCreating || isUpdating}
                            >
                                {isCreating || isUpdating ? 'Saving...' : editingId ? 'Update' : 'Create'}
                            </Button>
                        </Box>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default FeeStructureDialog;
