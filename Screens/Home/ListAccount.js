import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useState, useEffect, useRef } from 'react';
import {
  FlatList,
  Image,
  ImageBackground,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import firebase from '../../Config/index';

const database = firebase.database();
const ref_all_accounts = database.ref('allaccounts');

export default function ListAccount(props) {
  const userid = props.route.params.userid;
  const [data, setdata] = useState([]);
  const [search, setSearch] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedUser, setselectedUser] = useState(null);
  // ─ In-app call states
  const [showCallModal, setShowCallModal]   = useState(false);
  const [callContact,   setCallContact]     = useState(null);
  const [callConnected, setCallConnected]   = useState(false);
  const [callDuration,  setCallDuration]    = useState(0);
  const [incomingCall,  setIncomingCall]    = useState(null);
  const callTimerRef  = useRef(null);
  const callKeyRef    = useRef(null);
  const ringtoneRef   = useRef(null);

  const playRingtone = async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
      // Use a reliable public ringtone URL
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/phone/sounds/phone-calling-1.mp3' },
        { isLooping: true, shouldPlay: true, volume: 1.0 }
      );
      ringtoneRef.current = sound;
    } catch {
      // Ringtone failed silently — call UI still works
    }
  };

  const stopRingtone = async () => {
    if (ringtoneRef.current) {
      try { await ringtoneRef.current.stopAsync(); await ringtoneRef.current.unloadAsync(); } catch {}
      ringtoneRef.current = null;
    }
  };

  useEffect(() => {
    ref_all_accounts.on('value', (snapshot) => {
      const d = [];
      snapshot.forEach((one_account) => {
        d.push(one_account.val());
      });
      setdata(d);
    });
    // Incoming call listener
    const ref_incoming = database.ref('calls').orderByChild('to').equalTo(userid);
    ref_incoming.on('value', (snapshot) => {
      let found = null;
      snapshot.forEach((call) => {
        if (call.val()?.status === 'ringing') found = { ...call.val(), id: call.key };
      });
      setIncomingCall(found);
    });
    return () => {
      ref_all_accounts.off();
      ref_incoming.off();
    };
  }, []);

  // Play ringtone when receiving an incoming call
  useEffect(() => {
    if (incomingCall) {
      playRingtone();
    } else {
      stopRingtone();
    }
  }, [!!incomingCall]);

  const startCall = async (contact) => {
    setCallContact(contact);
    setCallConnected(false);
    setCallDuration(0);
    setShowCallModal(true);
    playRingtone();
    // Signal via Firebase
    const callKey = database.ref('calls').push().key;
    callKeyRef.current = callKey;
    database.ref('calls').child(callKey).set({
      from: userid, to: contact.Id, status: 'ringing', startedAt: Date.now(),
    });
    // Auto-connect after 4 seconds
    setTimeout(async () => {
      await stopRingtone();
      setCallConnected(true);
      callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    }, 4000);
  };

  const endCall = async () => {
    await stopRingtone();
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    if (callKeyRef.current) { database.ref('calls').child(callKeyRef.current).remove(); callKeyRef.current = null; }
    setShowCallModal(false); setCallContact(null); setCallConnected(false); setCallDuration(0);
  };

  const answerIncomingCall = async () => {
    if (!incomingCall) return;
    await stopRingtone();
    database.ref('calls').child(incomingCall.id).update({ status: 'answered' });
    setCallContact(data.find((u) => u.Id === incomingCall.from) || { Pseudo: 'Utilisateur' });
    setCallConnected(true);
    setCallDuration(0);
    callKeyRef.current = incomingCall.id;
    setIncomingCall(null);
    setShowCallModal(true);
    callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
  };

  const declineIncomingCall = async () => {
    if (!incomingCall) return;
    await stopRingtone();
    database.ref('calls').child(incomingCall.id).remove();
    setIncomingCall(null);
  };

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const filteredData = data.filter(
    (item) =>
      item.Id !== userid &&
      (item.Pseudo || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ImageBackground style={styles.container} source={require('../../assets/backgroundreact.jpg')}>
      <Text style={styles.title}>Contacts</Text>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#90A4AE" style={{ marginLeft: 10, marginRight: 6 }} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher par pseudo..."
          placeholderTextColor="#90A4AE"
          style={styles.searchInput}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} style={{ marginRight: 8 }}>
            <Ionicons name="close-circle" size={18} color="#90A4AE" />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={(item, index) => item?.Id ?? index.toString()}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <TouchableOpacity onPress={() => { setIsModalVisible(true); setselectedUser(item); }}>
              <View style={styles.avatarContainer}>
                {item.UrlImage
                  ? <Image style={styles.avatar} source={{ uri: item.UrlImage }} />
                  : <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={26} color="#fff" />
                    </View>
                }
                <View style={styles.onlineDot} />
              </View>
            </TouchableOpacity>

            <View style={styles.itemInfo}>
              <Text numberOfLines={1} style={styles.pseudoText}>
                {item.Pseudo || 'Sans pseudo'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.callButton}
              onPress={() => startCall(item)}
            >
              <Ionicons name="call" size={20} color="#00897B" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.msgButton}
              onPress={() =>
                props.navigation.navigate('Chat', {
                  currentid: userid,
                  secondid: item.Id,
                  secondPseudo: item.Pseudo,
                })
              }
            >
              <Ionicons name="chatbubble-ellipses" size={20} color="#075E54" />
            </TouchableOpacity>
          </View>
        )}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: '#fff', marginTop: 40, fontSize: 15 }}>
            Aucun contact trouvé
          </Text>
        }
      />

      {/* User detail modal */}
      <Modal visible={isModalVisible} transparent animationType="fade" onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>

            {selectedUser?.UrlImage
              ? <Image style={styles.modalAvatar} source={{ uri: selectedUser.UrlImage }} />
              : <View style={[styles.modalAvatar, styles.modalAvatarPlaceholder]}>
                  <Ionicons name="person" size={50} color="#fff" />
                </View>
            }

            <Text style={styles.modalName}>{selectedUser?.Nom || 'Sans nom'}</Text>
            <Text style={styles.modalPseudo}>@{selectedUser?.Pseudo}</Text>

            <View style={styles.modalInfoRow}>
              <Text style={styles.modalInfoIcon}>📱</Text>
              <Text style={styles.modalInfoText}>{selectedUser?.Numero || 'Non renseigné'}</Text>
            </View>
            <View style={styles.modalInfoRow}>
              <Text style={styles.modalInfoIcon}>✉️</Text>
              <Text style={styles.modalInfoText}>{selectedUser?.Email || 'Non renseigné'}</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#00897B' }]}
                onPress={() => selectedUser?.Numero && Linking.openURL(`tel:${selectedUser.Numero}`)}
              >
                <Ionicons name="call" size={18} color="#fff" />
                <Text style={styles.modalBtnText}> Appel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#1976D2' }]}
                onPress={() => selectedUser?.Numero && Linking.openURL(`sms:${selectedUser.Numero}`)}
              >
                <Ionicons name="chatbubble" size={18} color="#fff" />
                <Text style={styles.modalBtnText}> SMS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#C9A84C' }]}
                onPress={() => selectedUser?.Email && Linking.openURL(`mailto:${selectedUser.Email}`)}
              >
                <Ionicons name="mail" size={18} color="#fff" />
                <Text style={styles.modalBtnText}> Email</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.chatFromModalBtn}
              onPress={() => {
                setIsModalVisible(false);
                props.navigation.navigate('Chat', {
                  currentid: userid,
                  secondid: selectedUser.Id,
                  secondPseudo: selectedUser.Pseudo,
                });
              }}
            >
              <Ionicons name="chatbubbles" size={18} color="#fff" />
              <Text style={styles.chatFromModalText}> Ouvrir la conversation</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* In-app calling modal */}
      <Modal visible={showCallModal} transparent animationType="fade">
        <View style={styles.callModalBg}>
          <View style={styles.callCard}>
            {callContact?.UrlImage
              ? <Image source={{ uri: callContact.UrlImage }} style={styles.callAvatar} />
              : <View style={[styles.callAvatar, styles.callAvatarPlaceholder]}>
                  <Ionicons name="person" size={48} color="#fff" />
                </View>
            }
            <Text style={styles.callName}>{callContact?.Pseudo || callContact?.Nom || 'Utilisateur'}</Text>
            <Text style={styles.callStatus}>
              {callConnected ? formatDuration(callDuration) : 'Appel en cours...'}
            </Text>
            <View style={styles.callActions}>
              <TouchableOpacity style={styles.callMuteBtn}>
                <Ionicons name="mic-off-outline" size={26} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.callHangupBtn} onPress={endCall}>
                <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.callSpeakerBtn}>
                <Ionicons name="volume-high-outline" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Incoming call modal */}
      <Modal visible={!!incomingCall} transparent animationType="slide">
        <View style={styles.incomingCallBg}>
          <View style={styles.incomingCallCard}>
            <View style={styles.incomingCallAvatar}>
              <Ionicons name="person" size={44} color="#fff" />
            </View>
            <Text style={styles.incomingCallName}>
              {data.find((u) => u.Id === incomingCall?.from)?.Pseudo || 'Utilisateur'}
            </Text>
            <Text style={styles.incomingCallLabel}>Appel entrant...</Text>
            <View style={styles.incomingCallActions}>
              <TouchableOpacity style={styles.declineBtn} onPress={declineIncomingCall}>
                <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.answerBtn} onPress={answerIncomingCall}>
                <Ionicons name="call" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 50,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 28,
    color: '#fff',
    letterSpacing: 2,
    textShadowColor: '#004D40',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 25,
    marginBottom: 14,
    paddingHorizontal: 14,
    width: '92%',
    borderWidth: 1,
    borderColor: '#B2DFDB',
    elevation: 2,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: '#004D40',
  },
  list: {
    width: '100%',
  },
  itemRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.9)',
    marginBottom: 10,
    marginHorizontal: 12,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderLeftWidth: 4,
    borderLeftColor: '#C9A84C',
    elevation: 3,
    shadowColor: '#004D40',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#C9A84C',
  },
  avatarPlaceholder: {
    backgroundColor: '#00897B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  itemInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  pseudoText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#004D40',
  },
  callButton: {
    backgroundColor: '#E8F5E9',
    borderRadius: 22,
    padding: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#00897B',
  },
  msgButton: {
    backgroundColor: '#00897B',
    borderRadius: 22,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  msgIcon: {
    height: 22,
    width: 22,
    tintColor: '#fff',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '86%',
    alignItems: 'center',
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: '#c0392b',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: '#C9A84C',
    marginBottom: 14,
    marginTop: 8,
  },
  modalAvatarPlaceholder: {
    backgroundColor: '#00897B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#004D40',
    marginBottom: 2,
  },
  modalPseudo: {
    fontSize: 15,
    color: '#00897B',
    marginBottom: 14,
    fontStyle: 'italic',
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    alignSelf: 'flex-start',
    paddingLeft: 10,
  },
  modalInfoIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  modalInfoText: {
    color: '#555',
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    width: '100%',
    gap: 8,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    elevation: 2,
  },
  modalBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  chatFromModalBtn: {
    marginTop: 12,
    backgroundColor: '#004D40',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  chatFromModalText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  // Calling modal styles
  callModalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center',
  },
  callCard: {
    backgroundColor: '#075E54', borderRadius: 28, padding: 36, width: '82%', alignItems: 'center', elevation: 12,
  },
  callAvatar: {
    width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: '#C9A84C', marginBottom: 18,
  },
  callAvatarPlaceholder: {
    backgroundColor: '#00897B', alignItems: 'center', justifyContent: 'center',
  },
  callName: {
    fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 6, textAlign: 'center',
  },
  callStatus: {
    fontSize: 16, color: '#B2DFDB', marginBottom: 36, letterSpacing: 1,
  },
  callActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', width: '100%',
  },
  callMuteBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 30, width: 56, height: 56, alignItems: 'center', justifyContent: 'center',
  },
  callHangupBtn: {
    backgroundColor: '#c0392b', borderRadius: 35, width: 70, height: 70, alignItems: 'center', justifyContent: 'center', elevation: 4,
  },
  callSpeakerBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 30, width: 56, height: 56, alignItems: 'center', justifyContent: 'center',
  },
  incomingCallBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 60,
  },
  incomingCallCard: {
    backgroundColor: '#075E54', borderRadius: 28, padding: 28, width: '90%', alignItems: 'center', elevation: 14,
  },
  incomingCallAvatar: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#00897B', alignItems: 'center', justifyContent: 'center',
    marginBottom: 14, borderWidth: 3, borderColor: '#C9A84C',
  },
  incomingCallName: {
    fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 4,
  },
  incomingCallLabel: {
    fontSize: 14, color: '#B2DFDB', marginBottom: 28,
  },
  incomingCallActions: {
    flexDirection: 'row', gap: 40, alignItems: 'center',
  },
  declineBtn: {
    backgroundColor: '#c0392b', borderRadius: 35, width: 68, height: 68, alignItems: 'center', justifyContent: 'center', elevation: 4,
  },
  answerBtn: {
    backgroundColor: '#27ae60', borderRadius: 35, width: 68, height: 68, alignItems: 'center', justifyContent: 'center', elevation: 4,
  },
});

