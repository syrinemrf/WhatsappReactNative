import { View, Text } from 'react-native'
import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import ListAccount from './Home/ListAccount';
import Groupe from './Home/Groupe';
import MyAccount from './Home/MyAccount';

const Tab = createBottomTabNavigator();

export default function Home(props) {
  const userid = props.route.params.userid;
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#B2DFDB',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
          elevation: 8,
        },
        tabBarActiveTintColor: '#00897B',
        tabBarInactiveTintColor: '#90A4AE',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="ListAccount"
        component={ListAccount}
        initialParams={{ userid }}
        options={{
          tabBarLabel: 'Contacts',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👥</Text>,
        }}
      />
      <Tab.Screen
        name="Groupe"
        component={Groupe}
        initialParams={{ userid }}
        options={{
          tabBarLabel: 'Groupes',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>💬</Text>,
        }}
      />
      <Tab.Screen
        name="MyAccount"
        component={MyAccount}
        initialParams={{ userid }}
        options={{
          tabBarLabel: 'Mon Compte',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  )
}
