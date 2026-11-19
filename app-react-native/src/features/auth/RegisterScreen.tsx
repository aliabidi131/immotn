import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing } from '../../core/theme';
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from '../../core/validators';
import {
  ErrorText,
  FormInput,
  LinkButton,
  PrimaryButton,
} from '../../core/ui';
import { authErrorMessage } from '../../data/authService';
import { useAuthStore } from './authStore';
import type { AuthStackParamList } from './types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const register = useAuthStore(state => state.register);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const validation =
      validateEmail(email) ??
      validatePassword(password) ??
      validatePasswordConfirmation(password, confirmation);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Le compte et le profil users/{uid} sont créés ; la redirection est automatique.
      await register(email, password);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inscription</Text>
      <FormInput
        placeholder="Email"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />
      <FormInput
        placeholder="Mot de passe"
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
      />
      <FormInput
        placeholder="Confirmer le mot de passe"
        secureTextEntry
        autoComplete="new-password"
        value={confirmation}
        onChangeText={setConfirmation}
      />
      <ErrorText message={error} />
      <PrimaryButton title="Créer mon compte" onPress={submit} loading={loading} />
      <LinkButton
        title="J'ai déjà un compte"
        onPress={() => navigation.navigate('Login')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
});
