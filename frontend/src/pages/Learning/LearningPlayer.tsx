import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box, Typography, Grid, Card, CardContent, Button, List,
    ListItemText, ListItemIcon, ListItemButton, Divider, CircularProgress,
    Alert, IconButton
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    PlayCircle as PlayIcon,
    Description as DocIcon,
    Link as LinkIcon,
} from '@mui/icons-material';
import { useGetLearningModuleQuery, LearningContent } from '../../store/api/learningApi';


const LearningPlayer: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: moduleData, isLoading, error } = useGetLearningModuleQuery(id || '', { skip: !id });
    const [selectedContent, setSelectedContent] = useState<LearningContent | null>(null);

    // Auto-select first content when loaded
    useEffect(() => {
        if (moduleData?.contents && moduleData.contents.length > 0 && !selectedContent) {
            setSelectedContent(moduleData.contents[0]);
        }
    }, [moduleData, selectedContent]);

    // Helper to extract YouTube ID
    const getYouTubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;
    if (error || !moduleData) return <Alert severity="error">Module not found</Alert>;

    return (
        <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                <IconButton onClick={() => navigate('/learning')} sx={{ mr: 2 }}>
                    <ArrowBackIcon />
                </IconButton>
                <Box>
                    <Typography variant="h6" fontWeight="bold">{moduleData.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{moduleData.category}</Typography>
                </Box>
            </Box>

            <Grid container spacing={2} sx={{ flexGrow: 1, overflow: 'hidden' }}>
                {/* Main Player Area */}
                <Grid item xs={12} md={9} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Card sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', bgcolor: 'black', color: 'white', borderRadius: 2, overflow: 'hidden' }}>
                        {selectedContent ? (
                            selectedContent.content_type === 'video' ? (
                                <Box sx={{ position: 'relative', width: '100%', height: '100%', minHeight: 400 }}>
                                    {getYouTubeId(selectedContent.content_url) ? (
                                        <iframe
                                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                                            src={`https://www.youtube.com/embed/${getYouTubeId(selectedContent.content_url)}?autoplay=1`}
                                            title={selectedContent.title}
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        />
                                    ) : (
                                        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Typography>Invalid Video URL</Typography>
                                        </Box>
                                    )}
                                </Box>
                            ) : (
                                <Box sx={{ p: 5, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.900' }}>
                                    {selectedContent.content_type === 'document' ? <DocIcon sx={{ fontSize: 80, mb: 2 }} /> : <LinkIcon sx={{ fontSize: 80, mb: 2 }} />}
                                    <Typography variant="h5" gutterBottom>{selectedContent.title}</Typography>
                                    <Typography variant="body1" sx={{ mb: 4, maxWidth: 600, textAlign: 'center' }}>{selectedContent.description}</Typography>
                                    <Button variant="contained" size="large" href={selectedContent.content_url} target="_blank" rel="noopener noreferrer">
                                        Open Resource
                                    </Button>
                                </Box>
                            )
                        ) : (
                            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography>Select content to start</Typography>
                            </Box>
                        )}
                    </Card>
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                        <Typography variant="h6">{selectedContent?.title}</Typography>
                        <Typography variant="body2" color="text.secondary">{selectedContent?.description}</Typography>
                    </Box>
                </Grid>

                {/* Playlist Sidebar */}
                <Grid item xs={12} md={3} sx={{ height: '100%', overflow: 'auto' }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ p: 0 }}>
                            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                                <Typography variant="subtitle1" fontWeight="bold">Course Content</Typography>
                                <Typography variant="caption" color="text.secondary">{moduleData?.contents?.length || 0} items</Typography>
                            </Box>
                            <List disablePadding>
                                {moduleData?.contents?.map((item, index) => (
                                    <React.Fragment key={item.id}>
                                        <ListItemButton
                                            selected={selectedContent?.id === item.id}
                                            onClick={() => setSelectedContent(item)}
                                            sx={{
                                                borderLeft: selectedContent?.id === item.id ? '4px solid' : '4px solid transparent',
                                                borderColor: 'primary.main'
                                            }}
                                        >
                                            <ListItemIcon sx={{ minWidth: 40 }}>
                                                {item.content_type === 'video' ? <PlayIcon color={selectedContent?.id === item.id ? "primary" : "inherit"} /> :
                                                    item.content_type === 'document' ? <DocIcon /> : <LinkIcon />}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={item.title}
                                                secondary={`Lesson ${index + 1}`}
                                                primaryTypographyProps={{ fontWeight: selectedContent?.id === item.id ? 600 : 400, variant: 'body2' }}
                                            />
                                        </ListItemButton>
                                        <Divider component="li" />
                                    </React.Fragment>
                                ))}
                            </List>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default LearningPlayer;
