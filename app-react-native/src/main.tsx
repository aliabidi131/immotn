import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from './core/theme';
import { useAuthStore } from './features/auth/authStore';
import LoginScreen from './features/auth/LoginScreen';
import RegisterScreen from './features/auth/RegisterScreen';
import ResetPasswordScreen from './features/auth/ResetPasswordScreen';
import FavoritesScreen from './features/favorites/FavoritesScreen';
import { useFavoritesStore } from './features/favorites/favoritesStore';
import AllListingsScreen from './features/listings/AllListingsScreen';
import CreateListingScreen from './features/listings/CreateListingScreen';
import EditListingScreen from './features/listings/EditListingScreen';
import HomeScreen from './features/listings/HomeScreen';
import ListingDetailScreen from './features/listings/ListingDetailScreen';
import type {
  AppStackParamList,
  HomeTabParamList,
} from './features/listings/navigationTypes';
import MapScreen from './features/map/MapScreen';
import ChatScreen from './features/messages/ChatScreen';
import MessagesScreen from './features/messages/MessagesScreen';
import NotificationsScreen from './features/messages/NotificationsScreen';
import ProfileScreen from './features/profile/ProfileScreen';

const AppStack = createNativeStackNavigator<AppStackParamList>();
const HomeTabs = createBottomTabNavigator<HomeTabParamList>();

const navigationRef = createNavigationContainerRef<AppStackParamList>();

// Écrans d'authentification empilés à la demande (requireSignIn côté Flutter).
const AUTH_ROUTES = ['Login', 'Register', 'ResetPassword'];

function tabIcon(icon: string) {
  return function TabIcon() {
    return <Text style={styles.tabIcon}>{icon}</Text>;
  };
}

// Six sections, comme l'application Flutter : Annonces, Carte, Favoris,
// Publier, Messages, Profil. Les onglets qui exigent un compte affichent
// eux-mêmes un écran invité (GuestGate).
function HomeTabsNavigator() {
  return (
    <HomeTabs.Navigator>
      <HomeTabs.Screen
        name="Accueil"
        component={HomeScreen}
        options={{ title: 'Annonces', tabBarIcon: tabIcon('🏠') }}
      />
      <HomeTabs.Screen
        name="Carte"
        component={MapScreen}
        options={{ title: 'Carte', tabBarIcon: tabIcon('🗺️') }}
      />
      <HomeTabs.Screen
        name="Favoris"
        component={FavoritesScreen}
        options={{ title: 'Favoris', tabBarIcon: tabIcon('♥') }}
      />
      <HomeTabs.Screen
        name="Publication"
        component={CreateListingScreen}
        options={{ title: 'Publier', tabBarIcon: tabIcon('➕') }}
      />
      <HomeTabs.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ title: 'Messages', tabBarIcon: tabIcon('💬') }}
      />
      <HomeTabs.Screen
        name="Profil"
        component={ProfileScreen}
        options={{ title: 'Profil', tabBarIcon: tabIcon('👤') }}
      />
    </HomeTabs.Navigator>
  );
}

// Gestion de session : le Marketplace est accessible sans compte ; la
// connexion s'ouvre à la demande et l'application revient aux onglets dès
// que la session est établie.
export default function Main() {
  const initializing = useAuthStore(state => state.initializing);
  const uid = useAuthStore(state => state.uid);
  const start = useAuthStore(state => state.start);
  const loadFavorites = useFavoritesStore(state => state.loadFavorites);

  useEffect(() => start(), [start]);

  // Favoris en temps réel de l'utilisateur connecté (vidés à la déconnexion).
  useEffect(() => loadFavorites(), [uid, loadFavorites]);

  // Une fois connecté, quitte les écrans de connexion / inscription.
  useEffect(() => {
    if (!uid || !navigationRef.isReady()) {
      return;
    }
    const current = navigationRef.getCurrentRoute()?.name;
    if (current && AUTH_ROUTES.includes(current)) {
      navigationRef.resetRoot({ index: 0, routes: [{ name: 'Tabs' }] });
    }
  }, [uid]);

  if (initializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar barStyle="dark-content" />
      <AppStack.Navigator>
        <AppStack.Screen
          name="Tabs"
          component={HomeTabsNavigator}
          options={{ headerShown: false }}
        />
        <AppStack.Screen
          name="ListingDetail"
          component={ListingDetailScreen}
          options={{ title: 'Détail de l’annonce' }}
        />
        <AppStack.Screen
          name="EditListing"
          component={EditListingScreen}
          options={{ title: 'Modifier l’annonce' }}
        />
        <AppStack.Screen
          name="AllListings"
          component={AllListingsScreen}
          options={{ title: 'Toutes les annonces' }}
        />
        <AppStack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ title: 'Conversation' }}
        />
        <AppStack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: 'Notifications' }}
        />
        <AppStack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: '', headerShadowVisible: false }}
        />
        <AppStack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ title: '', headerShadowVisible: false }}
        />
        <AppStack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{ title: '', headerShadowVisible: false }}
        />
      </AppStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  tabIcon: { fontSize: 18 },
});
