import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ImageBackground, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import firebase from '../Config/index';
const auth = firebase.auth();

export default function Auth(props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    auth.signInWithEmailAndPassword(email, password)
      .then(() => {
        const userid = auth.currentUser.uid;
        props.navigation.navigate('Home', { userid });
      })
      .catch((error) => alert(error.message));
  };

  return (
    <ImageBackground source={require("../assets/backgroundreact.jpg")} style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.card}>
        <Text style={styles.title}>Bienvenue</Text>
        <Text style={styles.subtitle}>Connectez-vous pour continuer</Text>

        <TextInput
          onChangeText={setEmail}
          value={email}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#90A4AE"
        />
        <TextInput
          onChangeText={setPassword}
          value={password}
          secureTextEntry
          style={styles.input}
          placeholder="Mot de passe"
          placeholderTextColor="#90A4AE"
        />

        <TouchableOpacity onPress={handleLogin} style={styles.btnPrimary}>
          <Text style={styles.btnText}>Se connecter</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => props.navigation.navigate('SignUp')} style={styles.btnSecondary}>
          <Text style={styles.linkText}>Créer un compte</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    width: '88%',
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#004D40',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    borderTopWidth: 4,
    borderTopColor: '#C9A84C',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#004D40',
    marginBottom: 4,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#00897B',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#F1FFFE',
    marginBottom: 14,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#004D40',
    borderWidth: 1,
    borderColor: '#B2DFDB',
  },
  btnPrimary: {
    backgroundColor: '#00897B',
    width: '100%',
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  btnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  btnSecondary: {
    marginTop: 16,
    padding: 8,
  },
  linkText: {
    color: '#C9A84C',
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
