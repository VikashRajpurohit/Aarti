import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { textSizes, spacingSizes, iconSizes, shadows } from '../theme/responsive';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { backupService } from '../services/backupService';
import { logService } from '../services/logService';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';

const ROLE_LABELS = {
  admin: 'Admin',
  general_manager: 'General Manager',
  sales_manager: 'Sales Manager',
  purchase_manager: 'Purchase Manager',
  production_manager: 'Production Manager',
};

const ROLE_PRIORITY = ['admin', 'general_manager', 'sales_manager', 'purchase_manager', 'production_manager'];

const normalizeRoles = (roles, fallbackRole) => {
  if (Array.isArray(roles) && roles.length > 0) return roles;
  if (fallbackRole) return [fallbackRole];
  return [];
};

const getPrimaryRole = (roles, fallbackRole) => {
  const roleList = normalizeRoles(roles, fallbackRole);
  for (const role of ROLE_PRIORITY) {
    if (roleList.includes(role)) return role;
  }
  return roleList[0] || null;
};

const getRoleLabels = (roles, fallbackRole) => {
  const roleList = normalizeRoles(roles, fallbackRole);
  if (roleList.length === 0) return 'User';
  return roleList.map((role) => ROLE_LABELS[role] || role).join(', ');
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

const getRoleGradient = (roles, fallbackRole) => {
  const role = getPrimaryRole(roles, fallbackRole);
  switch(role) {
    case 'admin': return [colors.error[400], colors.error[600]];
    case 'general_manager': return [colors.primary[400], colors.primary[600]];
    case 'sales_manager': return [colors.success[400], colors.success[600]];
    case 'purchase_manager': return [colors.warning[400], colors.warning[600]];
    case 'production_manager': return [colors.secondary[400], colors.secondary[600]];
    default: return [colors.neutral[400], colors.neutral[600]];
  }
};

const SettingsItem = ({ icon, label, value, onPress, showArrow = true, rightComponent }) => (
  <TouchableOpacity 
    style={styles.settingsItem} 
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
    disabled={!onPress}
    accessibilityLabel={label + (value ? `, ${value}` : '')}
    accessibilityRole={onPress ? 'button' : 'text'}
  >
    <View style={styles.settingsItemLeft}>
      <View style={[styles.settingsIconContainer, { backgroundColor: colors.primary[50] }]}>
        <Ionicons name={icon} size={20} color={colors.primary[600]} />
      </View>
      <Text style={styles.settingsItemLabel}>{label}</Text>
    </View>
    <View style={styles.settingsItemRight}>
      {value && <Text style={styles.settingsItemValue}>{value}</Text>}
      {rightComponent}
      {showArrow && !rightComponent && (
        <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
      )}
    </View>
  </TouchableOpacity>
);

const SectionHeader = ({ title }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

export default function ProfileScreen({ refreshSignal }) {
  const { user, role, roles, fullName, logout, refreshProfile } = useAuth();
  const { horizontalPadding, scrollBottomPadding, contentMaxWidth } = useResponsiveLayout();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const isAdmin = roles?.includes('admin') || role === 'admin';

  useRefreshOnFocus(() => {
    refreshProfile?.();
  }, [refreshProfile], 'profile', refreshSignal);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: logout
        }
      ]
    );
  };

  const displayName = fullName || (user?.email ? user.email.split('@')[0] : 'User');

  const handlePrivacyPolicy = () => {
    Alert.alert('Privacy Policy', 'Privacy policy will be available soon.');
  };

  const handleTermsOfService = () => {
    Alert.alert('Terms of Service', 'Terms of service will be available soon.');
  };

  const handleSupport = () => {
    Alert.alert('Support', 'For support, please contact: support@aartipolymers.com');
  };

  const handleBackup = () => {
    if (backupLoading) return;
    Alert.alert(
      'Download Backup',
      'This will download a ZIP backup of all application data to share or store safely.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: async () => {
            try {
              setBackupLoading(true);
              const result = await backupService.downloadBackup();
              await logService.logEvent({
                action: 'backup.create',
                entityType: 'backup',
                metadata: {
                  file_name: result.fileName,
                  file_size_kb: result.fileSizeKb,
                },
              });
              Alert.alert('Backup Ready', 'Backup downloaded and ready to share.');
            } catch (error) {
              Alert.alert('Backup Failed', error?.message || 'Unable to download backup.');
            } finally {
              setBackupLoading(false);
            }
          },
        },
      ]
    );
  };

  const appVersion = Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';

  return (
    <View style={styles.container}>
      <ScreenHeader title="Profile" icon="person-circle-outline" />

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: scrollBottomPadding,
            maxWidth: contentMaxWidth,
            alignSelf: 'center',
            width: '100%',
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Avatar */}
          <LinearGradient
            colors={getRoleGradient(roles, role)}
            style={styles.avatarGradient}
          >
            <View style={styles.avatarInner}>
              <Text style={styles.avatarText}>
                {user?.email ? user.email[0].toUpperCase() : '?'}
              </Text>
            </View>
          </LinearGradient>

          {/* User Info */}
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.email || 'No email'}
            </Text>
            <View style={[styles.roleBadge, { backgroundColor: getRoleColor(roles, role) + '15' }]}>
              <Ionicons name="shield-checkmark" size={iconSizes.xs} color={getRoleColor(roles, role)} />
              <Text style={[styles.roleText, { color: getRoleColor(roles, role) }]}>
                {getRoleLabels(roles, role)}
              </Text>
            </View>
          </View>
        </View>

        {/* Account Section */}
        <SectionHeader title="ACCOUNT" />
        <View style={styles.settingsCard}>
          <SettingsItem 
            icon="person-outline" 
            label="Name" 
            value={displayName} 
            showArrow={false}
          />
          <View style={styles.divider} />
        </View>

        {/* Preferences Section */}
        <SectionHeader title="PREFERENCES" />
        <View style={styles.settingsCard}>
          <SettingsItem 
            icon="notifications-outline" 
            label="Push Notifications" 
            showArrow={false}
            rightComponent={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: colors.neutral[300], true: colors.primary[200] }}
                thumbColor={notificationsEnabled ? colors.primary[600] : colors.neutral[100]}
              />
            }
          />
        </View>

        {/* About Section */}
        <SectionHeader title="ABOUT" />
        <View style={styles.settingsCard}>
          <SettingsItem 
            icon="information-circle-outline" 
            label="App Version" 
            value={appVersion}
            showArrow={false}
          />
          <View style={styles.divider} />
          <SettingsItem 
            icon="headset-outline" 
            label="Support" 
            onPress={handleSupport}
          />
        </View>

        {isAdmin && (
          <>
            <SectionHeader title="ADMIN TOOLS" />
            <View style={styles.settingsCard}>
              <SettingsItem
                icon="archive-outline"
                label="Download Backup"
                onPress={handleBackup}
                showArrow={!backupLoading}
                rightComponent={
                  backupLoading ? <ActivityIndicator size="small" color={colors.primary[600]} /> : null
                }
              />
            </View>
          </>
        )}

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          accessibilityLabel="Logout"
          accessibilityRole="button"
        >
          <LinearGradient
            colors={[colors.error[50], colors.error[100]]}
            style={styles.logoutGradient}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.error[600]} />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2026 Aarti Polymers</Text>
          <Text style={styles.footerSubtext}>Made by R.V.G</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacingSizes.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.medium,
  },
  avatarGradient: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    padding: 3,
  },
  avatarInner: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary[600],
  },
  userInfo: {
    flex: 1,
    marginLeft: spacingSizes.md,
  },
  userName: {
    fontSize: textSizes.large || 18,
    fontWeight: 'bold',
    color: colors.neutral[900],
    textTransform: 'capitalize',
  },
  userEmail: {
    fontSize: textSizes.small || 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacingSizes.sm,
    paddingVertical: spacingSizes.xs,
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
    marginTop: spacingSizes.xs,
  },
  roleText: {
    fontSize: textSizes.tiny || 10,
    fontWeight: '600',
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacingSizes.lg,
  },
  sectionHeader: {
    fontSize: textSizes.tiny || 10,
    fontWeight: '700',
    color: colors.neutral[400],
    letterSpacing: 1,
    marginTop: spacingSizes.lg,
    marginBottom: spacingSizes.sm,
    marginLeft: 4,
  },
  settingsCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    ...shadows.small,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacingSizes.md,
    paddingHorizontal: spacingSizes.md,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacingSizes.md,
  },
  settingsItemLabel: {
    fontSize: textSizes.medium || 14,
    color: colors.neutral[800],
    fontWeight: '500',
  },
  settingsItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsItemValue: {
    fontSize: textSizes.small || 12,
    color: colors.neutral[400],
    marginRight: spacingSizes.xs,
    maxWidth: 120,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginLeft: 60,
  },
  logoutButton: {
    marginTop: spacingSizes.xl,
    borderRadius: 16,
    overflow: 'hidden',
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacingSizes.md + 2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  logoutButtonText: {
    color: colors.error[600],
    fontSize: textSizes.medium || 14,
    fontWeight: '600',
    marginLeft: spacingSizes.sm,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacingSizes.xl,
    paddingBottom: spacingSizes.lg,
  },
  footerText: {
    fontSize: textSizes.tiny || 10,
    color: colors.neutral[400],
  },
  footerSubtext: {
    fontSize: textSizes.tiny || 10,
    color: colors.neutral[300],
    marginTop: 4,
  },
});
