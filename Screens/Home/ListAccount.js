import { useState, useEffect } from 'react';
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

  useEffect(() => {
    ref_all_accounts.on('value', (snapshot) => {
      const d = [];
      snapshot.forEach((one_account) => {
        d.push(one_account.val());
      });
      setdata(d);
    });
    return () => {
      ref_all_accounts.off();
    };
  }, []);

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
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher par pseudo..."
          placeholderTextColor="#90A4AE"
          style={styles.searchInput}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: '#90A4AE', fontSize: 18, marginRight: 8 }}>✕</Text>
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
                <Image
                  style={styles.avatar}
                  source={item.UrlImage ? { uri: item.UrlImage } : require('../../assets/profil.png')}
                />
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
              onPress={() =>
                item.Numero
                  ? Linking.openURL(`tel:${item.Numero}`)
                  : alert('Numéro non disponible')
              }
            >
              <Text style={{ fontSize: 19 }}>📞</Text>
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
              <Image style={styles.msgIcon} source={require('../../assets/message.png')} />
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

            <Image
              style={styles.modalAvatar}
              source={
                selectedUser?.UrlImage
                  ? { uri: selectedUser.UrlImage }
                  : require('../../assets/profil.png')
              }
            />

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
                <Text style={styles.modalBtnText}>📞 Appel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#1976D2' }]}
                onPress={() => selectedUser?.Numero && Linking.openURL(`sms:${selectedUser.Numero}`)}
              >
                <Text style={styles.modalBtnText}>💬 SMS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#C9A84C' }]}
                onPress={() => selectedUser?.Email && Linking.openURL(`mailto:${selectedUser.Email}`)}
              >
                <Text style={styles.modalBtnText}>✉️ Email</Text>
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
              <Text style={styles.chatFromModalText}>💬 Ouvrir la conversation</Text>
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
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  chatFromModalText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});

