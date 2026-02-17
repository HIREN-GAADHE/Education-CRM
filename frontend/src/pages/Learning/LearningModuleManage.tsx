import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box, Typography, Button, IconButton, Paper, List, ListItem,
    ListItemText, ListItemSecondaryAction, Divider, CircularProgress, Alert, Tooltip
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    PlayCircle as VideoIcon,
    Description as DocIcon,
    Link as LinkIcon
} from '@mui/icons-material';
import { useGetLearningModuleQuery, useDeleteLearningContentMutation, LearningContent } from '../../store/api/learningApi';
import LearningContentDialog from './LearningContentDialog';
import { toast } from 'react-toastify';

const LearningModuleManage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: moduleData, isLoading, error, refetch } = useGetLearningModuleQuery(id || '', { skip: !id });
    const [deleteContent] = useDeleteLearningContentMutation();

    // Dialog State
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedContent, setSelectedContent] = useState<LearningContent | null>(null);

    const handleEditContent = (content: LearningContent) => {
        setSelectedContent(content);
        setOpenDialog(true);
    };

    const handleAddContent = () => {
        setSelectedContent(null);
        setOpenDialog(true);
    };

    const handleDeleteContent = async (contentId: string) => {
        if (!window.confirm('Are you sure you want to delete this content?')) return;
        try {
            await deleteContent({ moduleId: id!, contentId }).unwrap();
            toast.success('Content deleted');
            refetch();
        } catch (error) {
            console.error('Failed to delete content:', error);
            toast.error('Failed to delete content');
        }
    };

    if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;
    if (error || !moduleData) return <Alert severity="error">Module not found</Alert>;

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IconButton onClick={() => navigate('/learning')} sx={{ mr: 2 }}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Box>
                        <Typography variant="h5" fontWeight="bold">Manage Content</Typography>
                        <Typography color="text.secondary">{moduleData.title}</Typography>
                    </Box>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddContent}
                >
                    Add Content
                </Button>
            </Box>

            {/* Content List */}
            <Paper elevation={0} variant="outlined">
                {moduleData.contents && moduleData.contents.length > 0 ? (
                    <List>
                        {moduleData.contents.map((item, index) => (
                            <React.Fragment key={item.id}>
                                <ListItem>
                                    <Box sx={{ mr: 2, color: 'text.secondary' }}>
                                        {item.content_type === 'video' ? <VideoIcon /> :
                                            item.content_type === 'document' ? <DocIcon /> : <LinkIcon />}
                                    </Box>
                                    <ListItemText
                                        primary={item.title}
                                        secondary={
                                            <Typography variant="body2" color="text.secondary" component="span">
                                                {item.content_type.toUpperCase()} • Order: {item.order}
                                                {item.duration_seconds ? ` • ${Math.floor(item.duration_seconds / 60)}m ${item.duration_seconds % 60}s` : ''}
                                            </Typography>
                                        }
                                    />
                                    <ListItemSecondaryAction>
                                        <Tooltip title="Edit">
                                            <IconButton edge="end" onClick={() => handleEditContent(item)} sx={{ mr: 1 }}>
                                                <EditIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton edge="end" color="error" onClick={() => handleDeleteContent(item.id)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </ListItemSecondaryAction>
                                </ListItem>
                                {index < (moduleData.contents?.length || 0) - 1 && <Divider />}
                            </React.Fragment>
                        ))}
                    </List>
                ) : (
                    <Box sx={{ p: 5, textAlign: 'center', color: 'text.secondary' }}>
                        <Typography>No content added yet.</Typography>
                        <Button startIcon={<AddIcon />} onClick={handleAddContent} sx={{ mt: 1 }}>
                            Add First Item
                        </Button>
                    </Box>
                )}
            </Paper>

            <LearningContentDialog
                open={openDialog}
                moduleId={id!}
                content={selectedContent}
                onClose={() => setOpenDialog(false)}
                onSuccess={refetch}
            />
        </Box>
    );
};

export default LearningModuleManage;
