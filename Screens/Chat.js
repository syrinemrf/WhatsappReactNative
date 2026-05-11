import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  ImageBackground,
  Linking,
  Modal,
  ScrollView,
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

const EMOJIS = [
  '😀','😂','😍','😎','🥰','😭','😊','🤔','👍','👎',
  '❤️','🔥','🎉','🙏','😅','🤣','😱','🥺','😤','💪',
  '🙌','👏','💯','🚀','🌟','✨','💎','🎯','🎶','🤝',
];
const REACTIONS = ['👍','❤️','😂','😮','😢','😡'];

export default function Chat(props) {
  const currentid = props.route.params.currentid;
  const secondid = props.route.params.secondid;
  const secondPseudo = props.route.params.secondPseudo || 'Chat';

  const [data, setData] = useState([]);
  const [message, setMessage] = useState('');
  const [secondistyping, setSecondistyping] = useState(false);
  const [imageToSend, setImageToSend] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [showReactions, setShowReactions] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showMediaSearch, setShowMediaSearch] = useState(false);

  const iddiscussion =
    currentid > secondid
      ? currentid + secondid
      : secondid + currentid;

  const ref_discussion = ref_all_messages.child(iddiscussion);
  const ref_chat = ref_discussion.child('chat');
  const ref_second_istyping = ref_discussion.child(secondid + 'istyping');
  const flatListRef = useRef(null);

  useEffect(() => {
    ref_chat.on('value', (snapshot) => {
      const d = [];
      snapshot.forEach((one_msg) => {
        d.push({ ...one_msg.val(), key: one_msg.key });
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
    await supabase.storage.from('Images').upload(filenameInSupabase, arraybuffer, { upsert: true });
    const { data } = supabase.storage.from('Images').getPublicUrl(filenameInSupabase);
    return data.publicUrl;
  };

  const pickImageFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission requise', 'Accès caméra nécessaire.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled) setImageToSend(result.assets[0].uri);
  };

  const sendLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission refusée', 'Accès localisation nécessaire.'); return; }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const { latitude, longitude } = loc.coords;
    const key = ref_chat.push().key;
    ref_chat.child(key).set({
      idsender: currentid,
      idreceiver: secondid,
      latitude,
      longitude,
      time: new Date().toLocaleString(),
      type: 'location',
    });
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission micro refusée'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setIsRecording(true);
    } catch (err) {
      Alert.alert('Erreur micro', err.message);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    const response = await fetch(uri);
    const blob = await response.blob();
    const arraybuffer = await new Response(blob).arrayBuffer();
    const filename = Date.now() + '.m4a';
    await supabase.storage.from('Images').upload(filename, arraybuffer, { upsert: true, contentType: 'audio/m4a' });
    const { data } = supabase.storage.from('Images').getPublicUrl(filename);
    const key = ref_chat.push().key;
    ref_chat.child(key).set({
      idsender: currentid,
      idreceiver: secondid,
      message: data.publicUrl,
      time: new Date().toLocaleString(),
      type: 'voice',
    });
  };

  const reactToMessage = (msgKey, emoji) => {
    if (!msgKey) return;
    const ref_reaction = ref_chat.child(msgKey).child('reactions').child(emoji);
    ref_reaction.transaction((current) => (current || 0) + 1);
    setShowReactions(false);
    setSelectedMsg(null);
  };

  const sendMessage = async () => {
    let finalMessage = message.trim();
    let type = 'text';
    if (imageToSend) {
      finalMessage = await uploadImageToSupabase(imageToSend);
      type = 'image';
    }
    if (!finalMessage) return;
    const key = ref_chat.push().key;
    ref_chat.child(key).set({
      idsender: currentid,
      idreceiver: secondid,
      message: finalMessage,
      time: new Date().toLocaleString(),
      type,
    });
    ref_discussion.child(currentid + 'istyping').set(false);
    setImageToSend(null);
    setMessage('');
    setShowEmoji(false);
  };

  const mediaMessages = data.filter((m) => m.type === 'image');

  const playVoice = async (uri) => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      await sound.playAsync();
    } catch (e) {
      Alert.alert('Lecture impossible', e.message);
    }
  };

  const renderMessage = ({ item }) => {
    const isSender = currentid === item.idsender;
    const reactions = item.reactions ? Object.entries(item.reactions) : [];

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => { setSelectedMsg(item); setShowReactions(true); }}
      >
        <View style={[styles.messageWrapper, isSender ? styles.senderWrapper : styles.receiverWrapper]}>
          <View style={[styles.bubble, isSender ? styles.senderBubble : styles.receiverBubble]}>

            {item.type === 'image' ? (
              <TouchableOpacity onPress={() => { setSelectedImage(item.message); setShowImageModal(true); }}>
                <Image
                  source={{ uri: item.message }}
                  style={{ width: 210, height: 170, borderRadius: 12, marginBottom: 4 }}
                  resizeMode="cover"
                />
                <Text style={styles.tapText}>Appuyer pour agrandir</Text>
              </TouchableOpacity>
            ) : item.type === 'location' ? (
              <TouchableOpacity onPress={() => Linking.openURL(`https://www.google.com/maps?q=${item.latitude},${item.longitude}`)}>
                <View style={styles.locationCard}>
                  <Image
                    source={{ uri: `https://staticmap.openstreetmap.de/staticmap.php?center=${item.latitude},${item.longitude}&zoom=15&size=280x160&markers=${item.latitude},${item.longitude},red-pushpin` }}
                    style={{ width: 240, height: 140, borderRadius: 10, marginBottom: 6 }}
                    resizeMode="cover"
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 18 }}>📍</Text>
                    <Text style={styles.locationLabel}> Ouvrir dans Google Maps</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : item.type === 'voice' ? (
              <TouchableOpacity onPress={() => playVoice(item.message)} style={styles.voiceBubble}>
                <Text style={{ fontSize: 28 }}>🎙️</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.voiceText}>Message vocal</Text>
                  <Text style={styles.voiceSubText}>Appuyer pour écouter</Text>
                </View>
                <Text style={{ fontSize: 20 }}>▶</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.messageText}>{item.message}</Text>
            )}

            {reactions.length > 0 && (
              <View style={styles.reactionsRow}>
                {reactions.map(([emoji, count]) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => reactToMessage(item.key, emoji)}
                    style={styles.reactionBadge}
                  >
                    <Text style={{ fontSize: 14 }}>{emoji}{count > 1 ? ` ${count}` : ''}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={styles.timeText}>{item.time}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground style={styles.container} source={require('../assets/backgroundreact.jpg')}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => props.navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{secondPseudo}</Text>
        <TouchableOpacity onPress={() => setShowMediaSearch((v) => !v)} style={styles.headerIcon}>
          <Text style={{ fontSize: 20 }}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Media search panel */}
      {showMediaSearch && (
        <View style={styles.mediaSearchPanel}>
          <Text style={styles.mediaPanelTitle}>Médias partagés ({mediaMessages.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {mediaMessages.length === 0 ? (
              <Text style={{ color: '#90A4AE', fontSize: 13 }}>Aucun média partagé</Text>
            ) : mediaMessages.map((m, i) => (
              <TouchableOpacity key={i} onPress={() => { setSelectedImage(m.message); setShowImageModal(true); }}>
                <Image source={{ uri: m.message }} style={styles.mediaThumbnail} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Messages list */}
      <FlatList
        ref={flatListRef}
        data={data}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderMessage}
        style={styles.list}
        contentContainerStyle={{ paddingVertical: 8 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {secondistyping && <Text style={styles.typingText}>✍️ en train d'écrire...</Text>}

      {/* Image preview before send */}
      {imageToSend && (
        <View style={styles.previewRow}>
          <Image source={{ uri: imageToSend }} style={styles.previewImg} />
          <TouchableOpacity onPress={() => setImageToSend(null)} style={styles.previewCancel}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Emoji panel */}
      {showEmoji && (
        <View style={styles.emojiPanel}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            {EMOJIS.map((e) => (
              <TouchableOpacity key={e} onPress={() => setMessage((m) => m + e)} style={styles.emojiBtn}>
                <Text style={{ fontSize: 26 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        <TouchableOpacity onPress={() => setShowEmoji((v) => !v)} style={styles.actionBtn}>
          <Text style={{ fontSize: 22 }}>😊</Text>
        </TouchableOpacity>
        <TextInput
          value={message}
          onChangeText={setMessage}
          onFocus={() => ref_discussion.child(currentid + 'istyping').set(true)}
          onBlur={() => ref_discussion.child(currentid + 'istyping').set(false)}
          placeholder="Écrire un message..."
          placeholderTextColor="#90A4AE"
          style={styles.input}
          multiline
        />
        <TouchableOpacity onPress={pickImageFromCamera} style={styles.actionBtn}>
          <Image source={require('../assets/camera.png')} style={{ width: 22, height: 22 }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={sendLocation} style={styles.actionBtn}>
          <Text style={{ fontSize: 20 }}>📍</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={isRecording ? stopRecording : startRecording}
          style={[styles.actionBtn, isRecording && styles.recordingBtn]}
        >
          <Text style={{ fontSize: 20 }}>🎙️</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Image source={require('../assets/message.png')} style={{ width: 22, height: 22, tintColor: '#fff' }} />
        </TouchableOpacity>
      </View>

      {/* Full-screen image modal */}
      <Modal visible={showImageModal} transparent animationType="fade">
        <TouchableOpacity style={styles.imageModalBg} onPress={() => setShowImageModal(false)} activeOpacity={1}>
          <Image source={{ uri: selectedImage }} style={styles.imageModalImg} resizeMode="contain" />
          <Text style={styles.imageModalClose}>✕ Fermer</Text>
        </TouchableOpacity>
      </Modal>

      {/* Reactions panel */}
      <Modal visible={showReactions} transparent animationType="slide">
        <TouchableOpacity
          style={styles.reactionModalBg}
          onPress={() => { setShowReactions(false); setSelectedMsg(null); }}
          activeOpacity={1}
        >
          <View style={styles.reactionPanel}>
            <Text style={styles.reactionTitle}>Réagir au message</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
              {REACTIONS.map((e) => (
                <TouchableOpacity
                  key={e}
                  onPress={() => reactToMessage(selectedMsg?.key, e)}
                  style={styles.reactionEmojiBtn}
                >
                  <Text style={{ fontSize: 34 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,77,64,0.88)',
  },
  backBtn: {
    marginRight: 8,
    padding: 4,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 34,
    lineHeight: 34,
  },
  title: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: 20,
    color: '#fff',
    letterSpacing: 1,
    fontStyle: 'italic',
  },
  headerIcon: {
    padding: 6,
  },
  mediaSearchPanel: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#B2DFDB',
  },
  mediaPanelTitle: {
    color: '#004D40',
    fontWeight: '700',
    fontSize: 13,
  },
  mediaThumbnail: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#C9A84C',
  },
  list: {
    flex: 1,
    width: '100%',
  },
  messageWrapper: {
    width: '100%',
    paddingHorizontal: 10,
    marginVertical: 3,
    flexDirection: 'row',
  },
  senderWrapper: {
    justifyContent: 'flex-end',
  },
  receiverWrapper: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    elevation: 2,
  },
  senderBubble: {
    backgroundColor: '#B2DFDB',
    borderTopRightRadius: 2,
  },
  receiverBubble: {
    backgroundColor: '#FFF8E1',
    borderTopLeftRadius: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#C9A84C',
  },
  messageText: {
    fontSize: 15,
    color: '#004D40',
    lineHeight: 21,
  },
  tapText: {
    fontSize: 11,
    color: '#00897B',
    textAlign: 'center',
    marginBottom: 2,
  },
  locationCard: {
    alignItems: 'center',
  },
  locationLabel: {
    color: '#1565C0',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  voiceBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,137,123,0.12)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 160,
  },
  voiceText: {
    color: '#004D40',
    fontWeight: '600',
    fontSize: 14,
  },
  voiceSubText: {
    color: '#00897B',
    fontSize: 11,
    marginTop: 2,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  reactionBadge: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#B2DFDB',
  },
  timeText: {
    fontSize: 11,
    color: '#00897B',
    textAlign: 'right',
    marginTop: 4,
  },
  typingText: {
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginBottom: 4,
    color: '#00897B',
    fontSize: 12,
    fontStyle: 'italic',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderTopWidth: 1,
    borderTopColor: '#B2DFDB',
  },
  previewImg: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#C9A84C',
  },
  previewCancel: {
    marginLeft: 10,
    backgroundColor: '#c0392b',
    borderRadius: 15,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiPanel: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1,
    borderTopColor: '#B2DFDB',
    paddingVertical: 10,
    paddingHorizontal: 6,
    maxHeight: 180,
  },
  emojiBtn: {
    margin: 4,
    padding: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1,
    borderTopColor: '#B2DFDB',
  },
  actionBtn: {
    padding: 6,
    marginHorizontal: 2,
  },
  recordingBtn: {
    backgroundColor: 'rgba(192,57,43,0.18)',
    borderRadius: 20,
  },
  input: {
    flex: 1,
    backgroundColor: '#F1FFFE',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    color: '#004D40',
    borderWidth: 1,
    borderColor: '#B2DFDB',
    maxHeight: 100,
    marginHorizontal: 4,
  },
  sendButton: {
    backgroundColor: '#00897B',
    borderRadius: 22,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C9A84C',
    elevation: 3,
    marginLeft: 2,
  },
  imageModalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageModalImg: {
    width: '95%',
    height: '80%',
    borderRadius: 12,
  },
  imageModalClose: {
    color: '#fff',
    marginTop: 20,
    fontSize: 16,
    fontWeight: '600',
  },
  reactionModalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  reactionPanel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  reactionTitle: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#004D40',
    fontSize: 16,
    marginBottom: 16,
  },
  reactionEmojiBtn: {
    padding: 8,
    margin: 4,
  },
});

