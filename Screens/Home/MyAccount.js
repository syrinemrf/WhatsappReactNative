import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import firebase from '../../Config/index';
import { supabase } from '../../Config/index';
const auth = firebase.auth();
const database = firebase.database();
const ref_all_accounts = database.ref("allaccounts");



export default function MyAccount(props) {
  const userid = props.route.params.userid;
  const var_my_account = ref_all_accounts.child(userid);
  const [Nom, setNom] = useState('');
  const [Pseudo, setPseudo] = useState('');
  const [Email, setEmail] = useState('');
  const [Numero, setNumero] = useState('');
  const [UrlImage, setUrlImage] = useState();

  useEffect(() => {
    var_my_account.on("value", (snapshot) => {
      var data = snapshot.val();
      if (data) {
        setPseudo(data.Pseudo);
        setNumero(data.Numero);
        setEmail(data.Email);
        setNom(data.Nom);
        setUrlImage(data.UrlImage);
      }
    });

    return () => {
      var_my_account.off();
    };
  }, []);

  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission required",
        "Permission to access the media library is required."
      );
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    console.log(result);

    if (!result.canceled) {
      setUrlImage(result.assets[0].uri);
    }
  };

  const uploadImageToSupabase = async (url) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const arraybuffer = await new Response(blob).arrayBuffer();

    const filenameInSupabase = Date.now() + ".jpg";

    await supabase.storage
      .from("Images")
      .upload(filenameInSupabase, arraybuffer, {
        upsert: true,
      });

    const { data } = supabase.storage
      .from("Images")
      .getPublicUrl(filenameInSupabase);
    console.log(data);
    return data.publicUrl;
  };

  const handleSave = async () => {
    const link = UrlImage
      ? await uploadImageToSupabase(UrlImage)
      : null;

    const ref_one_account = ref_all_accounts.child(userid);
    ref_one_account
      .set({
        Id: userid,
        Nom,
        Pseudo,
        Email,
        Numero,
        UrlImage: link,
      })
      .then(() => {
        console.log("Compte ajouté !");
        props.navigation.navigate("ListAccount");
      })
      .catch((error) => {
        console.log(error);
      });
  };

  return (
    <ImageBackground
      source={require("../../assets/backgroundreact.jpg")}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Text style={styles.title}>Mon Compte</Text>

        <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
          <Image
            source={UrlImage ? { uri: UrlImage } : require("../../assets/profil.png")}
            style={styles.avatar}
          />
          <View style={styles.editBadge}>
            <Text style={styles.editBadgeText}>✎</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.label}>Nom</Text>
          <TextInput
            value={Nom}
            onChangeText={setNom}
            placeholder="Votre nom"
            placeholderTextColor="#90A4AE"
            style={styles.input}
          />
          <Text style={styles.label}>Pseudo</Text>
          <TextInput
            value={Pseudo}
            onChangeText={setPseudo}
            placeholder="Votre pseudo"
            placeholderTextColor="#90A4AE"
            style={styles.input}
          />
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={Email}
            onChangeText={setEmail}
            placeholder="email@exemple.com"
            placeholderTextColor="#90A4AE"
            keyboardType="email-address"
            style={styles.input}
          />
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

        <TouchableOpacity
          onPress={() => auth.signOut().then(() => props.navigation.replace('Auth'))}
          style={styles.btnLogout}
        >
          <Text style={styles.btnText}>Se déconnecter</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            Alert.alert('Supprimer le compte', 'Cette action est irréversible.', [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Supprimer', style: 'destructive',
                onPress: () => {
                  ref_all_accounts.child(userid).remove();
                  auth.currentUser?.delete();
                  props.navigation.replace('Auth');
                }
              }
            ]);
          }}
          style={styles.btnDelete}
        >
          <Text style={styles.btnText}>Supprimer le compte</Text>
        </TouchableOpacity>

      </ScrollView>
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
    marginBottom: 24,
    position: 'relative',
  },
  avatar: {
    height: 120,
    width: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#C9A84C',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#C9A84C',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
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
});