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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import firebase from '../../Config/index';
import { supabase } from '../../Config/index';

const database       = firebase.database();
const ref_forum      = database.ref('Forum');
const ref_all_groups = database.ref('AllGroups');
const ref_all_accounts = database.ref('allaccounts');

const EMOJIS = [
  '😀','😂','😍','😎','🥰','😭','😊','🤔','👍','👎',
  '❤️','🔥','🎉','🙏','😅','🤣','😱','🥺','😤','💪',
];
const REACTIONS = ['👍','❤️','😂','😮','😢','😡'];

export default function Groupe(props) {
  const userid = props.route.params.userid;

  const [activeTab,   setActiveTab]   = useState('forum');
  const [myPseudo,    setMyPseudo]    = useState('');
  const [myUrlImage,  setMyUrlImage]  = useState(null);
  const [allUsers,    setAllUsers]    = useState([]);

  // ─── Forum state ────────────────────────────────────────────────────────────
  const [forumData,         setForumData]         = useState([]);
  const [forumMsg,          setForumMsg]           = useState('');
  const [forumImageToSend,  setForumImageToSend]   = useState(null);
  const [showForumEmoji,    setShowForumEmoji]     = useState(false);
  const [forumIsRecording,  setForumIsRecording]   = useState(false);
  const [showForumLocModal, setShowForumLocModal]  = useState(false);
  const [pendingForumLoc,   setPendingForumLoc]    = useState(null);
  const [forumSelectedMsg,  setForumSelectedMsg]   = useState(null);
  const [showForumReact,    setShowForumReact]     = useState(false);
  const forumRef        = useRef(null);
  const forumRecordRef  = useRef(null);

  // ─── Groups state ───────────────────────────────────────────────────────────
  const [groups,           setGroups]           = useState([]);
  const [showCreateModal,  setShowCreateModal]  = useState(false);
  const [newGroupName,     setNewGroupName]     = useState('');
  const [selectedMembers,  setSelectedMembers]  = useState([]);
  const [activeGroup,      setActiveGroup]      = useState(null);
  const [groupMessages,    setGroupMessages]    = useState([]);
  const [groupMsg,         setGroupMsg]         = useState('');
  const [groupImageToSend, setGroupImageToSend] = useState(null);
  const [showGroupEmoji,   setShowGroupEmoji]   = useState(false);
  const [groupIsRecording, setGroupIsRecording] = useState(false);
  const [showGroupLocModal,setShowGroupLocModal]= useState(false);
  const [pendingGroupLoc,  setPendingGroupLoc]  = useState(null);
  const [groupSelectedMsg, setGroupSelectedMsg] = useState(null);
  const [showGroupReact,   setShowGroupReact]   = useState(false);
  const [showGroupInfo,    setShowGroupInfo]    = useState(false);
  const [showEditModal,    setShowEditModal]    = useState(false);
  const [editGroupName,    setEditGroupName]    = useState('');
  const [showAddMembers,   setShowAddMembers]   = useState(false);
  const [selectedImage,    setSelectedImage]    = useState(null);
  const [showImgModal,     setShowImgModal]     = useState(false);
  const groupChatRef    = useRef(null);
  const groupRecordRef  = useRef(null);
  const forumInputRef   = useRef(null);
  const groupInputRef   = useRef(null);

  // ─── Listeners ──────────────────────────────────────────────────────────────
  useEffect(() => {
    ref_all_accounts.child(userid).once('value').then((snap) => {
      setMyPseudo(snap.val()?.Pseudo || 'Anonyme');
      setMyUrlImage(snap.val()?.UrlImage || null);
    });

    ref_forum.on('value', (snapshot) => {
      const d = [];
      snapshot.forEach((m) => d.push({ ...m.val(), key: m.key }));
      setForumData(d);
    });

    ref_all_groups.on('value', (snapshot) => {
      const d = [];
      snapshot.forEach((g) => d.push({ ...g.val(), id: g.key }));
      setGroups(d.filter((g) => g.members && g.members[userid]));
    });

    ref_all_accounts.once('value').then((snapshot) => {
      const d = [];
      snapshot.forEach((u) => { if (u.val()) d.push(u.val()); });
      setAllUsers(d.filter((u) => u.Id !== userid));
    });

    return () => {
      ref_forum.off();
      ref_all_groups.off();
    };
  }, []);

  // Group chat listener
  useEffect(() => {
    if (!activeGroup) return;
    const ref_gchat = ref_all_groups.child(activeGroup.id).child('chat');
    ref_gchat.on('value', (snapshot) => {
      const d = [];
      snapshot.forEach((m) => d.push({ ...m.val(), key: m.key }));
      setGroupMessages(d);
    });
    return () => ref_gchat.off();
  }, [activeGroup?.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (forumData.length > 0) {
      const t = setTimeout(() => forumRef.current?.scrollToEnd({ animated: false }), 80);
      return () => clearTimeout(t);
    }
  }, [forumData.length]);
  useEffect(() => {
    if (groupMessages.length > 0) {
      const t = setTimeout(() => groupChatRef.current?.scrollToEnd({ animated: false }), 80);
      return () => clearTimeout(t);
    }
  }, [groupMessages.length]);

  // Keep activeGroup in sync when groups update
  useEffect(() => {
    if (activeGroup) {
      const updated = groups.find((g) => g.id === activeGroup.id);
      if (updated) setActiveGroup(updated);
    }
  }, [groups]);

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const uploadImage = async (uri) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const arraybuffer = await new Response(blob).arrayBuffer();
    const filename = Date.now() + '.jpg';
    const { error } = await supabase.storage.from('Images').upload(filename, arraybuffer, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('Images').getPublicUrl(filename);
    return data.publicUrl;
  };

  const uploadAudio = async (uri) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const arraybuffer = await new Response(blob).arrayBuffer();
    const filename = Date.now() + '.m4a';
    const { error } = await supabase.storage.from('Images').upload(filename, arraybuffer, { upsert: true, contentType: 'audio/m4a' });
    if (error) throw error;
    const { data } = supabase.storage.from('Images').getPublicUrl(filename);
    return data.publicUrl;
  };

  const playVoice = async (uri) => {
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      sound.setOnPlaybackStatusUpdate((s) => { if (s.didJustFinish) sound.unloadAsync(); });
    } catch (e) { Alert.alert('Lecture impossible', e.message); }
  };

  const timeNow = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // ─── FORUM actions ──────────────────────────────────────────────────────────
  const sendForumMsg = async () => {
    const textContent = forumMsg.trim();
    const imgContent  = forumImageToSend;
    if (!textContent && !imgContent) return;
    setForumMsg(''); setForumImageToSend(null); setShowForumEmoji(false);
    try {
      let msg = textContent; let type = 'text';
      if (imgContent) { msg = await uploadImage(imgContent); type = 'image'; }
      await firebase.database().ref('Forum').push({
        idsender: userid, pseudo: myPseudo, urlImage: myUrlImage, message: msg, time: timeNow(), type,
      });
    } catch (e) {
      Alert.alert("Erreur d'envoi", String(e?.message || e));
      if (!imgContent) setForumMsg(textContent);
    }
  };

  const pickForumCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission requise'); return; }
      const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
      if (!r.canceled) setForumImageToSend(r.assets[0].uri);
    } catch (e) { Alert.alert('Erreur', e.message); }
  };

  const prepareForumLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission refusee'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPendingForumLoc(loc.coords);
      setShowForumLocModal(true);
    } catch (e) { Alert.alert('Erreur', e.message); }
  };

  const confirmForumLocation = async () => {
    if (!pendingForumLoc) return;
    const { latitude, longitude } = pendingForumLoc;
    setShowForumLocModal(false); setPendingForumLoc(null);
    try {
      await ref_forum.push().set({ idsender: userid, pseudo: myPseudo, urlImage: myUrlImage, latitude, longitude, time: timeNow(), type: 'location' });
    } catch (e) { Alert.alert('Erreur', e.message); }
  };

  const startForumRecording = async () => {
    try {
      if (forumRecordRef.current) { await forumRecordRef.current.stopAndUnloadAsync().catch(() => {}); forumRecordRef.current = null; }
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission micro refusee'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      forumRecordRef.current = recording; setForumIsRecording(true);
    } catch (err) { Alert.alert('Erreur micro', err.message); }
  };

  const cancelForumRecording = async () => {
    setForumIsRecording(false);
    try { if (forumRecordRef.current) { await forumRecordRef.current.stopAndUnloadAsync(); forumRecordRef.current = null; } await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }); } catch {}
  };

  const stopSendForumRecording = async () => {
    if (!forumRecordRef.current) return;
    setForumIsRecording(false);
    try {
      await forumRecordRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const uri = forumRecordRef.current.getURI(); forumRecordRef.current = null;
      if (!uri) return;
      const url = await uploadAudio(uri);
      await ref_forum.push().set({ idsender: userid, pseudo: myPseudo, urlImage: myUrlImage, message: url, time: timeNow(), type: 'voice' });
    } catch (err) { Alert.alert('Erreur vocal', err.message); forumRecordRef.current = null; }
  };

  const reactForumMsg = (msgKey, emoji) => {
    if (!msgKey) return;
    ref_forum.child(msgKey).child('reactions').child(emoji).transaction((c) => (c || 0) + 1);
    setShowForumReact(false); setForumSelectedMsg(null);
  };

  // ─── GROUP actions ──────────────────────────────────────────────────────────
  const sendGroupMsg = async () => {
    if (!activeGroup) return;
    const textContent = groupMsg.trim();
    const imgContent  = groupImageToSend;
    if (!textContent && !imgContent) return;
    setGroupMsg(''); setGroupImageToSend(null); setShowGroupEmoji(false);
    try {
      let msg = textContent; let type = 'text';
      if (imgContent) { msg = await uploadImage(imgContent); type = 'image'; }
      await firebase.database().ref('AllGroups/' + activeGroup.id + '/chat').push({
        idsender: userid, pseudo: myPseudo, urlImage: myUrlImage, message: msg, time: timeNow(), type,
      });
    } catch (e) {
      Alert.alert("Erreur d'envoi", String(e?.message || e));
      if (!imgContent) setGroupMsg(textContent);
    }
  };

  const pickGroupCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission requise'); return; }
      const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
      if (!r.canceled) setGroupImageToSend(r.assets[0].uri);
    } catch (e) { Alert.alert('Erreur', e.message); }
  };

  const prepareGroupLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission refusee'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPendingGroupLoc(loc.coords);
      setShowGroupLocModal(true);
    } catch (e) { Alert.alert('Erreur', e.message); }
  };

  const confirmGroupLocation = async () => {
    if (!pendingGroupLoc || !activeGroup) return;
    const { latitude, longitude } = pendingGroupLoc;
    setShowGroupLocModal(false); setPendingGroupLoc(null);
    try {
      const ref_gchat = ref_all_groups.child(activeGroup.id).child('chat');
      await ref_gchat.push().set({ idsender: userid, pseudo: myPseudo, urlImage: myUrlImage, latitude, longitude, time: timeNow(), type: 'location' });
    } catch (e) { Alert.alert('Erreur', e.message); }
  };

  const startGroupRecording = async () => {
    try {
      if (groupRecordRef.current) { await groupRecordRef.current.stopAndUnloadAsync().catch(() => {}); groupRecordRef.current = null; }
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission micro refusee'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      groupRecordRef.current = recording; setGroupIsRecording(true);
    } catch (err) { Alert.alert('Erreur micro', err.message); }
  };

  const cancelGroupRecording = async () => {
    setGroupIsRecording(false);
    try { if (groupRecordRef.current) { await groupRecordRef.current.stopAndUnloadAsync(); groupRecordRef.current = null; } await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }); } catch {}
  };

  const stopSendGroupRecording = async () => {
    if (!groupRecordRef.current || !activeGroup) return;
    setGroupIsRecording(false);
    try {
      await groupRecordRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const uri = groupRecordRef.current.getURI(); groupRecordRef.current = null;
      if (!uri) return;
      const url = await uploadAudio(uri);
      const ref_gchat = ref_all_groups.child(activeGroup.id).child('chat');
      await ref_gchat.push().set({ idsender: userid, pseudo: myPseudo, urlImage: myUrlImage, message: url, time: timeNow(), type: 'voice' });
    } catch (err) { Alert.alert('Erreur vocal', err.message); groupRecordRef.current = null; }
  };

  const reactGroupMsg = (msgKey, emoji) => {
    if (!msgKey || !activeGroup) return;
    ref_all_groups.child(activeGroup.id).child('chat').child(msgKey).child('reactions').child(emoji).transaction((c) => (c || 0) + 1);
    setShowGroupReact(false); setGroupSelectedMsg(null);
  };

  // ─── Delete messages ─────────────────────────────────────────────────────
  const deleteForumMsg = (key) => {
    Alert.alert('Supprimer', 'Supprimer ce message pour tous ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => ref_forum.child(key).remove() },
    ]);
  };

  const deleteGroupMsg = (key) => {
    if (!activeGroup) return;
    Alert.alert('Supprimer', 'Supprimer ce message pour tous ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => ref_all_groups.child(activeGroup.id).child('chat').child(key).remove() },
    ]);
  };

  // ─── Group management ────────────────────────────────────────────────────────
  const toggleMember = (id) => {
    setSelectedMembers((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]);
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) { Alert.alert('Nom requis'); return; }
    if (selectedMembers.length === 0) { Alert.alert('Selectionnez au moins un membre'); return; }
    try {
      const key = ref_all_groups.push().key;
      const members = { [userid]: true };
      selectedMembers.forEach((id) => { members[id] = true; });
      await ref_all_groups.child(key).set({ id: key, name: newGroupName.trim(), creatorId: userid, members, createdAt: new Date().toLocaleString() });
      setShowCreateModal(false); setNewGroupName(''); setSelectedMembers([]);
      setActiveTab('groups');
    } catch (e) { Alert.alert('Erreur création', e.message); }
  };

  const deleteGroup = (group) => {
    Alert.alert('Supprimer', `Supprimer le groupe "${group.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { ref_all_groups.child(group.id).remove(); setActiveGroup(null); } },
    ]);
  };

  const renameGroup = async () => {
    if (!editGroupName.trim()) return;
    await ref_all_groups.child(activeGroup.id).update({ name: editGroupName.trim() });
    setShowEditModal(false); setEditGroupName('');
  };

  const leaveGroup = () => {
    Alert.alert('Quitter', 'Quitter ce groupe ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Quitter', style: 'destructive', onPress: () => { ref_all_groups.child(activeGroup.id).child('members').child(userid).remove(); setActiveGroup(null); } },
    ]);
  };

  const addMembersToGroup = async () => {
    if (!activeGroup || selectedMembers.length === 0) return;
    const updates = {};
    selectedMembers.forEach((id) => { updates[id] = true; });
    await ref_all_groups.child(activeGroup.id).child('members').update(updates);
    setSelectedMembers([]);
    setShowAddMembers(false);
    Alert.alert('Succes', `${selectedMembers.length} membre(s) ajoute(s).`);
  };

  // ─── Shared message renderer ─────────────────────────────────────────────────
  const renderMsg = (item, isMe, onReact) => {
    const reactions = item.reactions ? Object.entries(item.reactions) : [];
    return (
      <TouchableOpacity activeOpacity={0.95} onLongPress={onReact} key={item.key}>
        <View style={[styles.msgWrapper, isMe ? styles.senderWrapper : styles.receiverWrapper]}>
          <View style={[styles.bubble, isMe ? styles.senderBubble : styles.receiverBubble]}>
            {!isMe && <Text style={styles.pseudoLabel}>{item.pseudo}</Text>}

            {item.type === 'image' ? (
              <TouchableOpacity onPress={() => { setSelectedImage(item.message); setShowImgModal(true); }}>
                <Image source={{ uri: item.message }} style={styles.msgImage} resizeMode="cover" />
                <View style={styles.tapHint}>
                  <Ionicons name="expand-outline" size={12} color="#fff" />
                  <Text style={styles.tapHintText}> Agrandir</Text>
                </View>
              </TouchableOpacity>
            ) : item.type === 'location' ? (
              <TouchableOpacity onPress={() => Linking.openURL(`https://www.google.com/maps?q=${item.latitude},${item.longitude}`)}>
                <Image source={{ uri: `https://staticmap.openstreetmap.de/staticmap.php?center=${item.latitude},${item.longitude}&zoom=15&size=260x150&markers=${item.latitude},${item.longitude},red-pushpin` }}
                  style={styles.mapImage} resizeMode="cover" />
                <View style={styles.mapHint}>
                  <Ionicons name="location" size={14} color="#1565C0" />
                  <Text style={styles.mapLabel}> Ouvrir dans Maps</Text>
                </View>
              </TouchableOpacity>
            ) : item.type === 'voice' ? (
              <TouchableOpacity onPress={() => playVoice(item.message)} style={styles.voiceBubble}>
                <View style={styles.voiceIconCircle}>
                  <Ionicons name="mic" size={18} color="#00897B" />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.voiceTitle}>Message vocal</Text>
                  <Text style={styles.voiceHint}>Appuyer pour ecouter</Text>
                </View>
                <Ionicons name="play-circle" size={28} color="#00897B" />
              </TouchableOpacity>
            ) : (
              <Text style={[styles.msgText, isMe ? styles.senderText : styles.receiverText]}>
                {item.message}
              </Text>
            )}

            {reactions.length > 0 && (
              <View style={styles.reactionsRow}>
                {reactions.map(([emoji, count]) => (
                  <View key={emoji} style={styles.reactionBadge}>
                    <Text style={{ fontSize: 12 }}>{emoji}{count > 1 ? ` ${count}` : ''}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.timeText}>{item.time}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Input bar (shared) ──────────────────────────────────────────────────────
  const renderInputBar = ({
    msg, setMsg, imageToSend, setImageToSend,
    showEmoji, setShowEmoji, isRecording,
    onCamera, onLocation, onStartRecord, onCancelRecord, onSendRecord, onSend,
    inputRef,
  }) => (
    <>
      {imageToSend && (
        <View style={styles.previewBar}>
          <Image source={{ uri: imageToSend }} style={styles.previewImg} />
          <Text style={{ flex: 1, color: '#004D40', marginLeft: 8, fontSize: 12 }}>Photo prete</Text>
          <TouchableOpacity onPress={() => setImageToSend(null)}>
            <Ionicons name="close-circle" size={24} color="#c0392b" />
          </TouchableOpacity>
        </View>
      )}
      {showEmoji && !isRecording && (
        <View style={styles.emojiPanel}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            {EMOJIS.map((e) => (
              <TouchableOpacity key={e} onPress={() => setMsg((m) => m + e)} style={styles.emojiBtn}>
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      {isRecording ? (
        <View style={styles.recordingBar}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Enregistrement...</Text>
          <TouchableOpacity onPress={onCancelRecord} style={styles.cancelRecordBtn}>
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={styles.cancelRecordText}> Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSendRecord} style={styles.sendRecordBtn}>
            <Ionicons name="send" size={16} color="#fff" />
            <Text style={styles.sendRecordText}> Envoyer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.inputBar}>
          <TouchableOpacity onPress={() => setShowEmoji((v) => !v)} style={styles.inputIcon}>
            <Ionicons name={showEmoji ? 'happy' : 'happy-outline'} size={24} color="#00897B" />
          </TouchableOpacity>
          <TextInput ref={inputRef} value={msg} onChangeText={setMsg} placeholder="Message..." placeholderTextColor="#aaa"
            style={styles.input} multiline onFocus={() => setShowEmoji(false)} />
          <TouchableOpacity onPress={onCamera} style={styles.inputIcon}>
            <Ionicons name="camera-outline" size={23} color="#00897B" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onLocation} style={styles.inputIcon}>
            <Ionicons name="location-outline" size={23} color="#00897B" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onStartRecord} style={styles.inputIcon}>
            <Ionicons name="mic-outline" size={23} color="#00897B" />
          </TouchableOpacity>
          <Pressable
            onPress={onSend}
            style={({ pressed }) => [
              styles.sendBtn,
              { opacity: (msg.trim() || imageToSend) ? (pressed ? 0.7 : 1) : 0 },
            ]}
            pointerEvents={(msg.trim() || imageToSend) ? 'auto' : 'none'}>
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      )}
    </>
  );

  // ─── FORUM VIEW ──────────────────────────────────────────────────────────────
  const renderForum = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={60}>
      <ScrollView
        ref={forumRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 4 }}
      >
        {forumData.map((item) => (
          <View key={item.key}>
            {renderMsg(item, item.idsender === userid, () => {
              if (item.idsender === userid) {
                Alert.alert('Message', undefined, [
                  { text: '😊 Réagir', onPress: () => { setForumSelectedMsg(item); setShowForumReact(true); } },
                  { text: '🗑️ Supprimer', style: 'destructive', onPress: () => deleteForumMsg(item.key) },
                  { text: 'Annuler', style: 'cancel' },
                ]);
              } else { setForumSelectedMsg(item); setShowForumReact(true); }
            })}
          </View>
        ))}
      </ScrollView>
      {renderInputBar({
        msg: forumMsg, setMsg: setForumMsg,
        imageToSend: forumImageToSend, setImageToSend: setForumImageToSend,
        showEmoji: showForumEmoji, setShowEmoji: setShowForumEmoji,
        isRecording: forumIsRecording,
        onCamera: pickForumCamera,
        onLocation: prepareForumLocation,
        onStartRecord: startForumRecording,
        onCancelRecord: cancelForumRecording,
        onSendRecord: stopSendForumRecording,
        onSend: sendForumMsg,
        inputRef: forumInputRef,
      })}
    </KeyboardAvoidingView>
  );

  // ─── GROUP CHAT VIEW ─────────────────────────────────────────────────────────
  const renderGroupChat = () => (
    <View style={{ flex: 1 }}>
      {/* Group header */}
      <View style={styles.groupHeader}>
        <TouchableOpacity onPress={() => { setActiveGroup(null); setGroupMessages([]); }} style={{ marginRight: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.groupHeaderAvatar}>
          <Ionicons name="people" size={18} color="#fff" />
        </View>
        <Text style={styles.groupTitle} numberOfLines={1}>{activeGroup.name}</Text>
        <TouchableOpacity onPress={() => setShowGroupInfo(true)} style={styles.headerBtn}>
          <Ionicons name="information-circle-outline" size={24} color="#fff" />
        </TouchableOpacity>
        {activeGroup.creatorId === userid && (
          <TouchableOpacity onPress={() => deleteGroup(activeGroup)} style={styles.headerBtn}>
            <Ionicons name="trash-outline" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={60}>
        <ScrollView
          ref={groupChatRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 4 }}
        >
          {groupMessages.map((item) => (
            <View key={item.key}>
              {renderMsg(item, item.idsender === userid, () => {
                if (item.idsender === userid) {
                  Alert.alert('Message', undefined, [
                    { text: '😊 Réagir', onPress: () => { setGroupSelectedMsg(item); setShowGroupReact(true); } },
                    { text: '🗑️ Supprimer', style: 'destructive', onPress: () => deleteGroupMsg(item.key) },
                    { text: 'Annuler', style: 'cancel' },
                  ]);
                } else { setGroupSelectedMsg(item); setShowGroupReact(true); }
              })}
            </View>
          ))}
        </ScrollView>
        {renderInputBar({
          msg: groupMsg, setMsg: setGroupMsg,
          imageToSend: groupImageToSend, setImageToSend: setGroupImageToSend,
          showEmoji: showGroupEmoji, setShowEmoji: setShowGroupEmoji,
          isRecording: groupIsRecording,
          onCamera: pickGroupCamera,
          onLocation: prepareGroupLocation,
          onStartRecord: startGroupRecording,
          onCancelRecord: cancelGroupRecording,
          onSendRecord: stopSendGroupRecording,
          onSend: sendGroupMsg,
          inputRef: groupInputRef,
        })}
      </KeyboardAvoidingView>
    </View>
  );

  // ─── GROUPS LIST VIEW ────────────────────────────────────────────────────────
  const renderGroups = () => (
    <View style={{ flex: 1 }}>
      <TouchableOpacity style={styles.createGroupBtn} onPress={() => { setSelectedMembers([]); setShowCreateModal(true); }}>
        <Ionicons name="add-circle" size={22} color="#fff" />
        <Text style={styles.createGroupText}> Creer un groupe</Text>
      </TouchableOpacity>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.groupCard} onPress={() => setActiveGroup(item)}>
            <View style={styles.groupIconCircle}>
              <Ionicons name="people" size={26} color="#00897B" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.groupName}>{item.name}</Text>
              <Text style={styles.groupMeta}>
                {Object.keys(item.members || {}).length} membres · {item.createdAt}
              </Text>
            </View>
            {item.creatorId === userid && (
              <View style={styles.adminBadge}><Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Admin</Text></View>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 12 }}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucun groupe pour l'instant</Text>}
      />
    </View>
  );

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <ImageBackground style={styles.container} source={require('../../assets/backgroundreact.jpg')}>
      <Text style={styles.pageTitle}>Groupes</Text>

      {!activeGroup && (
        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'forum' && styles.tabBtnActive]}
            onPress={() => setActiveTab('forum')}>
            <Text style={[styles.tabText, activeTab === 'forum' && styles.tabTextActive]}>🌐 Forum</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'groups' && styles.tabBtnActive]}
            onPress={() => setActiveTab('groups')}>
            <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>👥 Groupes</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeGroup ? renderGroupChat() : activeTab === 'forum' ? renderForum() : renderGroups()}

      {/* ── Create group modal ── */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Creer un groupe</Text>
            <TextInput value={newGroupName} onChangeText={setNewGroupName}
              placeholder="Nom du groupe" placeholderTextColor="#90A4AE" style={styles.modalInput} />
            <Text style={styles.sectionLabel}>Membres :</Text>
            <ScrollView style={{ maxHeight: 220, width: '100%' }}>
              {allUsers.map((u) => (
                <TouchableOpacity key={u.Id} onPress={() => toggleMember(u.Id)}
                  style={[styles.memberRow, selectedMembers.includes(u.Id) && styles.memberRowSelected]}>
                  {u.UrlImage
                    ? <Image source={{ uri: u.UrlImage }} style={styles.memberAvatar} />
                    : <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                        <Ionicons name="person" size={18} color="#fff" />
                      </View>
                  }
                  <Text style={styles.memberName}>{u.Pseudo || u.Nom || 'Utilisateur'}</Text>
                  {selectedMembers.includes(u.Id) && <Ionicons name="checkmark-circle" size={22} color="#00897B" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', marginTop: 16, gap: 10 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ccc', flex: 1 }]}
                onPress={() => { setShowCreateModal(false); setNewGroupName(''); setSelectedMembers([]); }}>
                <Text style={{ color: '#333', fontWeight: 'bold' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#00897B', flex: 1 }]} onPress={createGroup}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Creer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Group info modal ── */}
      <Modal visible={showGroupInfo} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{activeGroup?.name}</Text>
            <Text style={{ color: '#00897B', marginBottom: 8, fontSize: 13 }}>Cree le {activeGroup?.createdAt}</Text>
            <Text style={styles.sectionLabel}>Membres ({Object.keys(activeGroup?.members || {}).length}) :</Text>
            <ScrollView style={{ maxHeight: 160, width: '100%' }}>
              {allUsers.filter((u) => activeGroup?.members?.[u.Id]).map((u) => (
                <View key={u.Id} style={styles.memberRow}>
                  {u.UrlImage
                    ? <Image source={{ uri: u.UrlImage }} style={styles.memberAvatar} />
                    : <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                        <Ionicons name="person" size={18} color="#fff" />
                      </View>
                  }
                  <Text style={styles.memberName}>{u.Pseudo || u.Nom}</Text>
                  {activeGroup?.creatorId === u.Id && (
                    <View style={styles.adminBadge}><Text style={{ color: '#fff', fontSize: 10 }}>Admin</Text></View>
                  )}
                </View>
              ))}
              {/* Also show current user */}
              <View style={styles.memberRow}>
                {myUrlImage
                  ? <Image source={{ uri: myUrlImage }} style={styles.memberAvatar} />
                  : <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                      <Ionicons name="person" size={18} color="#fff" />
                    </View>
                }
                <Text style={styles.memberName}>{myPseudo} (moi)</Text>
                {activeGroup?.creatorId === userid && (
                  <View style={styles.adminBadge}><Text style={{ color: '#fff', fontSize: 10 }}>Admin</Text></View>
                )}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', marginTop: 14, gap: 8, flexWrap: 'wrap' }}>
              {activeGroup?.creatorId === userid && (
                <>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#1976D2' }]}
                    onPress={() => { setShowGroupInfo(false); setEditGroupName(activeGroup.name); setShowEditModal(true); }}>
                    <Ionicons name="pencil" size={14} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 4 }}>Renommer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#00897B' }]}
                    onPress={() => { setShowGroupInfo(false); setSelectedMembers([]); setShowAddMembers(true); }}>
                    <Ionicons name="person-add" size={14} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 4 }}>Ajouter</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#e74c3c' }]}
                onPress={() => { setShowGroupInfo(false); leaveGroup(); }}>
                <Ionicons name="exit-outline" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 4 }}>Quitter</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ccc' }]}
                onPress={() => setShowGroupInfo(false)}>
                <Text style={{ color: '#333', fontWeight: 'bold' }}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add members modal ── */}
      <Modal visible={showAddMembers} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ajouter des membres</Text>
            <ScrollView style={{ maxHeight: 260, width: '100%' }}>
              {allUsers.filter((u) => !activeGroup?.members?.[u.Id]).map((u) => (
                <TouchableOpacity key={u.Id} onPress={() => toggleMember(u.Id)}
                  style={[styles.memberRow, selectedMembers.includes(u.Id) && styles.memberRowSelected]}>
                  {u.UrlImage
                    ? <Image source={{ uri: u.UrlImage }} style={styles.memberAvatar} />
                    : <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                        <Ionicons name="person" size={18} color="#fff" />
                      </View>
                  }
                  <Text style={styles.memberName}>{u.Pseudo || u.Nom || 'Utilisateur'}</Text>
                  {selectedMembers.includes(u.Id) && <Ionicons name="checkmark-circle" size={22} color="#00897B" />}
                </TouchableOpacity>
              ))}
              {allUsers.filter((u) => !activeGroup?.members?.[u.Id]).length === 0 && (
                <Text style={{ color: '#90A4AE', textAlign: 'center', marginTop: 20 }}>
                  Tous les utilisateurs sont deja membres
                </Text>
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', marginTop: 16, gap: 10 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ccc', flex: 1 }]}
                onPress={() => { setShowAddMembers(false); setSelectedMembers([]); }}>
                <Text style={{ color: '#333', fontWeight: 'bold' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#00897B', flex: 1 }]} onPress={addMembersToGroup}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Ajouter ({selectedMembers.length})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Rename group modal ── */}
      <Modal visible={showEditModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Renommer le groupe</Text>
            <TextInput value={editGroupName} onChangeText={setEditGroupName} style={styles.modalInput}
              placeholder="Nouveau nom" placeholderTextColor="#90A4AE" />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ccc', flex: 1 }]} onPress={() => setShowEditModal(false)}>
                <Text style={{ color: '#333', fontWeight: 'bold' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#00897B', flex: 1 }]} onPress={renameGroup}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Renommer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Full image modal ── */}
      <Modal visible={showImgModal} transparent animationType="fade">
        <TouchableOpacity style={styles.imgModalBg} onPress={() => setShowImgModal(false)} activeOpacity={1}>
          {selectedImage && <Image source={{ uri: selectedImage }} style={styles.imgModalImg} resizeMode="contain" />}
          <View style={styles.imgModalClose}><Ionicons name="close-circle" size={36} color="#fff" /></View>
        </TouchableOpacity>
      </Modal>

      {/* ── Reactions (forum) ── */}
      <Modal visible={showForumReact} transparent animationType="slide">
        <TouchableOpacity style={styles.reactModalBg}
          onPress={() => { setShowForumReact(false); setForumSelectedMsg(null); }} activeOpacity={1}>
          <View style={styles.reactPanel}>
            <View style={styles.reactHandle} />
            <Text style={styles.reactTitle}>Reagir</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              {REACTIONS.map((e) => (
                <TouchableOpacity key={e} onPress={() => reactForumMsg(forumSelectedMsg?.key, e)} style={styles.reactEmojiBtn}>
                  <Text style={{ fontSize: 34 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Reactions (group) ── */}
      <Modal visible={showGroupReact} transparent animationType="slide">
        <TouchableOpacity style={styles.reactModalBg}
          onPress={() => { setShowGroupReact(false); setGroupSelectedMsg(null); }} activeOpacity={1}>
          <View style={styles.reactPanel}>
            <View style={styles.reactHandle} />
            <Text style={styles.reactTitle}>Reagir</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              {REACTIONS.map((e) => (
                <TouchableOpacity key={e} onPress={() => reactGroupMsg(groupSelectedMsg?.key, e)} style={styles.reactEmojiBtn}>
                  <Text style={{ fontSize: 34 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Location confirmation (forum) ── */}
      <Modal visible={showForumLocModal} transparent animationType="fade">
        <View style={styles.locationModalBg}>
          <View style={styles.locationModalCard}>
            <Ionicons name="location" size={36} color="#00897B" style={{ marginBottom: 8 }} />
            <Text style={styles.locationModalTitle}>Partager votre position ?</Text>
            {pendingForumLoc && (
              <Text style={styles.locationModalCoords}>
                {pendingForumLoc.latitude.toFixed(5)}, {pendingForumLoc.longitude.toFixed(5)}
              </Text>
            )}
            <View style={styles.locationModalBtns}>
              <TouchableOpacity style={[styles.locationBtn, { backgroundColor: '#ECEFF1' }]}
                onPress={() => { setShowForumLocModal(false); setPendingForumLoc(null); }}>
                <Text style={[styles.locationBtnText, { color: '#555' }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.locationBtn, { backgroundColor: '#00897B' }]} onPress={confirmForumLocation}>
                <Text style={styles.locationBtnText}>Envoyer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Location confirmation (group) ── */}
      <Modal visible={showGroupLocModal} transparent animationType="fade">
        <View style={styles.locationModalBg}>
          <View style={styles.locationModalCard}>
            <Ionicons name="location" size={36} color="#00897B" style={{ marginBottom: 8 }} />
            <Text style={styles.locationModalTitle}>Partager votre position ?</Text>
            {pendingGroupLoc && (
              <Text style={styles.locationModalCoords}>
                {pendingGroupLoc.latitude.toFixed(5)}, {pendingGroupLoc.longitude.toFixed(5)}
              </Text>
            )}
            <View style={styles.locationModalBtns}>
              <TouchableOpacity style={[styles.locationBtn, { backgroundColor: '#ECEFF1' }]}
                onPress={() => { setShowGroupLocModal(false); setPendingGroupLoc(null); }}>
                <Text style={[styles.locationBtnText, { color: '#555' }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.locationBtn, { backgroundColor: '#00897B' }]} onPress={confirmGroupLocation}>
                <Text style={styles.locationBtnText}>Envoyer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  pageTitle: {
    fontWeight: 'bold', fontSize: 26, color: '#fff', letterSpacing: 2,
    textShadowColor: '#004D40', textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 4,
    fontStyle: 'italic', textAlign: 'center', paddingTop: 52, paddingBottom: 10,
  },
  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 25, padding: 4,
  },
  tabBtn:        { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 22 },
  tabBtnActive:  { backgroundColor: '#fff', elevation: 3 },
  tabText:       { color: 'rgba(255,255,255,0.8)', fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#004D40', fontWeight: '700' },

  groupHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#075E54', paddingHorizontal: 8, paddingVertical: 10, elevation: 4,
  },
  headerBtn: { padding: 6 },
  groupHeaderAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#128C7E', alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  groupTitle: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 17 },

  createGroupBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00897B', marginHorizontal: 16, marginBottom: 12, marginTop: 4,
    borderRadius: 20, paddingVertical: 12, elevation: 2, borderWidth: 1, borderColor: '#C9A84C',
  },
  createGroupText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  groupCard: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.92)', marginBottom: 10,
    borderRadius: 18, padding: 14, alignItems: 'center', elevation: 3,
    borderLeftWidth: 4, borderLeftColor: '#C9A84C',
  },
  groupIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#A5D6A7',
  },
  groupName: { fontWeight: '700', fontSize: 16, color: '#004D40' },
  groupMeta: { color: '#78909C', fontSize: 12, marginTop: 2 },
  adminBadge: {
    backgroundColor: '#00897B', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  emptyText: { textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 15, marginTop: 40 },

  msgWrapper:    { width: '100%', paddingHorizontal: 8, marginVertical: 2, flexDirection: 'row' },
  senderWrapper: { justifyContent: 'flex-end' },
  receiverWrapper: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, elevation: 1 },
  senderBubble:   { backgroundColor: '#DCF8C6', borderTopRightRadius: 4 },
  receiverBubble: { backgroundColor: '#fff',    borderTopLeftRadius: 4, elevation: 2 },
  pseudoLabel: { fontSize: 12, color: '#00897B', fontWeight: '700', marginBottom: 4 },
  msgText:      { fontSize: 15, lineHeight: 21 },
  senderText:   { color: '#1B3A2F' },
  receiverText: { color: '#1A1A1A' },
  timeText: { fontSize: 11, color: '#75A58B', textAlign: 'right', marginTop: 4 },

  msgImage: { width: 210, height: 160, borderRadius: 10, marginBottom: 4 },
  tapHint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 6,
    paddingVertical: 3, marginTop: -26, marginBottom: 4,
  },
  tapHintText: { color: '#fff', fontSize: 11 },
  mapImage: { width: 220, height: 130, borderRadius: 10, marginBottom: 6 },
  mapHint:  { flexDirection: 'row', alignItems: 'center' },
  mapLabel: { color: '#1565C0', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },

  voiceBubble: { flexDirection: 'row', alignItems: 'center', minWidth: 160, paddingVertical: 4 },
  voiceIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#A5D6A7',
  },
  voiceTitle: { color: '#004D40', fontWeight: '600', fontSize: 13 },
  voiceHint:  { color: '#00897B', fontSize: 11, marginTop: 1 },

  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  reactionBadge: {
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 10,
    paddingHorizontal: 5, paddingVertical: 1, marginRight: 4, marginTop: 2,
    borderWidth: 1, borderColor: '#E0E0E0',
  },

  previewBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#E8F5E9', borderTopWidth: 1, borderTopColor: '#C8E6C9',
  },
  previewImg: { width: 44, height: 44, borderRadius: 6, borderWidth: 2, borderColor: '#25D366' },

  emojiPanel: {
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E0E0E0',
    paddingVertical: 8, paddingHorizontal: 4, maxHeight: 170,
  },
  emojiBtn: { margin: 2, padding: 3 },

  recordingBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#B71C1C', paddingVertical: 10, paddingHorizontal: 12,
  },
  recordingDot:     { width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff', marginRight: 8 },
  recordingText:    { flex: 1, color: '#fff', fontWeight: '600', fontSize: 13 },
  cancelRecordBtn:  {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 18,
    paddingHorizontal: 10, paddingVertical: 5, marginRight: 6,
  },
  cancelRecordText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  sendRecordBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#25D366', borderRadius: 18,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  sendRecordText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  inputBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F6F6F6', paddingVertical: 8, paddingHorizontal: 8,
    borderTopWidth: 1, borderTopColor: '#E0E0E0',
  },
  inputIcon: { padding: 5 },
  input: {
    flex: 1, backgroundColor: '#fff', borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 9 : 5,
    fontSize: 14, color: '#1A1A1A', maxHeight: 100,
    marginHorizontal: 4, borderWidth: 1, borderColor: '#E0E0E0',
  },
  sendBtn: {
    backgroundColor: '#075E54', borderRadius: 20,
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    marginLeft: 2, elevation: 2,
  },

  imgModalBg:    { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  imgModalImg:   { width: '100%', height: '85%' },
  imgModalClose: { position: 'absolute', top: 50, right: 16 },

  locationModalBg:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  locationModalCard: { backgroundColor: '#fff', borderRadius: 22, padding: 24, width: '82%', alignItems: 'center', elevation: 10 },
  locationModalTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 6, textAlign: 'center' },
  locationModalCoords: { fontSize: 12, color: '#777', marginBottom: 18, textAlign: 'center' },
  locationModalBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  locationBtn:       { flex: 1, borderRadius: 18, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  locationBtnText:   { fontWeight: '700', fontSize: 14, color: '#fff' },

  reactModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  reactPanel: {
    backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingVertical: 14, paddingHorizontal: 14,
  },
  reactHandle:   { width: 34, height: 4, backgroundColor: '#DDD', borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  reactTitle:    { textAlign: 'center', fontWeight: '700', color: '#1A1A1A', fontSize: 15, marginBottom: 12 },
  reactEmojiBtn: { padding: 6, marginHorizontal: 3 },

  modalBg:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard:  { backgroundColor: '#fff', borderRadius: 22, padding: 22, width: '90%', alignItems: 'center', elevation: 10, maxHeight: '85%' },
  modalTitle: { fontWeight: 'bold', fontSize: 19, color: '#004D40', marginBottom: 14, textAlign: 'center' },
  modalInput: {
    width: '100%', borderRadius: 12, borderWidth: 1, borderColor: '#B2DFDB',
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#004D40',
    backgroundColor: '#F1FFFE', marginBottom: 12,
  },
  modalBtn: {
    borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', elevation: 1,
  },
  sectionLabel: { fontWeight: '700', color: '#00897B', fontSize: 13, alignSelf: 'flex-start', marginBottom: 6 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 10, marginBottom: 4, backgroundColor: '#F5F5F5',
  },
  memberRowSelected: { backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#A5D6A7' },
  memberAvatar: { width: 38, height: 38, borderRadius: 19, marginRight: 10 },
  memberAvatarPlaceholder: { backgroundColor: '#00897B', alignItems: 'center', justifyContent: 'center' },
  memberName: { flex: 1, fontSize: 14, color: '#004D40', fontWeight: '500' },
});

