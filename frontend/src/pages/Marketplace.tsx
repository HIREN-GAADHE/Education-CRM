import React from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    Chip,
    Card,
    CardContent,
    Grid,
    useTheme,
    alpha,
} from '@mui/material';
import {
    StorefrontOutlined,
    RocketLaunchOutlined,
    NotificationsActiveOutlined,
    CheckCircleOutline,
} from '@mui/icons-material';

const Marketplace: React.FC = () => {
    const theme = useTheme();
    const [notifyRequested, setNotifyRequested] = React.useState(false);

    const handleNotifyMe = () => {
        setNotifyRequested(true);
        // In a real app, this would call an API to register interest
    };

    const upcomingFeatures = [
        { name: 'Digital Content Store', description: 'Purchase and download study materials' },
        { name: 'Third-party Integrations', description: 'Connect with education tools and services' },
        { name: 'Vendor Management', description: 'Manage suppliers and school vendors' },
        { name: 'Resource Booking', description: 'Book equipment, labs, and facilities' },
    ];

    return (
        <Box sx={{ p: 3 }}>
            {/* Hero Section */}
            <Paper
                elevation={0}
                sx={{
                    p: 6,
                    textAlign: 'center',
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
                    borderRadius: 4,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    mb: 4,
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        mb: 3,
                    }}
                >
                    <Box
                        sx={{
                            width: 100,
                            height: 100,
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.3)}`,
                        }}
                    >
                        <StorefrontOutlined sx={{ fontSize: 48, color: 'white' }} />
                    </Box>
                </Box>

                <Chip
                    icon={<RocketLaunchOutlined />}
                    label="Elite Package"
                    color="primary"
                    sx={{ mb: 2, fontWeight: 600 }}
                />

                <Typography
                    variant="h3"
                    component="h1"
                    sx={{
                        fontWeight: 700,
                        mb: 2,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}
                >
                    Research & Development
                </Typography>

                <Typography
                    variant="h6"
                    color="text.secondary"
                    sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}
                >
                    A unified platform for educational resources, third-party integrations,
                    and institutional services — all in one place.
                </Typography>

                {!notifyRequested ? (
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<NotificationsActiveOutlined />}
                        onClick={handleNotifyMe}
                        sx={{
                            px: 4,
                            py: 1.5,
                            borderRadius: 3,
                            textTransform: 'none',
                            fontSize: '1.1rem',
                            fontWeight: 600,
                            boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
                        }}
                    >
                        Contact Administration
                    </Button>
                ) : (
                    <Box
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 3,
                            py: 1.5,
                            borderRadius: 3,
                            bgcolor: alpha(theme.palette.success.main, 0.1),
                            border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                        }}
                    >
                        <CheckCircleOutline color="success" />
                        <Typography color="success.main" fontWeight={600}>
                            Request sent to Administration!
                        </Typography>
                    </Box>
                )}
            </Paper>

            {/* Upcoming Features Grid */}
            <Typography variant="h5" fontWeight={600} sx={{ mb: 3 }}>
                What's Coming
            </Typography>

            <Grid container spacing={3}>
                {upcomingFeatures.map((feature, index) => (
                    <Grid item xs={12} sm={6} md={3} key={index}>
                        <Card
                            elevation={0}
                            sx={{
                                height: '100%',
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: 3,
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
                                    borderColor: theme.palette.primary.main,
                                },
                            }}
                        >
                            <CardContent>
                                <Typography
                                    variant="h6"
                                    fontWeight={600}
                                    sx={{ mb: 1 }}
                                >
                                    {feature.name}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                >
                                    {feature.description}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};

export default Marketplace;
