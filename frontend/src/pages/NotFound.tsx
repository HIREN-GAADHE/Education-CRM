import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { SentimentDissatisfied as NotFoundIcon } from '@mui/icons-material';

const NotFoundPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '80vh',
                textAlign: 'center',
                p: 3,
            }}
        >
            <NotFoundIcon sx={{ fontSize: 120, color: 'text.secondary', mb: 3 }} />
            <Typography variant="h2" fontWeight="bold" gutterBottom>
                404
            </Typography>
            <Typography variant="h5" color="text.secondary" gutterBottom>
                Page Not Found
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 400 }}>
                The page you're looking for doesn't exist or has been moved.
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

export default NotFoundPage;
