import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box,
    Typography,
    TextField,
    Button,
    CircularProgress,
    Alert,
    InputAdornment,
    IconButton,
    FormControlLabel,
    Checkbox,
    Link,
} from '@mui/material';
import {
    Email as EmailIcon,
    Lock as LockIcon,
    Visibility,
    VisibilityOff,
    School as SchoolIcon,
} from '@mui/icons-material';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { useLoginMutation } from '@/store/api/authApi';
import { setCredentials } from '@/store/slices/authSlice';

import { selectInstitutionName, selectInstitutionLogoUrl } from '@/store/slices/uiSlice';

const validationSchema = yup.object({
    email: yup.string().email('Enter a valid email').required('Email is required'),
    password: yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
});

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch();
    const [login, { isLoading, error }] = useLoginMutation();
    const [showPassword, setShowPassword] = useState(false);

    // Branding
    const institutionName = useSelector(selectInstitutionName);
    const institutionLogoUrl = useSelector(selectInstitutionLogoUrl);

    const from = (location.state as any)?.from?.pathname || '/dashboard';

    const formik = useFormik({
        initialValues: {
            email: '',
            password: '',
            remember_me: false,
        },
        validationSchema,
        onSubmit: async (values) => {
            try {
                const result = await login(values).unwrap();
                dispatch(
                    setCredentials({
                        user: {
                            id: result.user.id,
                            email: result.user.email,
                            first_name: result.user.first_name,
                            last_name: result.user.last_name,
                            full_name: `${result.user.first_name} ${result.user.last_name || ''}`.trim(),
                            avatar_url: result.user.avatar_url,
                            status: 'active' as any,
                            email_verified: true,
                            roles: [],
                            created_at: new Date().toISOString(),
                        },
                        accessToken: result.access_token,
                        refreshToken: result.refresh_token,
                        roles: result.user.roles,
                        permissions: [], // Will be loaded from API
                        roleLevel: result.user.role_level ?? 99,
                        restrictedModules: result.user.restricted_modules ?? [],
                        allowedModules: result.user.allowed_modules ?? [],
                    })
                );


                navigate(from, { replace: true });
            } catch (err) {
                // Error handled by RTK Query
            }
        },
    });

    const getLogoSrc = () => {
        if (!institutionLogoUrl) return null;
        if (institutionLogoUrl.startsWith('http')) return institutionLogoUrl;
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
            const url = new URL(apiUrl);
            return `${url.origin}${institutionLogoUrl.startsWith('/') ? '' : '/'}${institutionLogoUrl}`;
        } catch (e) {
            return institutionLogoUrl;
        }
    };

    return (
        <Box>
            {/* Logo */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                    {institutionLogoUrl ? (
                        <Box
                            component="img"
                            src={getLogoSrc()!}
                            alt="Logo"
                            sx={{
                                width: 50,
                                height: 50,
                                objectFit: 'contain',
                                mr: 1,
                            }}
                        />
                    ) : (
                        <SchoolIcon sx={{ fontSize: 48, color: 'primary.main', mr: 1 }} />
                    )}
                    <Typography variant="h4" fontWeight="bold" color="primary.main">
                        {institutionName || 'EduERP'}
                    </Typography>
                </Box>
                <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ color: 'grey.800' }}>
                    Welcome Back
                </Typography>
                <Typography sx={{ color: 'grey.600' }}>
                    Sign in to continue to your dashboard
                </Typography>
            </Box>

            {/* Error Alert */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {'data' in error
                        ? (error.data as any)?.detail || 'Login failed'
                        : 'An error occurred'}
                </Alert>
            )}

            {/* Login Form */}
            <form onSubmit={formik.handleSubmit}>
                <TextField
                    fullWidth
                    id="email"
                    name="email"
                    label="Email"
                    placeholder="Enter your email"
                    value={formik.values.email}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.email && Boolean(formik.errors.email)}
                    helperText={formik.touched.email && formik.errors.email}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <EmailIcon sx={{ color: 'grey.500' }} />
                            </InputAdornment>
                        ),
                    }}
                    sx={{
                        mb: 2,
                        '& .MuiOutlinedInput-root': {
                            backgroundColor: 'grey.50',
                            '& fieldset': { borderColor: 'grey.300' },
                            '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                        },
                        '& .MuiInputLabel-root': { color: 'grey.700' },
                        '& .MuiInputBase-input': { color: 'grey.900' },
                        '& .MuiInputBase-input::placeholder': { color: 'grey.500', opacity: 1 },
                    }}
                />

                <TextField
                    fullWidth
                    id="password"
                    name="password"
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formik.values.password}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.password && Boolean(formik.errors.password)}
                    helperText={formik.touched.password && formik.errors.password}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <LockIcon sx={{ color: 'grey.500' }} />
                            </InputAdornment>
                        ),
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    onClick={() => setShowPassword(!showPassword)}
                                    edge="end"
                                    sx={{ color: 'grey.600' }}
                                >
                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                    sx={{
                        mb: 2,
                        '& .MuiOutlinedInput-root': {
                            backgroundColor: 'grey.50',
                            '& fieldset': { borderColor: 'grey.300' },
                            '&:hover fieldset': { borderColor: 'primary.main' },
                            '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                        },
                        '& .MuiInputLabel-root': { color: 'grey.700' },
                        '& .MuiInputBase-input': { color: 'grey.900' },
                        '& .MuiInputBase-input::placeholder': { color: 'grey.500', opacity: 1 },
                    }}
                />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                name="remember_me"
                                checked={formik.values.remember_me}
                                onChange={formik.handleChange}
                                size="small"
                            />
                        }
                        label={<Typography variant="body2" sx={{ color: 'grey.700' }}>Remember me</Typography>}
                    />
                    <Link href="#" variant="body2" underline="hover" sx={{ color: 'primary.main' }}>
                        Forgot password?
                    </Link>
                </Box>

                <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={isLoading}
                    sx={{ py: 1.5, mb: 2 }}
                >
                    {isLoading ? (
                        <CircularProgress size={24} color="inherit" />
                    ) : (
                        'Sign In'
                    )}
                </Button>
            </form>

            <Typography variant="body2" align="center" sx={{ color: 'grey.600' }}>
                Don't have an account?{' '}
                <Link href="#" underline="hover" fontWeight="medium" sx={{ color: 'primary.main' }}>
                    Contact your administrator
                </Link>
            </Typography>
        </Box>
    );
};

export default LoginPage;
