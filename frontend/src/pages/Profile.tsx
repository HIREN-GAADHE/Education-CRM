import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Avatar, Button, TextField, Divider,
    Switch, FormControlLabel, CircularProgress, Alert, Snackbar
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, setUser } from '@/store/slices/authSlice';
import { useUpdateProfileMutation, useUserChangePasswordMutation } from '@/store/api/userApi';
import { Person as PersonIcon, CameraAlt as CameraIcon, Save as SaveIcon, Lock as LockIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';

const ProfilePage: React.FC = () => {
    const user = useSelector(selectUser);
    const dispatch = useDispatch();

    const [updateProfile, { isLoading: isSaving }] = useUpdateProfileMutation();
    const [changePassword, { isLoading: isChangingPassword }] = useUserChangePasswordMutation();

    // Profile form state
    const [profileForm, setProfileForm] = useState({
        first_name: '',
        last_name: '',
        phone: '',
    });

    // Password form state
    const [passwordForm, setPasswordForm] = useState({
        current_password: '',
        new_password: '',
        confirm_password: '',
    });

    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

    // Initialize form with user data
    useEffect(() => {
        if (user) {
            setProfileForm({
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                phone: user.phone || '',
            });
        }
    }, [user]);

    const handleSaveProfile = async () => {
        try {
            const result = await updateProfile(profileForm).unwrap();
            // Update the auth state with new user data
            dispatch(setUser(result));
            toast.success('Profile updated successfully!');
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Failed to update profile');
        }
    };

    const handleChangePassword = async () => {
        if (passwordForm.new_password !== passwordForm.confirm_password) {
            toast.error('New passwords do not match');
            return;
        }

        if (passwordForm.new_password.length < 8) {
            toast.error('New password must be at least 8 characters');
            return;
        }

        try {
            await changePassword({
                current_password: passwordForm.current_password,
                new_password: passwordForm.new_password,
            }).unwrap();
            toast.success('Password changed successfully!');
            setPasswordForm({
                current_password: '',
                new_password: '',
                confirm_password: '',
            });
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Failed to change password');
        }
    };

    const getRoleName = () => {
        if (user?.roles && user.roles.length > 0) {
            return user.roles[0].display_name || user.roles[0].name;
        }
        return 'User';
    };

    return (
        <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom color="text.primary">
                My Profile
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
                Manage your account settings and preferences
            </Typography>

            <Grid container spacing={3}>
                {/* Avatar Card */}
                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 4 }}>
                            <Box sx={{ position: 'relative', display: 'inline-block', mb: 3 }}>
                                <Avatar
                                    src={user?.avatar_url}
                                    sx={{
                                        width: 140,
                                        height: 140,
                                        border: '4px solid',
                                        borderColor: 'primary.main',
                                        boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
                                    }}
                                >
                                    <PersonIcon sx={{ fontSize: 70 }} />
                                </Avatar>
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        bottom: 0,
                                        right: 0,
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
                                        transition: 'transform 0.3s ease',
                                        '&:hover': {
                                            transform: 'scale(1.1)',
                                        },
                                    }}
                                >
                                    <CameraIcon sx={{ color: 'white', fontSize: 20 }} />
                                </Box>
                            </Box>
                            <Typography variant="h5" fontWeight="bold">
                                {user?.full_name}
                            </Typography>
                            <Typography color="text.secondary" gutterBottom>
                                {user?.email}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    display: 'inline-block',
                                    px: 2,
                                    py: 0.5,
                                    borderRadius: 2,
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    fontWeight: 600,
                                }}
                            >
                                {getRoleName()}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Profile Form */}
                <Grid item xs={12} md={8}>
                    <Card>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>
                                Personal Information
                            </Typography>
                            <Divider sx={{ mb: 3 }} />

                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="First Name"
                                        value={profileForm.first_name}
                                        onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                                        variant="outlined"
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="Last Name"
                                        value={profileForm.last_name}
                                        onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                                        variant="outlined"
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="Email"
                                        value={user?.email || ''}
                                        variant="outlined"
                                        disabled
                                        helperText="Email cannot be changed"
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="Phone"
                                        value={profileForm.phone}
                                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                                        variant="outlined"
                                    />
                                </Grid>
                            </Grid>

                            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    variant="contained"
                                    startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                                    onClick={handleSaveProfile}
                                    disabled={isSaving}
                                    sx={{ borderRadius: 2 }}
                                >
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Security Settings */}
                <Grid item xs={12}>
                    <Card>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LockIcon color="primary" /> Security Settings
                            </Typography>
                            <Divider sx={{ mb: 3 }} />

                            <Grid container spacing={3}>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        fullWidth
                                        label="Current Password"
                                        type="password"
                                        value={passwordForm.current_password}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                                        variant="outlined"
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        fullWidth
                                        label="New Password"
                                        type="password"
                                        value={passwordForm.new_password}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                                        variant="outlined"
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        fullWidth
                                        label="Confirm New Password"
                                        type="password"
                                        value={passwordForm.confirm_password}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                                        variant="outlined"
                                        error={passwordForm.confirm_password !== '' && passwordForm.new_password !== passwordForm.confirm_password}
                                        helperText={
                                            passwordForm.confirm_password !== '' && passwordForm.new_password !== passwordForm.confirm_password
                                                ? 'Passwords do not match'
                                                : ''
                                        }
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={twoFactorEnabled}
                                                    onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                                                />
                                            }
                                            label="Enable two-factor authentication"
                                        />
                                        <Button
                                            variant="outlined"
                                            onClick={handleChangePassword}
                                            disabled={
                                                isChangingPassword ||
                                                !passwordForm.current_password ||
                                                !passwordForm.new_password ||
                                                passwordForm.new_password !== passwordForm.confirm_password
                                            }
                                            startIcon={isChangingPassword ? <CircularProgress size={20} /> : <LockIcon />}
                                        >
                                            {isChangingPassword ? 'Changing...' : 'Change Password'}
                                        </Button>
                                    </Box>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default ProfilePage;
