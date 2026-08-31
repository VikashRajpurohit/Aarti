import 'react-native-gesture-handler';
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import ScannerScreen from "./src/screens/ScannerScreen";
import ChallanScreen from "./src/screens/ChallanScreen";
import ChallanManagementScreen from "./src/screens/ChallanManagementScreen";
import LoginScreen from "./src/screens/LoginScreen";
import AdminUsersScreen from "./src/screens/AdminUsersScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import SplashScreen from "./src/screens/SplashScreen";
import LogsScreen from "./src/screens/LogsScreen";
import InquiriesScreen from "./src/screens/InquiriesScreen";
import PowerScreen from "./src/screens/PowerScreen";
import ProductionScreen from "./src/screens/ProductionScreen";
import ProductionOutputScreen from "./src/screens/ProductionOutputScreen";
import ReportsScreen from "./src/screens/ReportsScreen";
import PurchasesScreen from "./src/screens/PurchasesScreen";
import TabGroupScreen from "./src/components/TabGroupScreen";
import ErrorBoundary from "./src/components/ErrorBoundary";

import { ChallanProvider } from "./src/context/ChallanContext";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { RefreshBusProvider } from "./src/context/RefreshBusContext";
import { trackAppOpen } from "./src/services/analyticsService";
import { TAB_KEYS, getVisibleGroupsForRoles } from "./src/config/roleTabs";
import { supabase } from "./src/config/supabase";
import { NavProvider } from "./src/context/NavContext";
import BottomNav from "./src/components/BottomNav";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Map of TAB_KEY → Screen component
const SCREEN_MAP = {
  [TAB_KEYS.SCANNER]: ScannerScreen,
  [TAB_KEYS.CHALLAN]: ChallanScreen,
  [TAB_KEYS.CHALLAN_MANAGEMENT]: ChallanManagementScreen,
  [TAB_KEYS.USERS]: AdminUsersScreen,
  [TAB_KEYS.LOGS]: LogsScreen,
  [TAB_KEYS.INQUIRIES]: InquiriesScreen,
  [TAB_KEYS.POWER]: PowerScreen,
  [TAB_KEYS.PRODUCTION]: ProductionScreen,
  [TAB_KEYS.PRODUCTION_OUTPUT]: ProductionOutputScreen,
  [TAB_KEYS.PURCHASES]: PurchasesScreen,
  [TAB_KEYS.REPORTS]: ReportsScreen,
  [TAB_KEYS.PROFILE]: ProfileScreen,
};

function MainTabNavigator() {
  const { roles } = useAuth();
  const isAdmin = roles?.includes('admin');
  const [pendingInquiries, setPendingInquiries] = useState(0);

  const fetchPendingInquiries = useCallback(async () => {
    if (!isAdmin) {
      setPendingInquiries(0);
      return;
    }
    const { count, error } = await supabase
      .from('website_inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new');
    if (!error) {
      setPendingInquiries(count || 0);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchPendingInquiries();
    if (!isAdmin) return;

    const channel = supabase
      .channel('inquiries-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'website_inquiries' },
        () => {
          fetchPendingInquiries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPendingInquiries, isAdmin]);

  const visibleGroups = useMemo(() => getVisibleGroupsForRoles(roles), [roles]);

  return (
    <NavProvider>
      <Tab.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <BottomNav
            {...props}
            groups={visibleGroups}
            pendingInquiries={pendingInquiries}
          />
        )}
      >
        {visibleGroups.map((group) => (
          <Tab.Screen key={group.key} name={group.key}>
            {() => (
              <TabGroupScreen
                groupKey={group.key}
                subTabs={group.subTabs}
                screens={SCREEN_MAP}
              />
            )}
          </Tab.Screen>
        ))}
      </Tab.Navigator>
    </NavProvider>
  );
}


function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 200,
      }}
    >
      {!user ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{
            animationTypeForReplace: 'pop',
          }}
        />
      ) : (
        <Stack.Screen
          name="MainApp"
          component={MainTabNavigator}
        />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    trackAppOpen();
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <RefreshBusProvider>
          <AuthProvider>
            <ChallanProvider>
              <NavigationContainer>
                <StatusBar style="dark" />
                <RootNavigator />
              </NavigationContainer>
            </ChallanProvider>
          </AuthProvider>
        </RefreshBusProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
