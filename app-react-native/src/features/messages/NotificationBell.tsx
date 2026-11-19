import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../core/theme';
import { useAppNavigation } from '../../core/components';
import { watchUnreadCount } from '../../data/messagingService';
import { useAuthStore } from '../auth/authStore';

// Cloche de l'en-tête avec compteur de notifications non lues (NotificationBell Flutter).
export default function NotificationBell() {
  const navigation = useAppNavigation();
  const uid = useAuthStore(state => state.uid);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) {
      setCount(0);
      return undefined;
    }
    return watchUnreadCount(uid, setCount);
  }, [uid]);

  const onPress = () => {
    if (!uid) {
      Alert.alert(
        'Connexion requise',
        'Connectez-vous pour voir vos notifications.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => navigation.navigate('Login') },
        ],
      );
      return;
    }
    navigation.navigate('Notifications');
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Notifications"
      hitSlop={8}
      onPress={onPress}
      style={styles.button}>
      <Text style={styles.icon}>🔔</Text>
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { padding: 6 },
  icon: { fontSize: 20 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.background, fontSize: 10, fontWeight: '700' },
});
