import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, FormControlLabel, Switch, Box,
    Autocomplete
} from '@mui/material';
import { useCreateLearningModuleMutation } from '../../store/api/learningApi';
import { toast } from 'react-toastify';

interface LearningModuleDialogProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CATEGORIES = [
    'Technical',
    'Soft Skills',
    'Management',
    'Compliance',
    'Onboarding',
    'Other'
];

const LearningModuleDialog: React.FC<LearningModuleDialogProps> = ({
    open,
    onClose,
    onSuccess
}) => {
    const [createModule, { isLoading }] = useCreateLearningModuleMutation();

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'Technical',
        thumbnail: '',
        is_published: true
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, checked, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createModule(formData).unwrap();
            toast.success('Learning module created successfully');
            setFormData({
                title: '',
                description: '',
                category: 'Technical',
                thumbnail: '',
                is_published: true
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to create module:', error);
            toast.error('Failed to create learning module');
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <form onSubmit={handleSubmit}>
                <DialogTitle>Create Learning Module</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            name="title"
                            label="Module Title"
                            fullWidth
                            required
                            value={formData.title}
                            onChange={handleChange}
                        />

                        <TextField
                            name="description"
                            label="Description"
                            fullWidth
                            multiline
                            rows={3}
                            value={formData.description}
                            onChange={handleChange}
                        />

                        <Autocomplete
                            freeSolo
                            options={CATEGORIES}
                            value={formData.category}
                            onChange={(_event, newValue) => {
                                setFormData(prev => ({ ...prev, category: newValue || '' }));
                            }}
                            onInputChange={(_event, newInputValue) => {
                                setFormData(prev => ({ ...prev, category: newInputValue }));
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Category"
                                    name="category"
                                    fullWidth
                                />
                            )}
                        />

                        <TextField
                            name="thumbnail"
                            label="Thumbnail URL (Optional)"
                            fullWidth
                            placeholder="https://example.com/image.jpg"
                            value={formData.thumbnail}
                            onChange={handleChange}
                            helperText="Enter a direct link to an image"
                        />

                        <FormControlLabel
                            control={
                                <Switch
                                    name="is_published"
                                    checked={formData.is_published}
                                    onChange={handleChange}
                                    color="primary"
                                />
                            }
                            label="Publish Immediately"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Creating...' : 'Create'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default LearningModuleDialog;
