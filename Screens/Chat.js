import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import firebase from '../Config/index';
import { supabase } from '../Config/index';

const database = firebase.database();
const ref_all_messages = database.ref('AllMessages');

export default function Chat(props) {
  const currentid = props.route.params.currentid;
  const secondid = props.route.params.secondid;

  const [data, setData] = useState([]);
  const [message, setMessage] = useState('');
  const [secondistyping, setSecondistyping] = useState(false);
  const [imageToSend, setImageToSend] = useState();

  const iddiscussion =
    currentid > secondid
      ? currentid + secondid
      : secondid + currentid;

  const ref_discussion = ref_all_messages.child(iddiscussion);
  const ref_chat = ref_discussion.child('chat');
  const ref_second_istyping = ref_discussion.child(secondid + 'istyping');

  useEffect(() => {
    ref_chat.on('value', (snapshot) => {
      const d = [];
      snapshot.forEach((one_msg) => {
        d.push(one_msg.val());
      });
      setData(d);
    });

    ref_second_istyping.on('value', (snapshot) => {
      setSecondistyping(snapshot.val());
    });

    return () => {
      ref_chat.off();
      ref_second_istyping.off();
    };
  }, []);

  const uploadImageToSupabase = async (url) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const arraybuffer = await new Response(blob).arrayBuffer();

    const filenameInSupabase = Date.now() + '.jpg';

    await supabase.storage
      .from('Images')
      .upload(filenameInSupabase, arraybuffer, {
        upsert: true,
      });

    const { data } = supabase.storage
      .from('Images')
      .getPublicUrl(filenameInSupabase);

    console.log(data);
    return data.publicUrl;
  };

  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        'Permission required',
        'Permission to access the media library is required.'
      );
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    console.log(result);

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setImageToSend(uri);
      const link = await uploadImageToSupabase(uri);
      setMessage(link);
    }
  };

  return (
    <ImageBackground
      style={styles.container}
      source={require('../assets/backgroundreact.jpg')}
    >
      <Text style={styles.title}>Chat</Text>

      <FlatList
        data={data}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => {
          const isSender = currentid === item.idsender;
          return (
            <View style={[styles.messageWrapper, isSender ? styles.senderWrapper : styles.receiverWrapper]}>
              <View style={[styles.bubble, isSender ? styles.senderBubble : styles.receiverBubble]}>
                {item.type == 'image' ? (
                  <Image
                    source={{ uri: item.message }}
                    style={{ width: 200, height: 200, borderRadius: 10, marginBottom: 4 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.messageText}>{item.message}</Text>
                )}
                <Text style={styles.timeText}>{item.time}</Text>
              </View>
            </View>
          );
        }}
        style={styles.list}
        contentContainerStyle={{ paddingVertical: 8 }}
      />

      {secondistyping && (
        <Text style={styles.typingText}> en train d'écrire...</Text>
      )}

      <View style={styles.inputRow}>
        <TextInput
          value={message ? message : null}
          onChangeText={(txt) => {
            setMessage(txt);
          }}
          onFocus={() => {
            const ref_me_istyping = ref_discussion.child(
              currentid + 'istyping'
            );
            ref_me_istyping.set(true);
          }}
          onBlur={() => {
            const ref_me_istyping = ref_discussion.child(
              currentid + 'istyping'
            );
            ref_me_istyping.set(false);
          }}
          placeholder="Écrire un message..."
          placeholderTextColor="#080505"
          style={styles.input}
        />
        <TouchableOpacity
            onPress={async () => {
              let imageUrl = null;

              if (imageToSend) {
                imageUrl = await uploadImageToSupabase(imageToSend);
              }

              const key = ref_chat.push().key;
              const ref_un_msg = ref_chat.child(key);

              ref_un_msg.set({
                idsender: currentid,
                idreceiver: secondid,
                message,
                time: new Date().toLocaleString(),
                type: imageToSend ? 'image' : 'text',
              });
              setImageToSend(null);
              setMessage('');
            }}
            style={styles.sendButton}
          >
          <Image
            source={require('../assets/message.png')}
            style={{ width: 24, height: 24, tintColor: '#fff' }}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={pickImage} style={{ marginLeft: 8 }}>
          <Image
            source={require('../assets/camera.png')}
            style={{ width: 24, height: 24 }}
          />
        </TouchableOpacity>
      </View>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
    fontSize: 24,
    color: '#fff',
    marginTop: 50,
    marginBottom: 8,
    textShadowColor: '#004D40',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 2,
    fontStyle: 'italic',
  },
  list: {
    width: '100%',
    flex: 1,
  },
  messageWrapper: {
    width: '100%',
    paddingHorizontal: 10,
    marginVertical: 3,
    flexDirection: 'row',
  },
  senderWrapper: {
    justifyContent: 'flex-end',   // messages envoyés → droite
  },
  receiverWrapper: {
    justifyContent: 'flex-start', // messages reçus → gauche
  },
  bubble: {
    maxWidth: '75%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    elevation: 2,
  },
  senderBubble: {
    backgroundColor: '#B2DFDB', // turquoise clair (envoyé)
    borderTopRightRadius: 2,
  },
  receiverBubble: {
    backgroundColor: '#FFF8E1', // crème doré (reçu)
    borderTopLeftRadius: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#C9A84C',
  },
  messageText: {
    fontSize: 15,
    color: '#004D40',
  },
  timeText: {
    fontSize: 11,
    color: '#00897B',
    textAlign: 'right',
    marginTop: 4,
  },
  inputRow: {
    height: 65,
    width: '100%',
    marginBottom: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#B2DFDB',
  },
  input: {
    backgroundColor: '#F1FFFE',
    width: '78%',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#004D40',
    borderWidth: 1,
    borderColor: '#B2DFDB',
  },
  sendButton: {
    backgroundColor: '#00897B',
    borderRadius: 25,
    padding: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C9A84C',
    elevation: 3,
  },
  typingText: {
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginBottom: 4,
    color: '#00897B',
    fontSize: 13,
    fontStyle: 'italic',
  },
})


