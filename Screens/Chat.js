import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  ImageBackground,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
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

const THEME_PRESETS = [
  { id: 'default', label: 'Défaut',  type: 'image',  value: null },
  { id: 'white',   label: 'Blanc',   type: 'color',  value: '#F0F0F0' },
  { id: 'dark',    label: 'Sombre',  type: 'color',  value: '#1A1A2E' },
  { id: 'teal',    label: 'Menthe',  type: 'color',  value: '#004D40' },
  { id: 'rose',    label: 'Rose',    type: 'color',  value: '#FCE4EC' },
  { id: 'ocean',   label: 'Océan',   type: 'color',  value: '#0D47A1' },
  { id: 'sand',    label: 'Sable',   type: 'color',  value: '#FFF8E1' },
  { id: 'galaxy',  label: 'Galaxy',  type: 'color',  value: '#12002F' },
];

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
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [showReactions, setShowReactions] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showMediaSearch, setShowMediaSearch] = useState(false);
  const [theme, setTheme] = useState({ id: 'default', type: 'image', value: null });
  const [showThemeModal, setShowThemeModal] = useState(false);

  // Use ref for recording to avoid stale closure issues
  const recordingRef = useRef(null);
  const flatListRef = useRef(null);

  const iddiscussion =
    currentid > secondid ? currentid + secondid : secondid + currentid;

  const ref_discussion = ref_all_messages.child(iddiscussion);
  const ref_chat = ref_discussion.child('chat');
  const ref_second_istyping = ref_discussion.child(secondid + 'istyping');

  useEffect(() => {
    ref_chat.on('value', (snapshot) => {
      const d = [];
      snapshot.forEach((m) => d.push({ ...m.val(), key: m.key }));
      setData(d);
    });
    ref_second_istyping.on('value', (snapshot) => setSecondistyping(snapshot.val()));

    AsyncStorage.getItem('chat_theme_' + iddiscussion).then((val) => {
      if (val) setTheme(JSON.parse(val));
    });

    return () => {
      ref_chat.off();
      ref_second_istyping.off();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const saveTheme = async (t) => {
    setTheme(t);
    await AsyncStorage.setItem('chat_theme_' + iddiscussion, JSON.stringify(t));
    setShowThemeModal(false);
  };

  const pickThemeFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission requise'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) {
      saveTheme({ id: 'custom', type: 'image', value: result.assets[0].uri });
    }
  };

  const uploadImageToSupabase = async (url) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const arraybuffer = await new Response(blob).arrayBuffer();
    const filename = Date.now() + '.jpg';
    await supabase.storage.from('Images').upload(filename, arraybuffer, { upsert: true });
    const { data } = supabase.storage.from('Images').getPublicUrl(filename);
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
    if (status !== 'granted') { Alert.alert('Permission refusée'); return; }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const { latitude, longitude } = loc.coords;
    const key = ref_chat.push().key;
    ref_chat.child(key).set({
      idsender: currentid, idreceiver: secondid,
      latitude, longitude,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      type: 'location',
    });
  };

  const startRecording = async () => {
    try {
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
      }
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission micro refusée'); return; }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err) {
      Alert.alert('Erreur micro', err.message);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    setIsRecording(false);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) return;
      const response = await fetch(uri);
      const blob = await response.blob();
      const arraybuffer = await new Response(blob).arrayBuffer();
      const filename = Date.now() + '.m4a';
      await supabase.storage.from('Images').upload(filename, arraybuffer, {
        upsert: true, contentType: 'audio/m4a',
      });
      const { data } = supabase.storage.from('Images').getPublicUrl(filename);
      const key = ref_chat.push().key;
      ref_chat.child(key).set({
        idsender: currentid, idreceiver: secondid,
        message: data.publicUrl,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        type: 'voice',
      });
    } catch (err) {
      Alert.alert('Erreur envoi vocal', err.message);
      recordingRef.current = null;
    }
  };

  const playVoice = async (uri) => {
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) sound.unloadAsync();
      });
    } catch (e) {
      Alert.alert('Lecture impossible', e.message);
    }
  };

  const reactToMessage = (msgKey, emoji) => {
    if (!msgKey) return;
    ref_chat.child(msgKey).child('reactions').child(emoji)
      .transaction((current) => (current || 0) + 1);
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
      idsender: currentid, idreceiver: secondid,
      message: finalMessage,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      type,
    });
    ref_discussion.child(currentid + 'istyping').set(false);
    setImageToSend(null);
    setMessage('');
    setShowEmoji(false);
  };

  const renderMessage = ({ item }) => {
    const isSender = currentid === item.idsender;
    const reactions = item.reactions ? Object.entries(item.reactions) : [];
    const isDark = ['dark', 'galaxy', 'ocean', 'teal'].includes(theme.id);

    return (
      <TouchableOpacity
        activeOpacity={0.95}
        onLongPress={() => { setSelectedMsg(item); setShowReactions(true); }}
      >
        <View style={[styles.msgWrapper, isSender ? styles.senderWrapper : styles.receiverWrapper]}>
          <View style={[
            styles.bubble,
            isSender ? styles.senderBubble : (isDark ? styles.receiverBubbleDark : styles.receiverBubble),
          ]}>
            {item.type === 'image' ? (
              <TouchableOpacity onPress={() => { setSelectedImage(item.message); setShowImageModal(true); }}>
                <Image source={{ uri: item.message }} style={styles.msgImage} resizeMode="cover" />
                <View style={styles.tapHint}>
                  <Ionicons name="expand-outline" size={12} color="#fff" />
                  <Text style={styles.tapHintText}> Agrandir</Text>
                </View>
              </TouchableOpacity>
            ) : item.type === 'location' ? (
              <TouchableOpacity onPress={() => Linking.openURL(`https://www.google.com/maps?q=${item.latitude},${item.longitude}`)}>
                <Image
                  source={{ uri: `https://staticmap.openstreetmap.de/staticmap.php?center=${item.latitude},${item.longitude}&zoom=15&size=280x160&markers=${item.latitude},${item.longitude},red-pushpin` }}
                  style={styles.mapImage} resizeMode="cover"
                />
                <View style={styles.mapHint}>
                  <Ionicons name="location" size={14} color="#1565C0" />
                  <Text style={styles.mapLabel}> Ouvrir dans Maps</Text>
                </View>
              </TouchableOpacity>
            ) : item.type === 'voice' ? (
              <TouchableOpacity onPress={() => playVoice(item.message)} style={styles.voiceBubble}>
                <View style={styles.voiceIconCircle}>
                  <Ionicons name="mic" size={20} color="#00897B" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.voiceTitle}>Message vocal</Text>
                  <Text style={styles.voiceHint}>Appuyer pour écouter</Text>
                </View>
                <Ionicons name="play-circle" size={32} color="#00897B" />
              </TouchableOpacity>
            ) : (
              <Text style={[
                styles.msgText,
                isSender ? styles.senderText : (isDark ? styles.receiverTextDark : styles.receiverText),
              ]}>
                {item.message}
              </Text>
            )}

            {reactions.length > 0 && (
              <View style={styles.reactionsRow}>
                {reactions.map(([emoji, count]) => (
                  <TouchableOpacity key={emoji} onPress={() => reactToMessage(item.key, emoji)} style={styles.reactionBadge}>
                    <Text style={{ fontSize: 13 }}>{emoji}{count > 1 ? ` ${count}` : ''}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={[styles.timeText, isDark && !isSender ? { color: '#aaa' } : {}]}>
              {item.time}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const mediaMessages = data.filter((m) => m.type === 'image');

  const ChatBackground = ({ children }) => {
    if (theme.type === 'color') {
      return <View style={[styles.container, { backgroundColor: theme.value }]}>{children}</View>;
    }
    const src = theme.value ? { uri: theme.value } : require('../assets/backgroundreact.jpg');
    return <ImageBackground style={styles.container} source={src}>{children}</ImageBackground>;
  };

  return (
    <ChatBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" backgroundColor="#075E54" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => props.navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerAvatar}>
            <Ionicons name="person" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.headerName} numberOfLines={1}>{secondPseudo}</Text>
            {secondistyping && <Text style={styles.typingLabel}>en train d'écrire...</Text>}
          </View>
          <TouchableOpacity onPress={() => setShowMediaSearch((v) => !v)} style={styles.headerBtn}>
            <Ionicons name="search-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowThemeModal(true)} style={styles.headerBtn}>
            <Ionicons name="color-palette-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Media gallery panel */}
        {showMediaSearch && (
          <View style={styles.mediaPanel}>
            <Text style={styles.mediaPanelTitle}>Médias partagés ({mediaMessages.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {mediaMessages.length === 0
                ? <Text style={{ color: '#90A4AE', fontSize: 13, paddingLeft: 4 }}>Aucun média</Text>
                : mediaMessages.map((m, i) => (
                  <TouchableOpacity key={i} onPress={() => { setSelectedImage(m.message); setShowImageModal(true); }}>
                    <Image source={{ uri: m.message }} style={styles.mediaThumbnail} />
                  </TouchableOpacity>
                ))
              }
            </ScrollView>
          </View>
        )}

        {/* Messages list */}
        <FlatList
          ref={flatListRef}
          data={data}
          keyExtractor={(_, i) => i.toString()}
          renderItem={renderMessage}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 4 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Image preview before send */}
        {imageToSend && (
          <View style={styles.previewBar}>
            <Image source={{ uri: imageToSend }} style={styles.previewImg} />
            <Text style={{ flex: 1, color: '#004D40', marginLeft: 10, fontSize: 13 }}>Photo prête à envoyer</Text>
            <TouchableOpacity onPress={() => setImageToSend(null)}>
              <Ionicons name="close-circle" size={26} color="#c0392b" />
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

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity onPress={() => setShowEmoji((v) => !v)} style={styles.inputIcon}>
            <Ionicons name={showEmoji ? 'happy' : 'happy-outline'} size={26} color="#00897B" />
          </TouchableOpacity>
          <TextInput
            value={message}
            onChangeText={setMessage}
            onFocus={() => ref_discussion.child(currentid + 'istyping').set(true)}
            onBlur={() => ref_discussion.child(currentid + 'istyping').set(false)}
            placeholder="Message..."
            placeholderTextColor="#aaa"
            style={styles.input}
            multiline
          />
          <TouchableOpacity onPress={pickImageFromCamera} style={styles.inputIcon}>
            <Ionicons name="camera-outline" size={25} color="#00897B" />
          </TouchableOpacity>
          <TouchableOpacity onPress={sendLocation} style={styles.inputIcon}>
            <Ionicons name="location-outline" size={25} color="#00897B" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={isRecording ? stopRecording : startRecording}
            style={[styles.inputIcon, isRecording && styles.micActive]}
          >
            <Ionicons name={isRecording ? 'mic' : 'mic-outline'} size={25} color={isRecording ? '#fff' : '#00897B'} />
          </TouchableOpacity>
          {(message.trim() || imageToSend) ? (
            <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>

      {/* Full-screen image modal */}
      <Modal visible={showImageModal} transparent animationType="fade">
        <TouchableOpacity style={styles.imgModalBg} onPress={() => setShowImageModal(false)} activeOpacity={1}>
          <Image source={{ uri: selectedImage }} style={styles.imgModalImg} resizeMode="contain" />
          <View style={styles.imgModalClose}>
            <Ionicons name="close-circle" size={36} color="#fff" />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Reactions bottom sheet */}
      <Modal visible={showReactions} transparent animationType="slide">
        <TouchableOpacity
          style={styles.reactModalBg}
          onPress={() => { setShowReactions(false); setSelectedMsg(null); }}
          activeOpacity={1}
        >
          <View style={styles.reactPanel}>
            <View style={styles.reactHandle} />
            <Text style={styles.reactTitle}>Réagir</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              {REACTIONS.map((e) => (
                <TouchableOpacity key={e} onPress={() => reactToMessage(selectedMsg?.key, e)} style={styles.reactEmojiBtn}>
                  <Text style={{ fontSize: 36 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Theme picker modal */}
      <Modal visible={showThemeModal} transparent animationType="slide">
        <TouchableOpacity style={styles.reactModalBg} onPress={() => setShowThemeModal(false)} activeOpacity={1}>
          <View style={[styles.reactPanel, { paddingBottom: 30 }]}>
            <View style={styles.reactHandle} />
            <Text style={styles.reactTitle}>Thème de la discussion</Text>
            <View style={styles.themeGrid}>
              {THEME_PRESETS.map((t) => (
                <TouchableOpacity key={t.id} onPress={() => saveTheme(t)} style={styles.themeChip}>
                  {t.type === 'image' ? (
                    <Image source={require('../assets/backgroundreact.jpg')} style={styles.themeChipImg} />
                  ) : (
                    <View style={[styles.themeChipColor, { backgroundColor: t.value }]} />
                  )}
                  <Text style={styles.themeChipLabel}>{t.label}</Text>
                  {theme.id === t.id && (
                    <View style={styles.themeCheck}>
                      <Ionicons name="checkmark-circle" size={18} color="#25D366" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={pickThemeFromGallery} style={styles.themeChip}>
                <View style={[styles.themeChipColor, { backgroundColor: '#E8EAF6', alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="image-outline" size={24} color="#5C6BC0" />
                </View>
                <Text style={styles.themeChipLabel}>Galerie</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </ChatBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#075E54',
    paddingHorizontal: 8,
    paddingVertical: 10,
    elevation: 4,
  },
  headerBtn: { padding: 6 },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#128C7E',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  headerName: { color: '#fff', fontWeight: '700', fontSize: 17, letterSpacing: 0.3 },
  typingLabel: { color: '#B2EBF2', fontSize: 12, fontStyle: 'italic' },

  mediaPanel: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  mediaPanelTitle: { color: '#004D40', fontWeight: '700', fontSize: 13 },
  mediaThumbnail: {
    width: 68, height: 68, borderRadius: 8, marginRight: 8,
    borderWidth: 2, borderColor: '#25D366',
  },

  msgWrapper: { width: '100%', paddingHorizontal: 8, marginVertical: 2, flexDirection: 'row' },
  senderWrapper: { justifyContent: 'flex-end' },
  receiverWrapper: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, elevation: 1,
  },
  senderBubble: { backgroundColor: '#DCF8C6', borderTopRightRadius: 4 },
  receiverBubble: { backgroundColor: '#fff', borderTopLeftRadius: 4, elevation: 2 },
  receiverBubbleDark: { backgroundColor: 'rgba(255,255,255,0.13)', borderTopLeftRadius: 4 },
  msgText: { fontSize: 15, lineHeight: 21 },
  senderText: { color: '#1B3A2F' },
  receiverText: { color: '#1A1A1A' },
  receiverTextDark: { color: '#fff' },

  msgImage: { width: 220, height: 175, borderRadius: 12, marginBottom: 4 },
  tapHint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 6,
    paddingVertical: 3, marginTop: -28, marginBottom: 4,
  },
  tapHintText: { color: '#fff', fontSize: 11 },
  mapImage: { width: 240, height: 140, borderRadius: 10, marginBottom: 6 },
  mapHint: { flexDirection: 'row', alignItems: 'center' },
  mapLabel: { color: '#1565C0', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  voiceBubble: { flexDirection: 'row', alignItems: 'center', minWidth: 170, paddingVertical: 4 },
  voiceIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#A5D6A7',
  },
  voiceTitle: { color: '#004D40', fontWeight: '600', fontSize: 14 },
  voiceHint: { color: '#00897B', fontSize: 11, marginTop: 2 },

  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  reactionBadge: {
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12,
    paddingHorizontal: 6, paddingVertical: 2, marginRight: 4, marginTop: 2,
    borderWidth: 1, borderColor: '#E0E0E0', elevation: 1,
  },
  timeText: { fontSize: 11, color: '#75A58B', textAlign: 'right', marginTop: 4 },

  previewBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#E8F5E9', borderTopWidth: 1, borderTopColor: '#C8E6C9',
  },
  previewImg: { width: 52, height: 52, borderRadius: 8, borderWidth: 2, borderColor: '#25D366' },

  emojiPanel: {
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E0E0E0',
    paddingVertical: 10, paddingHorizontal: 6, maxHeight: 185,
  },
  emojiBtn: { margin: 3, padding: 4 },

  inputBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F6F6F6', paddingVertical: 8, paddingHorizontal: 8,
    borderTopWidth: 1, borderTopColor: '#E0E0E0',
  },
  inputIcon: { padding: 6 },
  input: {
    flex: 1, backgroundColor: '#fff', borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    fontSize: 15, color: '#1A1A1A', maxHeight: 110,
    marginHorizontal: 6, borderWidth: 1, borderColor: '#E0E0E0',
  },
  micActive: { backgroundColor: '#E53935', borderRadius: 20 },
  sendBtn: {
    backgroundColor: '#075E54', borderRadius: 22,
    width: 42, height: 42, alignItems: 'center', justifyContent: 'center',
    marginLeft: 2, elevation: 2,
  },

  imgModalBg: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  imgModalImg: { width: '100%', height: '85%' },
  imgModalClose: { position: 'absolute', top: 50, right: 16 },

  reactModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  reactPanel: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingVertical: 16, paddingHorizontal: 16,
  },
  reactHandle: { width: 36, height: 4, backgroundColor: '#DDD', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  reactTitle: { textAlign: 'center', fontWeight: '700', color: '#1A1A1A', fontSize: 16, marginBottom: 14 },
  reactEmojiBtn: { padding: 8, marginHorizontal: 4 },

  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 },
  themeChip: { alignItems: 'center', margin: 8, width: 70 },
  themeChipImg: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#25D366' },
  themeChipColor: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#E0E0E0' },
  themeChipLabel: { fontSize: 11, color: '#555', marginTop: 5, fontWeight: '500' },
  themeCheck: { position: 'absolute', top: -4, right: -4 },
});
