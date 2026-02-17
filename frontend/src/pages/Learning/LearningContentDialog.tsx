import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, MenuItem, Box
} from '@mui/material';
import { useAddLearningContentMutation, useUpdateLearningContentMutation, LearningContent } from '../../store/api/learningApi';
import { toast } from 'react-toastify';

interface LearningContentDialogProps {
    open: boolean;
    moduleId: string;
    content?: LearningContent | null; // If provided, we are in edit mode
    onClose: () => void;
    onSuccess: () => void;
}

const CONTENT_TYPES = [
    { value: 'video', label: 'Video (YouTube/URL)' },
    { value: 'document', label: 'Document (PDF/Doc)' },
    { value: 'link', label: 'External Link' }
];

const LearningContentDialog: React.FC<LearningContentDialogProps> = ({
    open,
    moduleId,
    content,
    onClose,
    onSuccess
}) => {
    const [addContent, { isLoading: isAdding }] = useAddLearningContentMutation();
    const [updateContent, { isLoading: isUpdating }] = useUpdateLearningContentMutation();
    const isLoading = isAdding || isUpdating;

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        content_type: 'video',
        content_url: '',
        duration_seconds: 0,
        order: 0
    });

    useEffect(() => {
        if (content) {
            setFormData({
                title: content.title,
                description: content.description || '',
                content_type: content.content_type,
                content_url: content.content_url,
                duration_seconds: content.duration_seconds || 0,
                order: content.order
            });
        } else {
            // Reset for new creation
            setFormData({
                title: '',
                description: '',
                content_type: 'video',
                content_url: '',
                duration_seconds: 0,
                order: 0
            });
        }
    }, [content, open]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name as string]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (content) {
                await updateContent({
                    moduleId,
                    contentId: content.id,
                    data: formData as any
                }).unwrap();
                toast.success('Content updated successfully');
            } else {
                await addContent({
                    moduleId,
                    data: formData as any
                }).unwrap();
                toast.success('Content added successfully');
            }
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to save content:', error);
            toast.error('Failed to save content');
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <form onSubmit={handleSubmit}>
                <DialogTitle>{content ? 'Edit Content' : 'Add Content'}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            name="title"
                            label="Title"
                            fullWidth
                            required
                            value={formData.title}
                            onChange={handleChange}
                        />

                        <TextField
                            select
                            name="content_type"
                            label="Content Type"
                            fullWidth
                            value={formData.content_type}
                            onChange={handleChange}
                        >
                            {CONTENT_TYPES.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            name="content_url"
                            label="Content URL"
                            fullWidth
                            required
                            value={formData.content_url}
                            onChange={handleChange}
                            helperText={
                                formData.content_type === 'video'
                                    ? 'Enter YouTube URL (e.g. https://youtube.com/watch?v=...)'
                                    : 'Enter direct link to file or page'
                            }
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

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                name="order"
                                label="Order"
                                type="number"
                                fullWidth
                                value={formData.order}
                                onChange={handleChange}
                                helperText="Sorting order (0, 1, 2...)"
                            />
                            {formData.content_type === 'video' && (
                                <TextField
                                    name="duration_seconds"
                                    label="Duration (seconds)"
                                    type="number"
                                    fullWidth
                                    value={formData.duration_seconds}
                                    onChange={handleChange}
                                />
                            )}
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Saving...' : 'Save'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default LearningContentDialog;
