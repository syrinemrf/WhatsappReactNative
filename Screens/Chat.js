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
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
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
  { id: 'default',  label: 'WhatsApp',  type: 'image', value: null,      preview: '#128C7E', dark: false },
  { id: 'midnight', label: 'Minuit',    type: 'color', value: '#0D1B2A', preview: '#0D1B2A', dark: true  },
  { id: 'cherry',   label: 'Cerise',    type: 'color', value: '#1A0005', preview: '#8B0000', dark: true  },
  { id: 'forest',   label: 'Forêt',     type: 'color', value: '#0A1F0E', preview: '#1B5E20', dark: true  },
  { id: 'lavender', label: 'Lavande',   type: 'color', value: '#F3E5F5', preview: '#CE93D8', dark: false },
  { id: 'peach',    label: 'Pêche',     type: 'color', value: '#FFF3E0', preview: '#FFCC80', dark: false },
  { id: 'sky',      label: 'Ciel',      type: 'color', value: '#E1F5FE', preview: '#81D4FA', dark: false },
  { id: 'galaxy',   label: 'Galaxy',    type: 'color', value: '#0A001F', preview: '#4A148C', dark: true  },
  { id: 'rose',     label: 'Rose',      type: 'color', value: '#FCE4EC', preview: '#F48FB1', dark: false },
  { id: 'emerald',  label: 'Emeraude', type: 'color', value: '#E8F5E9', preview: '#81C784', dark: false },
];

