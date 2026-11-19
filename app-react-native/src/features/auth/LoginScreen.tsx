import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing } from '../../core/theme';
import { validateEmail, validatePassword } from '../../core/validators';
import {
  ErrorText,
  FormInput,
  LinkButton,
  PrimaryButton,
} from '../../core/ui';
import { authErrorMessage } from '../../data/authService';
import { useAuthStore } from './authStore';
import type { AuthStackParamList } from './types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const login = useAuthStore(state => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const validation = validateEmail(email) ?? validatePassword(password);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // La redirection vers l'application se fait automatiquement (état de session).
      await login(email, password);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connexion</Text>
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
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />
      <ErrorText message={error} />
      <PrimaryButton title="Se connecter" onPress={submit} loading={loading} />
      <LinkButton
        title="Mot de passe oublié ?"
        onPress={() => navigation.navigate('ResetPassword')}
      />
      <LinkButton
        title="Créer un compte"
        onPress={() => navigation.navigate('Register')}
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
