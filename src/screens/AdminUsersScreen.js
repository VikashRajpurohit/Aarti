import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../config/supabase';
import { authService } from '../services/authService';
import { logService } from '../services/logService';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { textSizes, spacingSizes, iconSizes, shadows } from '../theme/responsive';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import ScreenHeader from '../components/ScreenHeader';
import ResponsiveText from '../components/ResponsiveText';
import AppModal from '../components/AppModal';
import AppTextInput from '../components/AppTextInput';
import AnimatedButton from '../components/AnimatedButton';
import EmptyState from '../components/EmptyState';

const ROLES = [
  { label: 'Admin', value: 'admin', color: colors.error[500] },
  { label: 'General Manager', value: 'general_manager', color: colors.primary[600] },
  { label: 'Sales Manager', value: 'sales_manager', color: colors.success[500] },
  { label: 'Purchase Manager', value: 'purchase_manager', color: colors.warning[500] },
  { label: 'Production Manager', value: 'production_manager', color: colors.secondary[500] },
];

const ROLE_PRIORITY = ['admin', 'general_manager', 'sales_manager', 'purchase_manager', 'production_manager'];

const normalizeRoles = (roles, fallbackRole) => {
  if (Array.isArray(roles) && roles.length > 0) return roles;
  if (fallbackRole) return [fallbackRole];
  return [];
};

const getPrimaryRole = (roles, fallbackRole) => {
  const list = normalizeRoles(roles, fallbackRole);
  for (const role of ROLE_PRIORITY) {
    if (list.includes(role)) return role;
  }
  return list[0] || null;
};

const getRoleColor = (roles, fallbackRole) => {
  const role = getPrimaryRole(roles, fallbackRole);
  switch(role) {
    case 'admin': return colors.error[500];
    case 'general_manager': return colors.primary[600];
    case 'sales_manager': return colors.success[500];
    case 'purchase_manager': return colors.warning[500];
    case 'production_manager': return colors.secondary[500];
    default: return colors.neutral[500];
  }
};

