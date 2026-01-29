import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Block as BlockIcon } from '@mui/icons-material';

const ForbiddenPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                textAlign: 'center',
                p: 3,
            }}
        >
            <BlockIcon sx={{ fontSize: 120, color: 'error.main', mb: 3 }} />
            <Typography variant="h2" fontWeight="bold" gutterBottom>
                403
            </Typography>
            <Typography variant="h5" color="text.secondary" gutterBottom>
                Access Forbidden
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 400 }}>
                You don't have permission to access this page. Please contact your administrator if you believe this is an error.
            </Typography>
            <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/dashboard')}
            >
                Go to Dashboard
            </Button>
        </Box>
    );
};

export default ForbiddenPage;
