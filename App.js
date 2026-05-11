import { View, Text } from 'react-native'
import React from 'react'
import Auth from './Screens/Auth'
import SignUp from './Screens/SignUp';
import Home from './Screens/Home';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MyAccount from './Screens/Home/MyAccount';
import Chat from './Screens/Chat';

const Stack = createNativeStackNavigator();

export default function App() {
  return <NavigationContainer>
    <Stack.Navigator screenOptions={{
      headerShown: false,
    }}>
      <Stack.Screen name="Auth" component={Auth} />
      <Stack.Screen name="SignUp" component={SignUp} />
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="MyAccount" component={MyAccount} />
      <Stack.Screen name="Chat" component={Chat} />
    </Stack.Navigator>
  </NavigationContainer>;
}