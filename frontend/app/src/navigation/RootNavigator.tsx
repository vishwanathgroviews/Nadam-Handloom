import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import MpinLoginScreen from '../screens/MpinLoginScreen';
import ActivateAccountScreen from '../screens/ActivateAccountScreen';
import OtpScreen from '../screens/OtpScreen';
import MpinSetupScreen from '../screens/MpinSetupScreen';
import MpinForgotScreen from '../screens/MpinForgotScreen';
import MpinResetScreen from '../screens/MpinResetScreen';
import AdminHomeScreen from '../screens/AdminHomeScreen';
import StaffHomeScreen from '../screens/StaffHomeScreen';
import AdminOrdersScreen from '../screens/AdminOrdersScreen';
import OrderShipmentScreen from '../screens/OrderShipmentScreen';
import CategoryListScreen from '../screens/CategoryListScreen';
import CategoryFormScreen from '../screens/CategoryFormScreen';
import SubcategoryListScreen from '../screens/SubcategoryListScreen';
import SubcategoryFormScreen from '../screens/SubcategoryFormScreen';
import SubcategoryCatalogScreen from '../screens/SubcategoryCatalogScreen';
import ProductListScreen from '../screens/ProductListScreen';
import ProductFormScreen from '../screens/ProductFormScreen';
import ScannerScreen from '../screens/ScannerScreen';
import InventoryScreen from '../screens/InventoryScreen';
import ReceiveStockScreen from '../screens/ReceiveStockScreen';
import StaffListScreen from '../screens/StaffListScreen';
import StaffInviteScreen from '../screens/StaffInviteScreen';
import AuditLogScreen from '../screens/AuditLogScreen';
import SessionsScreen from '../screens/SessionsScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import InvoiceDetailScreen from '../screens/InvoiceDetailScreen';
import TabBar from '../components/TabBar';
import { colors } from '../utils/theme';
import type { TrackingMode } from '../api/catalog';

export type AuthStackParamList = {
  MpinLogin: undefined;
  Activate: undefined;
  // devOtp is only ever set by the backend in dev (SMS_PROVIDER=console) —
  // see otp.service.ts's devOtpEcho. It's undefined once a real SMS gateway
  // is configured, and the hint UI simply stops appearing.
  Otp: { mobile: string; devOtp?: string };
  MpinSetup: { setupToken: string };
  MpinForgot: undefined;
  MpinReset: { mobile: string; devOtp?: string };
};

export type AppStackParamList = {
  Home: undefined;
  Orders: undefined;
  OrderShipment: { orderId: string };
  Categories: undefined;
  CategoryForm: { categoryId?: string };
  SubcategoryList: { categoryId: string; categoryName?: string };
  SubcategoryForm: { categoryId: string; subcategoryId?: string };
  SubcategoryCatalog: { subcategoryId: string; subcategoryName?: string };
  Products: undefined;
  ProductForm: { productId?: string; initialBarcode?: string };
  Scanner: undefined;
  Inventory: undefined;
  ReceiveStock: { productId: string; productName?: string; trackingMode?: TrackingMode };
  StaffList: undefined;
  StaffInvite: undefined;
  AuditLog: undefined;
  Sessions: undefined;
  Analytics: undefined;
  Invoices: undefined;
  InvoiceDetail: { invoiceId: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

type RootTabParamList = {
  HomeTab: undefined;
  OrdersTab: undefined;
  ScannerTab: undefined;
  ProductsTab: undefined;
  ProfileTab: undefined;
};
const Tab = createBottomTabNavigator<RootTabParamList>();

function HomeRouter(props: NativeStackScreenProps<AppStackParamList, 'Home'>) {
  const { role } = useAuth();
  return role === 'ADMIN' ? <AdminHomeScreen {...props} /> : <StaffHomeScreen {...props} />;
}

// Only the app's root entry point becomes a tab container — every other
// screen (Orders, Categories, Products, Scanner as a deep link from the Home
// menu, etc.) stays a sibling in the outer AppStack exactly as before, so no
// existing `navigation.navigate('X')` call anywhere in the app needs to
// change. Scanner/Orders are deliberately reachable both as a tab (quick
// access, used all day) and via the Home menu (unchanged) — React
// Navigation resolves either path correctly since both point at the same
// underlying screens. Icons/labels for these tabs are owned by TabBar, not
// this screenOptions block.
function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tab.Screen name="HomeTab" options={{ title: 'Home' }}>
        {(tabProps) => <HomeRouter {...(tabProps as any)} />}
      </Tab.Screen>
      <Tab.Screen name="OrdersTab" options={{ title: 'Orders' }}>
        {(tabProps) => <AdminOrdersScreen {...(tabProps as any)} />}
      </Tab.Screen>
      <Tab.Screen name="ScannerTab" options={{ title: 'Scan' }}>
        {(tabProps) => <ScannerScreen {...(tabProps as any)} />}
      </Tab.Screen>
      <Tab.Screen name="ProductsTab" options={{ title: 'Products' }}>
        {(tabProps) => <ProductListScreen {...(tabProps as any)} />}
      </Tab.Screen>
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'More' }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {status === 'authenticated' ? (
        <AppStack.Navigator screenOptions={{ headerShown: false }}>
          <AppStack.Screen name="Home" component={RootTabs} />
          <AppStack.Screen name="Orders" component={AdminOrdersScreen} />
          <AppStack.Screen name="OrderShipment" component={OrderShipmentScreen} />
          <AppStack.Screen name="Categories" component={CategoryListScreen} />
          <AppStack.Screen name="CategoryForm" component={CategoryFormScreen} />
          <AppStack.Screen name="SubcategoryList" component={SubcategoryListScreen} />
          <AppStack.Screen name="SubcategoryForm" component={SubcategoryFormScreen} />
          <AppStack.Screen name="SubcategoryCatalog" component={SubcategoryCatalogScreen} />
          <AppStack.Screen name="Products" component={ProductListScreen} />
          <AppStack.Screen name="ProductForm" component={ProductFormScreen} />
          <AppStack.Screen name="Scanner" component={ScannerScreen} />
          <AppStack.Screen name="Inventory" component={InventoryScreen} />
          <AppStack.Screen name="ReceiveStock" component={ReceiveStockScreen} options={{ presentation: 'modal' }} />
          <AppStack.Screen name="StaffList" component={StaffListScreen} />
          <AppStack.Screen name="StaffInvite" component={StaffInviteScreen} />
          <AppStack.Screen name="AuditLog" component={AuditLogScreen} />
          <AppStack.Screen name="Sessions" component={SessionsScreen} />
          <AppStack.Screen name="Analytics" component={AnalyticsScreen} />
          <AppStack.Screen name="Invoices" component={InvoicesScreen} />
          <AppStack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="MpinLogin" component={MpinLoginScreen} />
          <AuthStack.Screen name="Activate" component={ActivateAccountScreen} />
          <AuthStack.Screen name="Otp" component={OtpScreen} />
          <AuthStack.Screen name="MpinSetup" component={MpinSetupScreen} />
          <AuthStack.Screen name="MpinForgot" component={MpinForgotScreen} />
          <AuthStack.Screen name="MpinReset" component={MpinResetScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
