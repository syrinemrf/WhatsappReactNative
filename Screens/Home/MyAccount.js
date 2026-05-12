import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import firebase from '../../Config/index';
import { supabase } from '../../Config/index';

const auth = firebase.auth();
const database = firebase.database();
const ref_all_accounts = database.ref('allaccounts');

export default function MyAccount(props) {
  const userid = props.route.params.userid;
  const var_my_account = ref_all_accounts.child(userid);

  const [Nom, setNom] = useState('');
  const [Pseudo, setPseudo] = useState('');
  const [Email, setEmail] = useState('');
  const [Numero, setNumero] = useState('');
  const [UrlImage, setUrlImage] = useState(null);
  const [photoHistory, setPhotoHistory] = useState([]);
  const [showPhotoSource, setShowPhotoSource] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    // onAuthStateChanged guarantees we get the user even if auth initialized async
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) setEmail(user.email || '');
    });
    // Also try immediately in case already signed in
    if (auth.currentUser) setEmail(auth.currentUser.email || '');

    var_my_account.on('value', (snapshot) => {
      var data = snapshot.val();
      if (data) {
        setPseudo(data.Pseudo || '');
        setNumero(data.Numero || '');
        setNom(data.Nom || '');
        setUrlImage(data.UrlImage || null);
      }
    });

    // Load photo history
    var_my_account.child('photoHistory').on('value', (snapshot) => {
      const hist = [];
      snapshot.forEach((item) => {
        const val = item.val();
        // Support both old format (plain string) and new format ({url, savedAt})
        const url = typeof val === 'string' ? val : val?.url;
        const savedAt = typeof val === 'string' ? null : val?.savedAt;
        if (url) hist.push({ url, savedAt });
      });
      setPhotoHistory(hist.reverse());
    });

    return () => {
      unsubscribeAuth();
      var_my_account.off();
      var_my_account.child('photoHistory').off();
    };
  }, []);

  const uploadImageToSupabase = async (url) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const arraybuffer = await new Response(blob).arrayBuffer();
    const filenameInSupabase = Date.now() + '.jpg';
    await supabase.storage.from('Images').upload(filenameInSupabase, arraybuffer, { upsert: true });
    const { data } = supabase.storage.from('Images').getPublicUrl(filenameInSupabase);
    return data.publicUrl;
  };

  const pickFromGallery = async () => {
    setShowPhotoSource(false);
    await new Promise((r) => setTimeout(r, 600));
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission requise', 'Acces galerie necessaire.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled) setUrlImage(result.assets[0].uri);
    } catch (e) { Alert.alert('Erreur galerie', e.message); }
  };

  const pickFromCamera = async () => {
    setShowPhotoSource(false);
    await new Promise((r) => setTimeout(r, 600));
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission requise', 'Acces camera necessaire.'); return; }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled) setUrlImage(result.assets[0].uri);
    } catch (e) { Alert.alert('Erreur camera', e.message); }
  };

  const handleSave = async () => {
    try {
      let finalUrl = UrlImage;
      // Only upload if it's a new local file (not already a remote https URL)
      if (UrlImage && !UrlImage.startsWith('http')) {
        finalUrl = await uploadImageToSupabase(UrlImage);
        // Add new photo URL to history
        await var_my_account.child('photoHistory').push({
          url: finalUrl,
          savedAt: new Date().toISOString(),
        });
      }

      // Use update() NOT set() — set() would wipe photoHistory and other sub-nodes
      await var_my_account.update({
        Id: userid,
        Nom,
        Pseudo,
        Email,
        Numero,
        UrlImage: finalUrl || null,
      });

      try {
        props.navigation.navigate('ListAccount');
      } catch {
        props.navigation.replace('Home', { userid });
      }
    } catch (error) {
      Alert.alert('Erreur', error.message);
    }
  };

  const handleSignOut = async () => {
    await AsyncStorage.removeItem('rememberedUser');
    firebase.auth().signOut().then(() => props.navigation.replace('Auth'));
  };

  const handleDeleteAccount = () => {
    Alert.alert('Supprimer le compte', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('rememberedUser');
          var_my_account.remove();
          auth.currentUser?.delete();
          props.navigation.replace('Auth');
        },
      },
    ]);
  };

  return (
    <ImageBackground source={require('../../assets/backgroundreact.jpg')} style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Text style={styles.title}>Mon Compte</Text>

        {/* Avatar */}
        <TouchableOpacity onPress={() => setShowPhotoSource(true)} style={styles.avatarWrapper}>
          {UrlImage
            ? <Image source={{ uri: UrlImage }} style={styles.avatar} />
            : <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={54} color="#fff" />
              </View>
          }
          <View style={styles.editBadge}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.historyBtn}>
          <Text style={styles.historyBtnText}>🕓 Historique photos ({photoHistory.length})</Text>
        </TouchableOpacity>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.label}>Nom</Text>
          <TextInput value={Nom} onChangeText={setNom} placeholder="Votre nom" placeholderTextColor="#90A4AE" style={styles.input} />

          <Text style={styles.label}>Pseudo</Text>
          <TextInput value={Pseudo} onChangeText={setPseudo} placeholder="Votre pseudo" placeholderTextColor="#90A4AE" style={styles.input} />

          <Text style={styles.label}>Email (non modifiable)</Text>
          <View style={styles.inputLocked}>
            <Text style={styles.lockedText}>{Email || '—'}</Text>
            <Text style={{ fontSize: 14 }}>🔒</Text>
          </View>

          <Text style={styles.label}>Numéro</Text>
          <TextInput
            value={Numero}
            onChangeText={setNumero}
            placeholder="+216 XX XXX XXX"
            placeholderTextColor="#90A4AE"
            keyboardType="phone-pad"
            style={styles.input}
          />
        </View>

        <TouchableOpacity onPress={handleSave} style={styles.btnSave}>
          <Text style={styles.btnText}>Sauvegarder</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSignOut} style={styles.btnLogout}>
          <Text style={styles.btnText}>Se déconnecter</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleDeleteAccount} style={styles.btnDelete}>
          <Text style={styles.btnText}>Supprimer le compte</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Photo source chooser */}
      <Modal visible={showPhotoSource} transparent animationType="slide">
        <TouchableOpacity style={styles.modalBg} onPress={() => setShowPhotoSource(false)} activeOpacity={1}>
          <View style={styles.sourceSheet}>
            <Text style={styles.sourceTitle}>Choisir une photo</Text>
            <TouchableOpacity style={styles.sourceBtn} onPress={pickFromCamera}>
              <Text style={styles.sourceBtnText}>📷 Prendre une photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sourceBtn} onPress={pickFromGallery}>
              <Text style={styles.sourceBtnText}>🖼️ Galerie</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sourceBtn, { backgroundColor: '#eee' }]} onPress={() => setShowPhotoSource(false)}>
              <Text style={[styles.sourceBtnText, { color: '#555' }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Photo history modal */}
      <Modal visible={showHistory} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.historyCard}>
            <Text style={styles.sourceTitle}>Historique des photos</Text>
            {photoHistory.length === 0 ? (
              <Text style={{ color: '#90A4AE', marginTop: 12 }}>Aucune photo sauvegardée</Text>
            ) : (
              <ScrollView contentContainerStyle={styles.historyGrid}>
                {photoHistory.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      setUrlImage(item.url);
                      setShowHistory(false);
                    }}
                    style={{ alignItems: 'center', margin: 4 }}
                  >
                    <Image source={{ uri: item.url }} style={styles.historyThumb} />
                    {i === 0 && (
                      <View style={styles.currentBadge}>
                        <Text style={{ color: '#fff', fontSize: 10 }}>Récente</Text>
                      </View>
                    )}
                    {item.savedAt && (
                      <Text style={{ fontSize: 9, color: '#90A4AE', marginTop: 2, textAlign: 'center', maxWidth: 70 }}>
                        {new Date(item.savedAt).toLocaleDateString('fr-FR')}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.closeHistoryBtn} onPress={() => setShowHistory(false)}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    alignItems: 'center',
    paddingTop: 55,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#fff',
    textShadowColor: '#004D40',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 6,
    marginBottom: 20,
    letterSpacing: 1,
  },
  avatarWrapper: {
    marginBottom: 10,
    position: 'relative',
  },
  avatar: {
    height: 120,
    width: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#C9A84C',
  },
  avatarPlaceholder: {
    backgroundColor: '#00897B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#00897B',
    borderRadius: 18,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  editBadgeText: {
    fontSize: 16,
  },
  historyBtn: {
    marginBottom: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  historyBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#004D40',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00897B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F1FFFE',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#004D40',
    borderWidth: 1,
    borderColor: '#B2DFDB',
  },
  inputLocked: {
    backgroundColor: '#ECEFF1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#CFD8DC',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lockedText: {
    fontSize: 15,
    color: '#004D40',
    fontWeight: '500',
  },
  btnSave: {
    backgroundColor: '#00897B',
    borderRadius: 25,
    paddingVertical: 14,
    width: '80%',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  btnLogout: {
    backgroundColor: '#C9A84C',
    borderRadius: 25,
    paddingVertical: 14,
    width: '80%',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 3,
  },
  btnDelete: {
    backgroundColor: '#c0392b',
    borderRadius: 25,
    paddingVertical: 14,
    width: '80%',
    alignItems: 'center',
    elevation: 3,
  },
  btnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sourceSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 20,
    width: '100%',
  },
  sourceTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#004D40',
    textAlign: 'center',
    marginBottom: 16,
  },
  sourceBtn: {
    backgroundColor: '#E8F5E9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#B2DFDB',
  },
  sourceBtnText: {
    color: '#004D40',
    fontWeight: '700',
    fontSize: 16,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    width: '92%',
    alignItems: 'center',
    maxHeight: '75%',
  },
  historyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  historyThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    margin: 6,
    borderWidth: 2,
    borderColor: '#B2DFDB',
  },
  currentBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: '#00897B',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  closeHistoryBtn: {
    marginTop: 14,
    backgroundColor: '#00897B',
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 30,
  },
});

