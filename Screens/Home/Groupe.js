import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
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

const database = firebase.database();
const ref_forum = database.ref('Forum');
const ref_all_groups = database.ref('AllGroups');
const ref_all_accounts = database.ref('allaccounts');

export default function Groupe(props) {
  const userid = props.route.params.userid;

  const [activeTab, setActiveTab] = useState('forum');

  // Forum
  const [forumData, setForumData] = useState([]);
  const [forumMessage, setForumMessage] = useState('');
  const [myPseudo, setMyPseudo] = useState('');
  const forumRef = useRef(null);

  // Groups
  const [groups, setGroups] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);

  // Group chat
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupMessages, setGroupMessages] = useState([]);
  const [groupMessage, setGroupMessage] = useState('');
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const groupChatRef = useRef(null);

  useEffect(() => {
    ref_all_accounts.child(userid).once('value').then((snap) => {
      setMyPseudo(snap.val()?.Pseudo || 'Anonyme');
    });

    ref_forum.on('value', (snapshot) => {
      const d = [];
      snapshot.forEach((msg) => d.push(msg.val()));
      setForumData(d);
    });

    ref_all_groups.on('value', (snapshot) => {
      const d = [];
      snapshot.forEach((g) => d.push({ ...g.val(), id: g.key }));
      setGroups(d.filter((g) => g.members && g.members[userid]));
    });

    ref_all_accounts.on('value', (snapshot) => {
      const d = [];
      snapshot.forEach((u) => d.push(u.val()));
      setAllUsers(d.filter((u) => u.Id !== userid));
    });

    return () => {
      ref_forum.off();
      ref_all_groups.off();
      ref_all_accounts.off();
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

  const sendForumMessage = () => {
    if (!forumMessage.trim()) return;
    const key = ref_forum.push().key;
    ref_forum.child(key).set({
      idsender: userid,
      pseudo: myPseudo,
      message: forumMessage.trim(),
      time: new Date().toLocaleString(),
    });
    setForumMessage('');
  };

  const createGroup = () => {
    if (!newGroupName.trim()) { Alert.alert('Nom requis'); return; }
    if (selectedMembers.length === 0) { Alert.alert('Sélectionnez au moins un membre'); return; }
    const key = ref_all_groups.push().key;
    const members = { [userid]: true };
    selectedMembers.forEach((id) => { members[id] = true; });
    ref_all_groups.child(key).set({
      id: key,
      name: newGroupName.trim(),
      creatorId: userid,
      members,
      createdAt: new Date().toLocaleString(),
    });
    setShowCreateModal(false);
    setNewGroupName('');
    setSelectedMembers([]);
  };

  const deleteGroup = (group) => {
    Alert.alert('Supprimer', `Supprimer le groupe "${group.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: () => {
          ref_all_groups.child(group.id).remove();
          if (activeGroup?.id === group.id) setActiveGroup(null);
        },
      },
    ]);
  };

  const renameGroup = () => {
    if (!editGroupName.trim()) return;
    ref_all_groups.child(activeGroup.id).update({ name: editGroupName.trim() });
    setActiveGroup({ ...activeGroup, name: editGroupName.trim() });
    setShowEditModal(false);
    setEditGroupName('');
  };

  const leaveGroup = () => {
    Alert.alert('Quitter', 'Quitter ce groupe ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Quitter', style: 'destructive',
        onPress: () => {
          ref_all_groups.child(activeGroup.id).child('members').child(userid).remove();
          setActiveGroup(null);
        },
      },
    ]);
  };

  const sendGroupMessage = () => {
    if (!groupMessage.trim() || !activeGroup) return;
    const key = ref_all_groups.child(activeGroup.id).child('chat').push().key;
    ref_all_groups.child(activeGroup.id).child('chat').child(key).set({
      idsender: userid,
      pseudo: myPseudo,
      message: groupMessage.trim(),
      time: new Date().toLocaleString(),
      type: 'text',
    });
    setGroupMessage('');
  };

  const toggleMember = (id) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  // ─── FORUM VIEW ────────────────────────────────────────────────────────────
  const renderForum = () => (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={forumRef}
        data={forumData}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => {
          const isMe = item.idsender === userid;
          return (
            <View style={[styles.msgWrapper, isMe ? styles.senderWrapper : styles.receiverWrapper]}>
              <View style={[styles.bubble, isMe ? styles.senderBubble : styles.receiverBubble]}>
                {!isMe && <Text style={styles.pseudoLabel}>{item.pseudo}</Text>}
                <Text style={styles.msgText}>{item.message}</Text>
                <Text style={styles.timeText}>{item.time}</Text>
              </View>
            </View>
          );
        }}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: 8 }}
        onContentSizeChange={() => forumRef.current?.scrollToEnd({ animated: true })}
      />
      <View style={styles.inputRow}>
        <TextInput
          value={forumMessage}
          onChangeText={setForumMessage}
          placeholder="Message au forum..."
          placeholderTextColor="#90A4AE"
          style={styles.input}
          multiline
        />
        <TouchableOpacity onPress={sendForumMessage} style={styles.sendBtn}>
          <Image source={require('../../assets/message.png')} style={{ width: 22, height: 22, tintColor: '#fff' }} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── GROUP CHAT VIEW ────────────────────────────────────────────────────────
  const renderGroupChat = () => (
    <View style={{ flex: 1 }}>
      {/* Group header */}
      <View style={styles.groupHeader}>
        <TouchableOpacity onPress={() => setActiveGroup(null)} style={{ marginRight: 10 }}>
          <Text style={{ color: '#fff', fontSize: 28, lineHeight: 28 }}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.groupTitle} numberOfLines={1}>{activeGroup.name}</Text>
        <TouchableOpacity onPress={() => setShowGroupInfo(true)} style={{ marginLeft: 8 }}>
          <Text style={{ fontSize: 22 }}>ℹ️</Text>
        </TouchableOpacity>
        {activeGroup.creatorId === userid && (
          <TouchableOpacity onPress={() => deleteGroup(activeGroup)} style={{ marginLeft: 8 }}>
            <Text style={{ fontSize: 22 }}>🗑️</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        ref={groupChatRef}
        data={groupMessages}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => {
          const isMe = item.idsender === userid;
          return (
            <View style={[styles.msgWrapper, isMe ? styles.senderWrapper : styles.receiverWrapper]}>
              <View style={[styles.bubble, isMe ? styles.senderBubble : styles.receiverBubble]}>
                {!isMe && <Text style={styles.pseudoLabel}>{item.pseudo}</Text>}
                <Text style={styles.msgText}>{item.message}</Text>
                <Text style={styles.timeText}>{item.time}</Text>
              </View>
            </View>
          );
        }}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: 8 }}
        onContentSizeChange={() => groupChatRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.inputRow}>
        <TextInput
          value={groupMessage}
          onChangeText={setGroupMessage}
          placeholder={`Message dans ${activeGroup.name}...`}
          placeholderTextColor="#90A4AE"
          style={styles.input}
          multiline
        />
        <TouchableOpacity onPress={sendGroupMessage} style={styles.sendBtn}>
          <Image source={require('../../assets/message.png')} style={{ width: 22, height: 22, tintColor: '#fff' }} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── GROUPS LIST VIEW ───────────────────────────────────────────────────────
  const renderGroups = () => (
    <View style={{ flex: 1 }}>
      <TouchableOpacity style={styles.createGroupBtn} onPress={() => setShowCreateModal(true)}>
        <Text style={styles.createGroupText}>＋ Créer un groupe</Text>
      </TouchableOpacity>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.groupCard} onPress={() => setActiveGroup(item)}>
            <View style={styles.groupIconCircle}>
              <Text style={{ fontSize: 26 }}>👥</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.groupName}>{item.name}</Text>
              <Text style={styles.groupMeta}>
                {Object.keys(item.members || {}).length} membres · {item.createdAt}
              </Text>
            </View>
            {item.creatorId === userid && (
              <View style={styles.adminBadge}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Admin</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 12 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Vous n'avez rejoint aucun groupe</Text>
        }
      />
    </View>
  );

  return (
    <ImageBackground style={styles.container} source={require('../../assets/backgroundreact.jpg')}>
      <Text style={styles.pageTitle}>Groupes</Text>

      {/* Tab bar (only when not in group chat) */}
      {!activeGroup && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'forum' && styles.tabBtnActive]}
            onPress={() => setActiveTab('forum')}
          >
            <Text style={[styles.tabText, activeTab === 'forum' && styles.tabTextActive]}>
              🌐 Forum
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'groups' && styles.tabBtnActive]}
            onPress={() => setActiveTab('groups')}
          >
            <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>
              👥 Groupes
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {activeGroup
        ? renderGroupChat()
        : activeTab === 'forum'
        ? renderForum()
        : renderGroups()
      }

      {/* Create group modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Créer un groupe</Text>

            <TextInput
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Nom du groupe"
              placeholderTextColor="#90A4AE"
              style={styles.modalInput}
            />

            <Text style={styles.sectionLabel}>Sélectionner des membres :</Text>
            <ScrollView style={{ maxHeight: 220, width: '100%' }}>
              {allUsers.map((u) => (
                <TouchableOpacity
                  key={u.Id}
                  onPress={() => toggleMember(u.Id)}
                  style={[styles.memberRow, selectedMembers.includes(u.Id) && styles.memberRowSelected]}
                >
                  <Image
                    source={u.UrlImage ? { uri: u.UrlImage } : require('../../assets/profil.png')}
                    style={styles.memberAvatar}
                  />
                  <Text style={styles.memberName}>{u.Pseudo || u.Nom || 'Utilisateur'}</Text>
                  {selectedMembers.includes(u.Id) && (
                    <Text style={{ color: '#00897B', fontWeight: 'bold', fontSize: 18 }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', marginTop: 16, gap: 10 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#ccc', flex: 1 }]}
                onPress={() => { setShowCreateModal(false); setNewGroupName(''); setSelectedMembers([]); }}
              >
                <Text style={{ color: '#333', fontWeight: 'bold' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#00897B', flex: 1 }]} onPress={createGroup}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Group info modal */}
      <Modal visible={showGroupInfo} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{activeGroup?.name}</Text>
            <Text style={{ color: '#00897B', marginBottom: 8 }}>
              Créé le {activeGroup?.createdAt}
            </Text>
            <Text style={styles.sectionLabel}>Membres :</Text>
            <ScrollView style={{ maxHeight: 160, width: '100%' }}>
              {allUsers
                .filter((u) => activeGroup?.members?.[u.Id])
                .map((u) => (
                  <View key={u.Id} style={styles.memberRow}>
                    <Image
                      source={u.UrlImage ? { uri: u.UrlImage } : require('../../assets/profil.png')}
                      style={styles.memberAvatar}
                    />
                    <Text style={styles.memberName}>{u.Pseudo || u.Nom}</Text>
                    {activeGroup?.creatorId === u.Id && (
                      <View style={styles.adminBadge}>
                        <Text style={{ color: '#fff', fontSize: 10 }}>Admin</Text>
                      </View>
                    )}
                  </View>
                ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', marginTop: 14, gap: 8, flexWrap: 'wrap' }}>
              {activeGroup?.creatorId === userid && (
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#1976D2' }]}
                  onPress={() => { setShowGroupInfo(false); setEditGroupName(activeGroup.name); setShowEditModal(true); }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>✏️ Renommer</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#e74c3c' }]} onPress={() => { setShowGroupInfo(false); leaveGroup(); }}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>🚪 Quitter</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ccc' }]} onPress={() => setShowGroupInfo(false)}>
                <Text style={{ color: '#333', fontWeight: 'bold' }}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit group name modal */}
      <Modal visible={showEditModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Renommer le groupe</Text>
            <TextInput
              value={editGroupName}
              onChangeText={setEditGroupName}
              style={styles.modalInput}
              placeholder="Nouveau nom"
              placeholderTextColor="#90A4AE"
            />
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageTitle: {
    fontWeight: 'bold',
    fontSize: 26,
    color: '#fff',
    letterSpacing: 2,
    textShadowColor: '#004D40',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingTop: 52,
    paddingBottom: 10,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 25,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 22,
  },
  tabBtnActive: {
    backgroundColor: '#fff',
    elevation: 3,
  },
  tabText: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#004D40',
    fontWeight: '700',
  },
  msgWrapper: {
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
  pseudoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C9A84C',
    marginBottom: 2,
  },
  msgText: {
    fontSize: 15,
    color: '#004D40',
    lineHeight: 21,
  },
  timeText: {
    fontSize: 11,
    color: '#00897B',
    textAlign: 'right',
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1,
    borderTopColor: '#B2DFDB',
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
    marginRight: 8,
  },
  sendBtn: {
    backgroundColor: '#00897B',
    borderRadius: 22,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C9A84C',
    elevation: 3,
  },
  createGroupBtn: {
    backgroundColor: '#00897B',
    borderRadius: 25,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 3,
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  createGroupText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  groupCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#C9A84C',
  },
  groupIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#C9A84C',
  },
  groupName: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#004D40',
  },
  groupMeta: {
    color: '#00897B',
    fontSize: 12,
    marginTop: 2,
  },
  adminBadge: {
    backgroundColor: '#C9A84C',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  emptyText: {
    textAlign: 'center',
    color: '#fff',
    marginTop: 40,
    fontSize: 15,
    fontStyle: 'italic',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,77,64,0.88)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  groupTitle: {
    flex: 1,
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    fontStyle: 'italic',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    width: '90%',
    alignItems: 'center',
    maxHeight: '85%',
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 20,
    color: '#004D40',
    marginBottom: 14,
  },
  modalInput: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B2DFDB',
    backgroundColor: '#F1FFFE',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#004D40',
    marginBottom: 12,
  },
  sectionLabel: {
    alignSelf: 'flex-start',
    fontWeight: '700',
    color: '#004D40',
    fontSize: 14,
    marginBottom: 6,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 4,
  },
  memberRowSelected: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#00897B',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#B2DFDB',
  },
  memberName: {
    flex: 1,
    color: '#004D40',
    fontSize: 14,
    fontWeight: '500',
  },
  modalBtn: {
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    elevation: 2,
  },
});