const getRoleLabel = (roles, fallbackRole) => {
  const list = normalizeRoles(roles, fallbackRole);
  if (list.length === 0) return 'User';
  return list.map((role) => {
    const found = ROLES.find(r => r.value === role);
    return found ? found.label : role?.replace(/_/g, ' ');
  }).join(', ');
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function AdminUsersScreen({ refreshSignal }) {
  const { columns, horizontalPadding, scrollBottomPadding, contentMaxWidth, tabBarHeight } =
    useResponsiveLayout();
  const gridColumns = columns > 1 ? 2 : 1;
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', roles: ['sales_manager'] });
  const [creating, setCreating] = useState(false);
  const { logout, user: currentUser, roles: currentRoles } = useAuth();
  const isCurrentAdmin = currentRoles?.includes('admin');

  // Check if target user is an admin
  const isTargetAdmin = (targetUser) => {
    const targetRoles = normalizeRoles(targetUser?.roles, targetUser?.role);
    return targetRoles.includes('admin');
  };

  // Can modify = current user is admin AND (target is not admin OR target is self)
  const canModifyUser = (targetUser) => {
    if (!isCurrentAdmin) return false;
    if (targetUser?.id === currentUser?.id) return false;
    if (isTargetAdmin(targetUser)) return false;
    return true;
  };

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(user => {
      const roleText = getRoleLabel(user.roles, user.role).toLowerCase();
      return user.full_name?.toLowerCase().includes(query) || roleText.includes(query);
    });
  }, [users, searchQuery]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) {
        Alert.alert('Error fetching users', error.message);
    } else {
        setUsers(data);
    }
    setLoading(false);
  }, []);

  useRefreshOnFocus(fetchUsers, [fetchUsers], 'users', refreshSignal);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.full_name) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (!newUser.roles || newUser.roles.length === 0) {
      Alert.alert('Error', 'Please select at least one role');
      return;
    }
    
    setCreating(true);
    try {
      await authService.createUser(newUser);
      await logService.logEvent({
        action: 'user.create',
        entityType: 'user',
        entityId: newUser.email,
        metadata: { roles: newUser.roles, full_name: newUser.full_name },
      });
      Alert.alert('Success', 'User created successfully', [
          { text: 'OK', onPress: () => {
              setModalVisible(false);
              setNewUser({ email: '', password: '', full_name: '', roles: ['sales_manager'] });
              fetchUsers();
          }}
      ]);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleUserPress = (user) => {
    setSelectedUser(user);
    setDetailsModalVisible(true);
  };

  const handleUpdateRoles = async (nextRoles) => {
    if (!selectedUser) return;
    if (!isCurrentAdmin) {
      Alert.alert('Not allowed', 'Only admins can change roles.');
      return;
    }
    if (isTargetAdmin(selectedUser)) {
      Alert.alert('Not allowed', 'Cannot modify another admin\'s roles.');
      return;
    }
    if (!nextRoles || nextRoles.length === 0) {
      Alert.alert('Error', 'At least one role is required.');
      return;
    }

    const currentRoles = normalizeRoles(selectedUser.roles, selectedUser.role);
    const sameRoles = currentRoles.length === nextRoles.length
      && currentRoles.every((r) => nextRoles.includes(r));
    if (sameRoles) return;

    setUpdatingRole(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ roles: nextRoles, role: nextRoles[0], updated_at: new Date().toISOString() })
        .eq('id', selectedUser.id);
      
      if (error) throw error;
      
      setSelectedUser({ ...selectedUser, roles: nextRoles, role: nextRoles[0] });
      fetchUsers();
      await logService.logEvent({
        action: 'user.role.change',
        entityType: 'user',
        entityId: selectedUser.id,
        metadata: { from_roles: currentRoles, to_roles: nextRoles },
      });
      Alert.alert('Success', 'Roles updated successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleToggleUserStatus = async () => {
    if (!selectedUser) return;
    if (!isCurrentAdmin) {
      Alert.alert('Not allowed', 'Only admins can disable/enable users.');
      return;
    }
    if (selectedUser.id === currentUser?.id) {
      Alert.alert('Error', 'You cannot disable your own account.');
      return;
    }
    if (isTargetAdmin(selectedUser)) {
      Alert.alert('Not allowed', 'Cannot disable another admin.');
      return;
    }

    const nextDisabled = !selectedUser.is_disabled;
    const actionLabel = nextDisabled ? 'Disable' : 'Enable';

    Alert.alert(
      `${actionLabel} User`,
      `${actionLabel} ${selectedUser.full_name || 'this user'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: actionLabel, style: nextDisabled ? 'destructive' : 'default', onPress: async () => {
          setUpdatingStatus(true);
          try {
            const { error } = await supabase
              .from('profiles')
              .update({ 
                is_disabled: nextDisabled, 
                disabled_at: nextDisabled ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', selectedUser.id);
            if (error) throw error;

            const updated = { ...selectedUser, is_disabled: nextDisabled };
            setSelectedUser(updated);
            fetchUsers();

            await logService.logEvent({
              action: nextDisabled ? 'user.disable' : 'user.enable',
              entityType: 'user',
              entityId: selectedUser.id,
              metadata: { roles: normalizeRoles(selectedUser.roles, selectedUser.role), full_name: selectedUser.full_name },
            });
            Alert.alert('Success', `User ${nextDisabled ? 'disabled' : 'enabled'} successfully`);
          } catch (error) {
            Alert.alert('Error', error.message);
          } finally {
            setUpdatingStatus(false);
          }
        }},
      ]
    );
  };

  const handleDeleteUser = () => {
    if (!selectedUser) return;
    if (!isCurrentAdmin) {
      Alert.alert('Not allowed', 'Only admins can delete users.');
      return;
    }
    if (selectedUser.id === currentUser?.id) {
      Alert.alert('Error', 'You cannot delete your own account.');
      return;
    }
    if (isTargetAdmin(selectedUser)) {
      Alert.alert('Not allowed', 'Cannot delete another admin.');
      return;
    }
    
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${selectedUser.full_name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', selectedUser.id);
              
              if (error) throw error;
              
              setDetailsModalVisible(false);
              setSelectedUser(null);
              fetchUsers();
              await logService.logEvent({
                action: 'user.delete',
                entityType: 'user',
                entityId: selectedUser.id,
                metadata: { roles: normalizeRoles(selectedUser.roles, selectedUser.role), full_name: selectedUser.full_name },
              });
              Alert.alert('Success', 'User deleted successfully');
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  const handleOpenPasswordModal = () => {
    setNewPassword('');
    setConfirmPassword('');
    setDetailsModalVisible(false);
    setTimeout(() => setPasswordModalVisible(true), 150);
  };

  const handleUpdatePassword = async () => {
    if (!selectedUser) return;
    if (!isCurrentAdmin) {
      Alert.alert('Not allowed', 'Only admins can change passwords.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    try {
      await authService.updateUserPassword({ userId: selectedUser.id, password: newPassword });
      await logService.logEvent({
        action: 'user.password.change',
        entityType: 'user',
        entityId: selectedUser.id,
        metadata: { roles: normalizeRoles(selectedUser.roles, selectedUser.role), full_name: selectedUser.full_name },
      });
      Alert.alert('Success', 'Password updated successfully.');
      setPasswordModalVisible(false);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update password');
    }
  };

  const renderUserItem = ({ item }) => {
    const roleColor = getRoleColor(item.roles, item.role);
    return (
      <TouchableOpacity
        style={[styles.userCard, item.is_disabled && styles.userCardDisabled]}
        onPress={() => handleUserPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { backgroundColor: roleColor + '18' }]}>
          <Text style={[styles.avatarText, { color: roleColor }]}>
            {item.full_name ? item.full_name[0].toUpperCase() : '?'}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <ResponsiveText size="medium" weight="semibold" numberOfLines={1}>
            {item.full_name || 'Unnamed'}
          </ResponsiveText>
          <View style={styles.roleRow}>
            <View style={[styles.roleDot, { backgroundColor: roleColor }]} />
            <ResponsiveText size="tiny" weight="semibold" color={colors.text.secondary} numberOfLines={1} style={styles.roleText}>
              {getRoleLabel(item.roles, item.role)}
            </ResponsiveText>
            {item.is_disabled && (
              <View style={styles.disabledBadge}>
                <ResponsiveText size="tiny" weight="bold" color={colors.error[600]}>DISABLED</ResponsiveText>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={iconSizes.md} color={colors.neutral[300]} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="User Management"
        subtitle={`${users.length} total users`}
        icon="people-outline"
        right={
          <TouchableOpacity onPress={logout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={iconSizes.lg} color={colors.white} />
          </TouchableOpacity>
        }
      />

      {/* Search Bar */}
      <View style={[styles.searchContainer, { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search-outline" size={iconSizes.md} color={colors.neutral[400]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor={colors.neutral[400]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={iconSizes.md} color={colors.neutral[400]} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* User List */}
      <FlatList
        key={`cols-${gridColumns}`}
        numColumns={gridColumns}
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={item => item.id}
        refreshing={loading}
        onRefresh={fetchUsers}
        columnWrapperStyle={gridColumns > 1 ? { gap: spacingSizes.sm } : undefined}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: scrollBottomPadding,
            maxWidth: contentMaxWidth,
            alignSelf: 'center',
            width: '100%',
          },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading && (
            <EmptyState
              icon="people-outline"
              title={searchQuery ? 'No users found matching your search' : 'No users found'}
            />
          )
        }
      />

      {/* FAB - only for admins */}
      {isCurrentAdmin && <TouchableOpacity
        style={[styles.fab, { bottom: tabBarHeight + spacingSizes.lg }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <View style={styles.fabInner}>
          <Ionicons name="add" size={iconSizes.xl} color={colors.white} />
        </View>
      </TouchableOpacity>}

      {/* Create User Modal */}
      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Create New User"
        subtitle="Add a new team member"
        footer={
          <AnimatedButton
            title="Create User"
            onPress={handleCreateUser}
            loading={creating}
            icon={<Ionicons name="person-add-outline" size={iconSizes.md} color={colors.white} />}
            style={{ flex: 1 }}
          />
        }
      >
        <AppTextInput
          label="Full Name"
          value={newUser.full_name}
          onChangeText={t => setNewUser({ ...newUser, full_name: t })}
          placeholder="John Doe"
          leftIcon="person-outline"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <AppTextInput
          ref={emailRef}
          label="Email Address"
          value={newUser.email}
          onChangeText={t => setNewUser({ ...newUser, email: t })}
          placeholder="email@example.com"
          leftIcon="mail-outline"
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <AppTextInput
          ref={passwordRef}
          label="Password"
          value={newUser.password}
          onChangeText={t => setNewUser({ ...newUser, password: t })}
          placeholder="Minimum 6 characters"
          leftIcon="lock-closed-outline"
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleCreateUser}
        />

        <Text style={styles.label}>Select Roles</Text>
        <View style={styles.roleContainer}>
          {ROLES.map((role) => {
            const isSelected = (newUser.roles || []).includes(role.value);
            const nextRoles = isSelected
              ? (newUser.roles || []).filter((r) => r !== role.value)
              : [...(newUser.roles || []), role.value];

            return (
              <TouchableOpacity
                key={role.value}
                style={[
                  styles.roleOption,
                  isSelected && {
                    backgroundColor: role.color,
                    borderColor: role.color,
                  }
                ]}
                onPress={() => setNewUser({ ...newUser, roles: nextRoles })}
              >
                <Text style={[
                  styles.roleOptionText,
                  isSelected && styles.roleOptionTextActive
                ]}>
                  {role.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </AppModal>

      {/* User Details Modal */}
      <AppModal
        visible={detailsModalVisible}
        onClose={() => { setDetailsModalVisible(false); setSelectedUser(null); }}
        title="User Details"
      >
        {selectedUser && (
          <View>
              {/* User Avatar Section */}
              <View style={styles.detailsAvatarSection}>
                <LinearGradient
                  colors={[getRoleColor(selectedUser.roles, selectedUser.role), getRoleColor(selectedUser.roles, selectedUser.role) + 'CC']}
                  style={styles.detailsAvatarGradient}
                >
                  <View style={styles.detailsAvatarInner}>
                    <Text style={[styles.detailsAvatarText, { color: getRoleColor(selectedUser.roles, selectedUser.role) }]}>
                      {selectedUser.full_name ? selectedUser.full_name[0].toUpperCase() : '?'}
                    </Text>
                  </View>
                </LinearGradient>
                <Text style={styles.detailsName}>{selectedUser.full_name}</Text>
                <View style={[styles.detailsRoleBadge, { backgroundColor: getRoleColor(selectedUser.roles, selectedUser.role) + '15' }]}>
                  <Text style={[styles.detailsRoleText, { color: getRoleColor(selectedUser.roles, selectedUser.role) }]}>
                    {getRoleLabel(selectedUser.roles, selectedUser.role)}
                  </Text>
                </View>
              </View>

              {/* User Info Cards */}
              <View style={styles.infoSection}>
                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <View style={[styles.infoIconContainer, { backgroundColor: colors.primary[50] }]}>
                      <Ionicons name="mail-outline" size={iconSizes.sm} color={colors.primary[600]} />
                    </View>
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>Email</Text>
                      <Text style={styles.infoValue} numberOfLines={1}>{selectedUser.email || 'N/A'}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <View style={[styles.infoIconContainer, { backgroundColor: colors.success[50] }]}>
                      <Ionicons name="calendar-outline" size={iconSizes.sm} color={colors.success[600]} />
                    </View>
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>Created</Text>
                      <Text style={styles.infoValue}>{formatDate(selectedUser.created_at)}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <View style={[styles.infoIconContainer, { backgroundColor: colors.warning[50] }]}>
                      <Ionicons name="log-in-outline" size={iconSizes.sm} color={colors.warning[600]} />
                    </View>
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>Last Active</Text>
                      <Text style={styles.infoValue}>{selectedUser.last_login ? formatDate(selectedUser.last_login) : 'Never'}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Roles Section */}
              <Text style={styles.sectionTitle}>Roles</Text>
              <View style={styles.roleEditContainer}>
                {ROLES.map((role, index) => {
                  const selectedRoles = normalizeRoles(selectedUser.roles, selectedUser.role);
                  const isSelected = selectedRoles.includes(role.value);
                  const nextRoles = isSelected
                    ? selectedRoles.filter((r) => r !== role.value)
                    : [...selectedRoles, role.value];
                  const canEdit = canModifyUser(selectedUser);

                  return (
                    <TouchableOpacity
                      key={role.value}
                      style={[
                        styles.roleEditOption,
                        isSelected && styles.roleEditOptionActive,
                        index === ROLES.length - 1 && { borderBottomWidth: 0 }
                      ]}
                      onPress={() => canEdit && handleUpdateRoles(nextRoles)}
                      disabled={updatingRole || !canEdit}
                      activeOpacity={canEdit ? 0.7 : 1}
                    >
                      <View style={styles.roleEditLeft}>
                        <View style={[styles.roleColorDot, { backgroundColor: role.color }]} />
                        <Text style={[
                          styles.roleEditText,
                          isSelected && styles.roleEditTextActive
                        ]}>
                          {role.label}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={iconSizes.md} color={colors.primary[600]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Change Password - only admin */}
              {isCurrentAdmin && (
                <>
                  <Text style={styles.sectionTitle}>Password</Text>
                  <TouchableOpacity
                    style={styles.passwordButton}
                    onPress={handleOpenPasswordModal}
                  >
                    <Ionicons name="key-outline" size={iconSizes.md} color={colors.primary[600]} />
                    <Text style={styles.passwordButtonText}>Change Password</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Enable/Disable - only admin, not self, not other admins */}
              {canModifyUser(selectedUser) && (
                <TouchableOpacity
                  style={[
                    styles.disableButton,
                    selectedUser.is_disabled && styles.enableButton,
                  ]}
                  onPress={handleToggleUserStatus}
                  disabled={updatingStatus}
                >
                  <Ionicons
                    name={selectedUser.is_disabled ? 'checkmark-circle-outline' : 'ban-outline'}
                    size={iconSizes.md}
                    color={selectedUser.is_disabled ? colors.success[600] : colors.error[600]}
                  />
                  <Text style={[
                    styles.disableButtonText,
                    selectedUser.is_disabled && styles.enableButtonText,
                  ]}>
                    {selectedUser.is_disabled ? 'Enable User' : 'Disable User'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Delete Button - only admin, not self, not other admins */}
              {canModifyUser(selectedUser) && (
                <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteUser}>
                  <Ionicons name="trash-outline" size={iconSizes.md} color={colors.error[600]} />
                  <Text style={styles.deleteButtonText}>Delete User</Text>
                </TouchableOpacity>
              )}
          </View>
        )}
      </AppModal>

      {/* Change Password Modal */}
      <AppModal
        visible={passwordModalVisible}
        onClose={() => setPasswordModalVisible(false)}
        title="Change Password"
        subtitle="Update password for selected user"
        footer={
          <AnimatedButton
            title="Update Password"
            onPress={handleUpdatePassword}
            icon={<Ionicons name="key-outline" size={iconSizes.md} color={colors.white} />}
            style={{ flex: 1 }}
          />
        }
      >
        <AppTextInput
          label="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="Minimum 6 characters"
          leftIcon="lock-closed-outline"
          secureTextEntry
          returnKeyType="next"
          onSubmitEditing={() => confirmPasswordRef.current?.focus()}
        />
        <AppTextInput
          ref={confirmPasswordRef}
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Re-enter password"
          leftIcon="lock-closed-outline"
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleUpdatePassword}
        />
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    marginTop: spacingSizes.sm,
    marginBottom: spacingSizes.xs,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: spacingSizes.md,
    height: 48,
    ...shadows.small,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacingSizes.sm,
    fontSize: textSizes.medium || 14,
    color: colors.neutral[900],
  },
  listContent: {
    paddingTop: spacingSizes.sm,
    gap: spacingSizes.sm,
  },
  userCard: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingVertical: spacingSizes.sm + 2,
    paddingHorizontal: spacingSizes.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    alignItems: 'center',
    gap: spacingSizes.md,
    ...shadows.small,
  },
  userCardDisabled: {
    opacity: 0.55,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
    gap: 3,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.xs,
  },
  roleDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
  },
  roleText: {
    flexShrink: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  disabledBadge: {
    paddingHorizontal: spacingSizes.sm,
    paddingVertical: 2,
    borderRadius: radii.xs,
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  fab: {
    position: 'absolute',
    right: 20,
    borderRadius: radii.pill,
    ...shadows.large,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: textSizes.small || 12,
    fontWeight: '600',
    color: colors.neutral[600],
    marginBottom: spacingSizes.xs,
    marginTop: spacingSizes.md,
    marginLeft: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacingSizes.xs,
    gap: spacingSizes.sm,
  },
  roleOption: {
    paddingHorizontal: spacingSizes.md,
    paddingVertical: spacingSizes.sm + 2,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    backgroundColor: colors.white,
  },
  roleOptionText: {
    color: colors.neutral[600],
    fontSize: textSizes.small || 12,
    fontWeight: '500',
  },
  roleOptionTextActive: {
    color: colors.white,
    fontWeight: 'bold',
  },
  // Details Modal
  detailsAvatarSection: {
    alignItems: 'center',
    marginBottom: spacingSizes.xl,
  },
  detailsAvatarGradient: {
    width: 90,
    height: 90,
    borderRadius: radii.xxl,
    padding: 3,
    marginBottom: spacingSizes.md,
  },
  detailsAvatarInner: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsAvatarText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  detailsName: {
    fontSize: textSizes.xlarge || 20,
    fontWeight: 'bold',
    color: colors.neutral[900],
    marginBottom: spacingSizes.xs,
  },
  detailsRoleBadge: {
    paddingHorizontal: spacingSizes.md,
    paddingVertical: spacingSizes.xs,
    borderRadius: radii.pill,
  },
  detailsRoleText: {
    fontSize: textSizes.small || 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoSection: {
    gap: spacingSizes.sm,
    marginBottom: spacingSizes.lg,
  },
  infoCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radii.md,
    padding: spacingSizes.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextContainer: {
    marginLeft: spacingSizes.md,
    flex: 1,
  },
  infoLabel: {
    fontSize: textSizes.tiny || 10,
    color: colors.neutral[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: textSizes.medium || 14,
    color: colors.neutral[800],
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: textSizes.small || 12,
    fontWeight: '700',
    color: colors.neutral[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacingSizes.sm,
    marginLeft: 4,
  },
  roleEditContainer: {
    backgroundColor: colors.neutral[50],
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  roleEditOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingSizes.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  roleEditOptionActive: {
    backgroundColor: colors.primary[50],
  },
  roleEditLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacingSizes.sm,
  },
  roleEditText: {
    fontSize: textSizes.medium || 14,
    color: colors.neutral[700],
    fontWeight: '500',
  },
  roleEditTextActive: {
    color: colors.primary[700],
    fontWeight: '600',
  },
  disableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.sm,
    padding: spacingSizes.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.error[200],
    backgroundColor: colors.error[50],
    marginTop: spacingSizes.md,
  },
  enableButton: {
    borderColor: colors.success[200],
    backgroundColor: colors.success[50],
  },
  disableButtonText: {
    fontSize: textSizes.medium || 14,
    fontWeight: '600',
    color: colors.error[700],
  },
  enableButtonText: {
    color: colors.success[700],
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error[50],
    borderRadius: radii.md,
    padding: spacingSizes.md,
    marginTop: spacingSizes.xl,
    marginBottom: spacingSizes.xl,
    borderWidth: 1,
    borderColor: colors.error[100],
  },
  deleteButtonText: {
    color: colors.error[600],
    fontSize: textSizes.medium || 14,
    fontWeight: '600',
    marginLeft: spacingSizes.sm,
  },
  passwordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.sm,
    padding: spacingSizes.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary[100],
    backgroundColor: colors.primary[50],
    marginBottom: spacingSizes.md,
  },
  passwordButtonText: {
    fontSize: textSizes.medium || 14,
    fontWeight: '600',
    color: colors.primary[700],
  },
});
