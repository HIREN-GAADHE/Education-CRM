import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box, Typography, Grid, Card, CardContent, CardMedia, CardActionArea, CardActions,
    Chip, TextField, InputAdornment, Button, CircularProgress, Alert
} from '@mui/material';
import { Search as SearchIcon, PlayCircle as PlayIcon, Add as AddIcon, Tune as ManageIcon } from '@mui/icons-material';
import { useGetLearningModulesQuery } from '../../store/api/learningApi';
import LearningModuleDialog from './LearningModuleDialog';

const LearningHub: React.FC = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [openDialog, setOpenDialog] = useState(false);
    const { data: modules, isLoading, error, refetch } = useGetLearningModulesQuery({ search });

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold">L&D Hub</Typography>
                    <Typography color="text.secondary">Upskill with our training library</Typography>
                </Box>
                {/* Admin Action (Todo: Check permission) */}
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>Create Module</Button>
            </Box>

            {/* Search Bar */}
            <TextField
                fullWidth
                variant="outlined"
                placeholder="Search for training modules..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon />
                        </InputAdornment>
                    ),
                }}
                sx={{ mb: 4, bgcolor: 'background.paper' }}
            />

            {/* Content Grid */}
            {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
            ) : error ? (
                <Alert severity="error">Failed to load learning modules.</Alert>
            ) : modules?.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 5 }}>
                    <Typography color="text.secondary">No learning modules found.</Typography>
                </Box>
            ) : (
                <Grid container spacing={3}>
                    {modules?.map((module) => (
                        <Grid item xs={12} sm={6} md={4} key={module.id}>
                            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <CardActionArea onClick={() => navigate(`/learning/${module.id}`)}>
                                    <Box sx={{ position: 'relative', height: 200, bgcolor: 'grey.200' }}>
                                        {module.thumbnail ? (
                                            <CardMedia
                                                component="img"
                                                height="200"
                                                image={module.thumbnail}
                                                alt={module.title}
                                            />
                                        ) : (
                                            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#e3f2fd', color: 'primary.main' }}>
                                                <PlayIcon sx={{ fontSize: 64, opacity: 0.5 }} />
                                            </Box>
                                        )}
                                        {module.category && (
                                            <Chip
                                                label={module.category}
                                                size="small"
                                                color="primary"
                                                sx={{ position: 'absolute', top: 10, right: 10 }}
                                            />
                                        )}
                                    </Box>
                                    <CardContent sx={{ flexGrow: 1 }}>
                                        <Typography gutterBottom variant="h6" component="div" fontWeight="bold">
                                            {module.title}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{
                                            display: '-webkit-box',
                                            overflow: 'hidden',
                                            WebkitBoxOrient: 'vertical',
                                            WebkitLineClamp: 3,
                                        }}>
                                            {module.description}
                                        </Typography>
                                    </CardContent>
                                </CardActionArea>
                                <CardActions>
                                    <Button size="small" startIcon={<ManageIcon />} onClick={() => navigate(`/learning/${module.id}/manage`)}>
                                        Manage Content
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            <LearningModuleDialog
                open={openDialog}
                onClose={() => setOpenDialog(false)}
                onSuccess={refetch}
            />
        </Box>
    );
};

export default LearningHub;