export default function Chat(props) {
  const currentid    = props.route.params.currentid;
  const secondid     = props.route.params.secondid;
  const secondPseudo = props.route.params.secondPseudo || 'Chat';

  const [data,            setData]            = useState([]);
  const [message,         setMessage]         = useState('');
  const [secondistyping,  setSecondistyping]  = useState(false);
  const [imageToSend,     setImageToSend]     = useState(null);
  const [showEmoji,       setShowEmoji]       = useState(false);
  const [isRecording,     setIsRecording]     = useState(false);
  const [selectedMsg,     setSelectedMsg]     = useState(null);
  const [showReactions,   setShowReactions]   = useState(false);
  const [selectedImage,   setSelectedImage]   = useState(null);
  const [showImageModal,  setShowImageModal]  = useState(false);
  const [showMediaSearch, setShowMediaSearch] = useState(false);
  const [theme,           setTheme]           = useState({ id: 'default', type: 'image', value: null, dark: false });
  const [showThemeModal,  setShowThemeModal]  = useState(false);
  const [showLocModal,    setShowLocModal]    = useState(false);
  const [pendingLoc,      setPendingLoc]      = useState(null);
  const [allContacts,     setAllContacts]     = useState([]);
  const [showForwardModal,setShowForwardModal]= useState(false);
  const [forwardImageUrl, setForwardImageUrl] = useState(null);

  const recordingRef  = useRef(null);
  const flatListRef  = useRef(null);
  const inputRef     = useRef(null);

  const iddiscussion = currentid > secondid
    ? currentid + secondid
    : secondid + currentid;

  // Stable refs for Firebase — avoids re-creating on re-render
  const ref_chat_ref       = useRef(null);
  const ref_istyping_ref   = useRef(null);
  const ref_discussion_ref = useRef(null);

  useEffect(() => {
    const chatPath   = 'AllMessages/' + iddiscussion + '/chat';
    const typingPath = 'AllMessages/' + iddiscussion + '/' + secondid + 'istyping';
    const discPath   = 'AllMessages/' + iddiscussion;

    const refChat    = firebase.database().ref(chatPath);
    const refTyping  = firebase.database().ref(typingPath);
    const refDisc    = firebase.database().ref(discPath);

    ref_chat_ref.current       = refChat;
    ref_istyping_ref.current   = refTyping;
    ref_discussion_ref.current = refDisc;

    const handleMessages = (snapshot) => {
      const d = [];
      snapshot.forEach((m) => d.push({ ...m.val(), key: m.key }));
      console.log('[handleMessages] count:', d.length, 'last:', d[d.length - 1]?.message);
      setData(d);
    };

    refChat.on('value', handleMessages);
    refTyping.on('value', (snap) => setSecondistyping(!!snap.val()));

    AsyncStorage.getItem('chat_theme_' + iddiscussion).then((val) => {
      if (val) { try { setTheme(JSON.parse(val)); } catch {} }
    });

    firebase.database().ref('allaccounts').once('value').then((snap) => {
      const d = [];
      snap.forEach((u) => { if (u.val() && u.val().Id !== currentid) d.push(u.val()); });
      setAllContacts(d);
    });

    return () => {
      refChat.off('value', handleMessages);
      refTyping.off();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (data.length > 0) {
      const t = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
      return () => clearTimeout(t);
    }
  }, [data.length]);

  // ─── THEME ────────────────────────────────────────────────────────────────
  const saveTheme = async (t) => {
    try {
      setTheme(t);
      setShowThemeModal(false);
      await AsyncStorage.setItem('chat_theme_' + iddiscussion, JSON.stringify(t));
    } catch {}
  };

  const pickThemeFromGallery = async () => {
    setShowThemeModal(false);
    await new Promise((r) => setTimeout(r, 600));
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission requise', 'Acces galerie necessaire.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (!result.canceled) {
        await saveTheme({ id: 'custom', label: 'Personnalise', type: 'image', value: result.assets[0].uri, dark: false });
      }
    } catch (e) { Alert.alert('Erreur', e.message); }
  };

  // ─── IMAGE ────────────────────────────────────────────────────────────────
  const uploadImageToSupabase = async (uri) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const arraybuffer = await new Response(blob).arrayBuffer();
    const filename = Date.now() + '.jpg';
    const { error } = await supabase.storage.from('Images').upload(filename, arraybuffer, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('Images').getPublicUrl(filename);
    return data.publicUrl;
  };

  const pickImageFromCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission requise', 'Acces camera necessaire.'); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
      if (!result.canceled) setImageToSend(result.assets[0].uri);
    } catch (e) { Alert.alert('Erreur camera', e.message); }
  };

  // ─── LOCATION ─────────────────────────────────────────────────────────────
  const prepareLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission refusee'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPendingLoc(loc.coords);
      setShowLocModal(true);
    } catch (e) { Alert.alert('Erreur localisation', e.message); }
  };

  const confirmSendLocation = async () => {
    if (!pendingLoc) return;
    const { latitude, longitude } = pendingLoc;
    setShowLocModal(false);
    setPendingLoc(null);
    try {
      await ref_chat_ref.current.push().set({
        idsender: currentid, idreceiver: secondid,
        latitude, longitude,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        type: 'location',
      });
    } catch (e) { Alert.alert('Erreur envoi', e.message); }
  };

  // ─── VOICE ────────────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission micro refusee'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err) { Alert.alert('Erreur micro', err.message); }
  };

  const cancelRecording = async () => {
    setIsRecording(false);
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    } catch {}
  };

  const stopAndSendRecording = async () => {
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
      const { error } = await supabase.storage.from('Images').upload(filename, arraybuffer, {
        upsert: true, contentType: 'audio/m4a',
      });
      if (error) throw error;
      const { data } = supabase.storage.from('Images').getPublicUrl(filename);
      await ref_chat_ref.current.push().set({
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
      sound.setOnPlaybackStatusUpdate((s) => { if (s.didJustFinish) sound.unloadAsync(); });
    } catch (e) { Alert.alert('Lecture impossible', e.message); }
  };

  // ─── REACTIONS ────────────────────────────────────────────────────────────
  const reactToMessage = (msgKey, emoji) => {
    if (!msgKey) return;
    ref_chat_ref.current.child(msgKey).child('reactions').child(emoji)
      .transaction((current) => (current || 0) + 1);
    setShowReactions(false);
    setSelectedMsg(null);
  };

  // ─── FORWARD ──────────────────────────────────────────────────────────────
  const forwardImageToContact = async (contact) => {
    if (!forwardImageUrl) return;
    setShowForwardModal(false);
    try {
      const theirId = contact.Id;
      const fwdId = currentid > theirId ? currentid + theirId : theirId + currentid;
      const ref_fwd = ref_all_messages.child(fwdId).child('chat');
      await ref_fwd.push().set({
        idsender: currentid, idreceiver: theirId,
        message: forwardImageUrl,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        type: 'image',
      });
      Alert.alert('Transféré', `Image envoyée à ${contact.Pseudo || contact.Nom}.`);
    } catch (e) { Alert.alert('Erreur transfert', e.message); }
  };

  // ─── SEND ─────────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const textContent = message.trim();
    const imgContent  = imageToSend;
    if (!textContent && !imgContent) return;
    // Optimistic: clear UI immediately
    setMessage('');
    setImageToSend(null);
    setShowEmoji(false);
    console.log('[sendMessage] START — text:', JSON.stringify(textContent), 'img:', !!imgContent);
    console.log('[sendMessage] iddiscussion:', iddiscussion, 'currentid:', currentid, 'secondid:', secondid);
    try {
      let msg  = textContent;
      let type = 'text';
      if (imgContent) {
        msg  = await uploadImageToSupabase(imgContent);
        type = 'image';
      }
      const dbPath = 'AllMessages/' + iddiscussion + '/chat';
      console.log('[sendMessage] pushing to path:', dbPath, 'payload:', { idsender: currentid, message: msg, type });
      // Use explicit path — avoids stale ref objects
      const pushResult = await firebase.database()
        .ref(dbPath)
        .push({
          idsender: currentid,
          idreceiver: secondid,
          message: msg,
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          type,
        });
      console.log('[sendMessage] push OK — key:', pushResult?.key);
      firebase.database().ref('AllMessages/' + iddiscussion + '/' + currentid + 'istyping').set(false);
    } catch (e) {
      console.error('[sendMessage] ERREUR:', e);
      Alert.alert("Erreur d'envoi", String(e?.message || e?.code || JSON.stringify(e)));
      if (!imgContent) setMessage(textContent);
    }
  };

  // ─── DELETE MESSAGE ──────────────────────────────────────────────────
  const handleLongPress = (item) => {
    if (item.idsender === currentid) {
      Alert.alert('Message', undefined, [
        { text: '😊 Réagir', onPress: () => { setSelectedMsg(item); setShowReactions(true); } },
        {
          text: '🗑️ Supprimer pour tous', style: 'destructive',
          onPress: () => Alert.alert('Supprimer', 'Supprimer ce message pour tout le monde ?', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Supprimer', style: 'destructive', onPress: () => ref_chat_ref.current.child(item.key).remove() },
          ]),
        },
        { text: 'Annuler', style: 'cancel' },
      ]);
    } else {
      setSelectedMsg(item); setShowReactions(true);
    }
  };

  // ─── MESSAGE RENDER ───────────────────────────────────────────────────────
  const isDark = !!(theme.dark);

  const renderMessage = ({ item }) => {
    const isSender  = currentid === item.idsender;
    const reactions = item.reactions ? Object.entries(item.reactions) : [];

    return (
      <TouchableOpacity activeOpacity={0.95}
        onLongPress={() => handleLongPress(item)}>
        <View style={[styles.msgWrapper, isSender ? styles.senderWrapper : styles.receiverWrapper]}>
          <View style={[
            styles.bubble,
            isSender
              ? styles.senderBubble
              : (isDark ? styles.receiverBubbleDark : styles.receiverBubble),
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
              <TouchableOpacity onPress={() =>
                Linking.openURL(`https://www.google.com/maps?q=${item.latitude},${item.longitude}`)}>
                <Image
                  source={{ uri: `https://staticmap.openstreetmap.de/staticmap.php?center=${item.latitude},${item.longitude}&zoom=15&size=280x160&markers=${item.latitude},${item.longitude},red-pushpin` }}
                  style={styles.mapImage} resizeMode="cover" />
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
                  <Text style={[styles.voiceTitle, isDark && !isSender && { color: '#fff' }]}>
                    Message vocal
                  </Text>
                  <Text style={[styles.voiceHint, isDark && !isSender && { color: '#ccc' }]}>
                    Appuyer pour ecouter
                  </Text>
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
                  <TouchableOpacity key={emoji} onPress={() => reactToMessage(item.key, emoji)}
                    style={styles.reactionBadge}>
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

  // ─── BACKGROUND ───────────────────────────────────────────────────────────
  const bgSource = theme.type === 'image' && theme.value
    ? { uri: theme.value }
    : require('../assets/backgroundreact.jpg');

  return (
    <View style={styles.container}>
      {/* Background layer — absolutely positioned so root <View> type never changes */}
      {theme.type === 'color' && theme.value
        ? <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.value }]} />
        : <ImageBackground source={bgSource} style={StyleSheet.absoluteFill} />
      }
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
          {secondistyping && <Text style={styles.typingLabel}>en train d'ecrire...</Text>}
        </View>
        <TouchableOpacity onPress={() => setShowMediaSearch((v) => !v)} style={styles.headerBtn}>
          <Ionicons name="search-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowThemeModal(true)} style={styles.headerBtn}>
          <Ionicons name="color-palette-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Media panel */}
      {showMediaSearch && (
        <View style={styles.mediaPanel}>
          <Text style={styles.mediaPanelTitle}>Medias partages ({mediaMessages.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {mediaMessages.length === 0
              ? <Text style={{ color: '#90A4AE', fontSize: 13 }}>Aucun media</Text>
              : mediaMessages.map((m, i) => (
                <View key={i} style={{ alignItems: 'center', marginRight: 8 }}>
                  <TouchableOpacity onPress={() => { setSelectedImage(m.message); setShowImageModal(true); }}>
                    <Image source={{ uri: m.message }} style={styles.mediaThumbnail} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setForwardImageUrl(m.message); setShowForwardModal(true); }}
                    style={styles.forwardBtn}>
                    <Ionicons name="share-outline" size={14} color="#00897B" />
                    <Text style={styles.forwardBtnText}> Transférer</Text>
                  </TouchableOpacity>
                </View>
              ))}
          </ScrollView>
        </View>
      )}

      {/* Keyboard-aware wrapper */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {/* Messages list */}
        <ScrollView
          ref={flatListRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 4 }}
        >
          <Text style={{ color: 'red', textAlign: 'center', fontSize: 10 }}>
            msgs={data.length}
          </Text>
          {data.map((item) => (
            <View key={item.key}>
              {renderMessage({ item })}
            </View>
          ))}
        </ScrollView>

        {/* Image preview */}
        {imageToSend && (
          <View style={styles.previewBar}>
            <Image source={{ uri: imageToSend }} style={styles.previewImg} />
            <Text style={{ flex: 1, color: '#004D40', marginLeft: 10, fontSize: 13 }}>
              Photo prete a envoyer
            </Text>
            <TouchableOpacity onPress={() => setImageToSend(null)}>
              <Ionicons name="close-circle" size={26} color="#c0392b" />
            </TouchableOpacity>
          </View>
        )}

        {/* Emoji panel */}
        {showEmoji && !isRecording && (
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

        {/* Recording bar */}
        {isRecording ? (
          <View style={styles.recordingBar}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Enregistrement...</Text>
            <TouchableOpacity onPress={cancelRecording} style={styles.cancelRecordBtn}>
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.cancelRecordText}> Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={stopAndSendRecording} style={styles.sendRecordBtn}>
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={styles.sendRecordText}> Envoyer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Input bar */
          <View style={styles.inputBar}>
            <TouchableOpacity onPress={() => setShowEmoji((v) => !v)} style={styles.inputIcon}>
              <Ionicons name={showEmoji ? 'happy' : 'happy-outline'} size={26} color="#00897B" />
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              value={message}
              onChangeText={setMessage}
              onFocus={() => {
                setShowEmoji(false);
                ref_discussion_ref.current.child(currentid + 'istyping').set(true);
              }}
              onBlur={() => ref_discussion_ref.current.child(currentid + 'istyping').set(false)}
              placeholder="Message..."
              placeholderTextColor="#aaa"
              style={styles.input}
              multiline
            />
            <TouchableOpacity onPress={pickImageFromCamera} style={styles.inputIcon}>
              <Ionicons name="camera-outline" size={25} color="#00897B" />
            </TouchableOpacity>
            <TouchableOpacity onPress={prepareLocation} style={styles.inputIcon}>
              <Ionicons name="location-outline" size={25} color="#00897B" />
            </TouchableOpacity>
            <TouchableOpacity onPress={startRecording} style={styles.inputIcon}>
              <Ionicons name="mic-outline" size={25} color="#00897B" />
            </TouchableOpacity>
            <Pressable
              onPress={sendMessage}
              style={({ pressed }) => [
                styles.sendBtn,
                { opacity: (message.trim() || imageToSend) ? (pressed ? 0.7 : 1) : 0 },
              ]}
              pointerEvents={(message.trim() || imageToSend) ? 'auto' : 'none'}>
              <Ionicons name="send" size={20} color="#fff" />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Full-screen image */}
      <Modal visible={showImageModal} transparent animationType="fade">
        <TouchableOpacity style={styles.imgModalBg} onPress={() => setShowImageModal(false)} activeOpacity={1}>
          {selectedImage && <Image source={{ uri: selectedImage }} style={styles.imgModalImg} resizeMode="contain" />}
          <View style={styles.imgModalClose}>
            <Ionicons name="close-circle" size={36} color="#fff" />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Location confirmation */}
      <Modal visible={showLocModal} transparent animationType="fade">
        <View style={styles.locationModalBg}>
          <View style={styles.locationModalCard}>
            <Ionicons name="location" size={40} color="#00897B" style={{ marginBottom: 10 }} />
            <Text style={styles.locationModalTitle}>Partager votre position ?</Text>
            {pendingLoc && (
              <Text style={styles.locationModalCoords}>
                {pendingLoc.latitude.toFixed(5)}, {pendingLoc.longitude.toFixed(5)}
              </Text>
            )}
            <View style={styles.locationModalBtns}>
              <TouchableOpacity
                style={[styles.locationBtn, { backgroundColor: '#ECEFF1' }]}
                onPress={() => { setShowLocModal(false); setPendingLoc(null); }}>
                <Text style={[styles.locationBtnText, { color: '#555' }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.locationBtn, { backgroundColor: '#00897B' }]}
                onPress={confirmSendLocation}>
                <Text style={styles.locationBtnText}>Envoyer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reactions */}
      <Modal visible={showReactions} transparent animationType="slide">
        <TouchableOpacity style={styles.reactModalBg}
          onPress={() => { setShowReactions(false); setSelectedMsg(null); }} activeOpacity={1}>
          <View style={styles.reactPanel}>
            <View style={styles.reactHandle} />
            <Text style={styles.reactTitle}>Reagir</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              {REACTIONS.map((e) => (
                <TouchableOpacity key={e} onPress={() => reactToMessage(selectedMsg?.key, e)}
                  style={styles.reactEmojiBtn}>
                  <Text style={{ fontSize: 36 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Forward modal */}
      <Modal visible={showForwardModal} transparent animationType="slide">
        <View style={styles.reactModalBg}>
          <View style={[styles.reactPanel, { paddingBottom: 30 }]}>
            <View style={styles.reactHandle} />
            <Text style={styles.reactTitle}>Transférer à...</Text>
            <ScrollView style={{ maxHeight: 320, width: '100%' }}>
              {allContacts.length === 0
                ? <Text style={{ textAlign: 'center', color: '#90A4AE', marginTop: 16 }}>Aucun contact</Text>
                : allContacts.map((c) => (
                  <TouchableOpacity
                    key={c.Id}
                    onPress={() => forwardImageToContact(c)}
                    style={styles.forwardContactRow}>
                    {c.UrlImage
                      ? <Image source={{ uri: c.UrlImage }} style={styles.forwardContactAvatar} />
                      : <View style={[styles.forwardContactAvatar, { backgroundColor: '#00897B', alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons name="person" size={18} color="#fff" />
                        </View>
                    }
                    <Text style={styles.forwardContactName}>{c.Pseudo || c.Nom || 'Utilisateur'}</Text>
                    <Ionicons name="share-outline" size={20} color="#00897B" />
                  </TouchableOpacity>
                ))
              }
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowForwardModal(false)}
              style={[styles.locationBtn, { backgroundColor: '#ECEFF1', marginTop: 12 }]}>
              <Text style={[styles.locationBtnText, { color: '#555' }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Theme picker */}
      <Modal visible={showThemeModal} transparent animationType="slide">
        <TouchableOpacity style={styles.reactModalBg} onPress={() => setShowThemeModal(false)} activeOpacity={1}>
          <View style={[styles.reactPanel, { paddingBottom: 30 }]}>
            <View style={styles.reactHandle} />
            <Text style={styles.reactTitle}>Theme de la discussion</Text>
            <View style={styles.themeGrid}>
              {THEME_PRESETS.map((t) => (
                <TouchableOpacity key={t.id} onPress={() => saveTheme(t)} style={styles.themeChip}>
                  {t.id === 'default' ? (
                    <Image source={require('../assets/backgroundreact.jpg')} style={styles.themeChipImg} />
                  ) : (
                    <View style={[styles.themeChipColor, { backgroundColor: t.preview }]}>
                      {t.dark && (
                        <View style={{ position: 'absolute', bottom: 4, right: 4 }}>
                          <Ionicons name="moon" size={12} color="rgba(255,255,255,0.7)" />
                        </View>
                      )}
                    </View>
                  )}
                  <Text style={styles.themeChipLabel}>{t.label}</Text>
                  {theme.id === t.id && (
                    <View style={styles.themeCheck}>
                      <Ionicons name="checkmark-circle" size={20} color="#25D366" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={pickThemeFromGallery} style={styles.themeChip}>
                <View style={[styles.themeChipColor, { backgroundColor: '#E8EAF6', alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="image-outline" size={24} color="#5C6BC0" />
                </View>
                <Text style={styles.themeChipLabel}>Ma photo</Text>
                {theme.id === 'custom' && (
                  <View style={styles.themeCheck}>
                    <Ionicons name="checkmark-circle" size={20} color="#25D366" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#075E54',
    paddingHorizontal: 8, paddingVertical: 10, elevation: 4,
  },
  headerBtn: { padding: 6 },
  headerAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#128C7E', alignItems: 'center', justifyContent: 'center', marginLeft: 4,
  },
  headerName: { color: '#fff', fontWeight: '700', fontSize: 17, letterSpacing: 0.3 },
  typingLabel: { color: '#B2EBF2', fontSize: 12, fontStyle: 'italic' },

  mediaPanel: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  mediaPanelTitle: { color: '#004D40', fontWeight: '700', fontSize: 13 },
  mediaThumbnail:  { width: 68, height: 68, borderRadius: 8, marginRight: 0, borderWidth: 2, borderColor: '#25D366' },
  forwardBtn:      { flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingVertical: 2, paddingHorizontal: 4 },
  forwardBtnText:  { color: '#00897B', fontSize: 11, fontWeight: '600' },
  forwardContactRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 12, marginBottom: 6, backgroundColor: '#F5F5F5',
  },
  forwardContactAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  forwardContactName: { flex: 1, fontSize: 15, color: '#004D40', fontWeight: '500' },

  msgWrapper:        { width: '100%', paddingHorizontal: 8, marginVertical: 2, flexDirection: 'row' },
  senderWrapper:     { justifyContent: 'flex-end' },
  receiverWrapper:   { justifyContent: 'flex-start' },
  bubble:            { maxWidth: '80%', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, elevation: 1 },
  senderBubble:       { backgroundColor: '#DCF8C6', borderTopRightRadius: 4 },
  receiverBubble:     { backgroundColor: '#fff',    borderTopLeftRadius: 4,  elevation: 2 },
  receiverBubbleDark: { backgroundColor: 'rgba(255,255,255,0.15)', borderTopLeftRadius: 4 },
  msgText:          { fontSize: 15, lineHeight: 21 },
  senderText:       { color: '#1B3A2F' },
  receiverText:     { color: '#1A1A1A' },
  receiverTextDark: { color: '#fff' },

  msgImage: { width: 220, height: 175, borderRadius: 12, marginBottom: 4 },
  tapHint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 6,
    paddingVertical: 3, marginTop: -28, marginBottom: 4,
  },
  tapHintText: { color: '#fff', fontSize: 11 },
  mapImage:    { width: 240, height: 140, borderRadius: 10, marginBottom: 6 },
  mapHint:     { flexDirection: 'row', alignItems: 'center' },
  mapLabel:    { color: '#1565C0', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },

  voiceBubble: { flexDirection: 'row', alignItems: 'center', minWidth: 170, paddingVertical: 4 },
  voiceIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#A5D6A7',
  },
  voiceTitle: { color: '#004D40', fontWeight: '600', fontSize: 14 },
  voiceHint:  { color: '#00897B', fontSize: 11, marginTop: 2 },

  reactionsRow:  { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
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

  recordingBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#B71C1C', paddingVertical: 12, paddingHorizontal: 14,
  },
  recordingDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', marginRight: 8 },
  recordingText:    { flex: 1, color: '#fff', fontWeight: '600', fontSize: 14 },
  cancelRecordBtn:  {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, marginRight: 8,
  },
  cancelRecordText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  sendRecordBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#25D366', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  sendRecordText: { color: '#fff', fontWeight: '700', fontSize: 13 },

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
  sendBtn: {
    backgroundColor: '#075E54', borderRadius: 22,
    width: 42, height: 42, alignItems: 'center', justifyContent: 'center',
    marginLeft: 2, elevation: 2,
  },

  imgModalBg:    { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  imgModalImg:   { width: '100%', height: '85%' },
  imgModalClose: { position: 'absolute', top: 50, right: 16 },

  locationModalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  locationModalCard:   { backgroundColor: '#fff', borderRadius: 24, padding: 28, width: '82%', alignItems: 'center', elevation: 10 },
  locationModalTitle:  { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8, textAlign: 'center' },
  locationModalCoords: { fontSize: 12, color: '#777', marginBottom: 20, textAlign: 'center' },
  locationModalBtns:   { flexDirection: 'row', gap: 12, width: '100%' },
  locationBtn:         { flex: 1, borderRadius: 20, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  locationBtnText:     { fontWeight: '700', fontSize: 15, color: '#fff' },

  reactModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  reactPanel: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingVertical: 16, paddingHorizontal: 16,
  },
  reactHandle:   { width: 36, height: 4, backgroundColor: '#DDD', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  reactTitle:    { textAlign: 'center', fontWeight: '700', color: '#1A1A1A', fontSize: 16, marginBottom: 14 },
  reactEmojiBtn: { padding: 8, marginHorizontal: 4 },

  themeGrid:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 },
  themeChip:      { alignItems: 'center', margin: 8, width: 70 },
  themeChipImg:   { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#25D366' },
  themeChipColor: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#E0E0E0', overflow: 'hidden' },
  themeChipLabel: { fontSize: 11, color: '#555', marginTop: 5, fontWeight: '500', textAlign: 'center' },
  themeCheck:     { position: 'absolute', top: -4, right: -4 },
});

