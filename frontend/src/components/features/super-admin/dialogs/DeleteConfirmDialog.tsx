import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Alert
} from '@mui/material';
import { useDeleteTenantMutation } from '@/store/api/superAdminApi';

interface DeleteConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    tenant: { id: string; name: string } | null;
    onSuccess: () => void;
}

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({ open, onClose, tenant, onSuccess }) => {
    const [deleteTenant] = useDeleteTenantMutation();
    const [confirmation, setConfirmation] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!tenant) return;
        if (confirmation !== tenant.name) {
            setError("University name does not match confirmation");
            return;
        }
        try {
            setError(null);
            await deleteTenant(tenant.id).unwrap();
            setConfirmation('');
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.data?.detail || "Failed to delete university");
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ color: 'error.main' }}>Delete University</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2 }}>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        This action cannot be undone. All data related to <b>{tenant?.name}</b> will be permanently deleted.
                    </Alert>
                    <TextField
                        label={`Type "${tenant?.name}" to confirm`}
                        fullWidth
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                        error={error !== null}
                        helperText={error}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    color="error"
                    onClick={handleSubmit}
                    disabled={confirmation !== tenant?.name}
                >
                    Delete Permanently
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DeleteConfirmDialog;
