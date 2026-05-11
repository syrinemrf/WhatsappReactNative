import { useState, useEffect } from 'react';
import {
  FlatList,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';

import firebase from '../../Config/index';
const database = firebase.database();
const ref_all_accounts = database.ref("allaccounts");

export default function ListAccount(props) {
  const userid = props.route.params.userid;
  const [data, setdata] = useState([]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedUser, setselectedUser] = useState();

  useEffect(() => {
    ref_all_accounts.on("value", (snapshot) => {
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

  return (
    <ImageBackground
      style={styles.container}
      source={require("../../assets/backgroundreact.jpg")}
    >
      <Text style={styles.title}>Contacts</Text>

      <FlatList
        data={data}
        keyExtractor={(item, index) => item?.Id ?? index.toString()}
        renderItem={({ item }) => {
          if (item.Id === userid) return null; // ne pas afficher son propre compte
          return (
            <View style={styles.itemRow}>
              <View style={styles.avatarContainer}>

                <TouchableOpacity onPress={() => {
                  setIsModalVisible(true);
                  setselectedUser(item);
                }}>
                <Image
                  style={styles.avatar}
                  source={item.UrlImage ? { uri: item.UrlImage } : require("../../assets/profil.png")}
                />
                </TouchableOpacity>
              </View>

              <View style={styles.itemInfo}>
                <Text numberOfLines={1} style={styles.nameText}>{item.Nom || 'Sans nom'}</Text>
                <Text numberOfLines={1} style={styles.metaText}>{item.Pseudo}</Text>
                <Text numberOfLines={1} style={styles.metaText}>{item.Email}</Text>
              </View>

              <TouchableOpacity
                style={styles.msgButton}
                onPress={() => {
                props.navigation.navigate("Chat", {
                    currentid: userid,
                    secondid: item.Id,
                  });
                }}
              >
                <Image
                  style={styles.msgIcon}
                  source={require("../../assets/message.png")}
                />
              </TouchableOpacity>
            </View>
          );
        }}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
      <Modal visible={isModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsModalVisible(false)}>
        <View style={{
          flex: 1,
          backgroundColor: '#0006',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <View style={{
            backgroundColor: '#fff',
            padding: 20,
            borderRadius: 10,
          }}>
            <Image
              style={{ width: 300, height: 300, borderRadius: 150, alignSelf: 'center' }}
              source={selectedUser?.UrlImage ? { uri: selectedUser.UrlImage } : require("../../assets/profil.png")}
            />
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 10 }}>{selectedUser?.Nom || 'Sans nom'}</Text>
            <Text style={{ color: '#555' }}>{selectedUser?.Pseudo}</Text>
            <Text style={{ color: '#555' }}>{selectedUser?.Numero}</Text>
            <Text style={{ color: '#000' }}>{selectedUser?.Email}</Text>
            <Pressable style={{ width:150, height:40, backgroundColor:"#00897B", borderRadius:22, alignItems:"center", justifyContent:"center", marginTop:20 }} onPress={() => setIsModalVisible(false)}>
            <Text> Close </Text>
            </Pressable>
          </View>
        </View>

      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingTop: 50,
  },
  title: {
    fontWeight: "bold",
    fontSize: 28,
    color: "#fff",
    letterSpacing: 2,
    textShadowColor: '#004D40',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  list: {
    width: "95%",
  },
  itemRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    marginBottom: 10,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#C9A84C',
    elevation: 3,
    shadowColor: '#004D40',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  avatarContainer: {
    borderWidth: 2,
    borderColor: '#C9A84C',
    borderRadius: 30,
    padding: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  itemInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  nameText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#004D40',
  },
  metaText: {
    color: '#00897B',
    fontSize: 12,
    marginTop: 1,
  },
  msgButton: {
    backgroundColor: '#00897B',
    borderRadius: 22,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  msgIcon: {
    height: 22,
    width: 22,
    tintColor: '#fff',
  },
});