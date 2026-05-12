import app from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/database";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Guard against double-initialization (hot reload in dev)
const firebase = app.apps.length === 0
  ? app.initializeApp(firebaseConfig)
  : app.apps[0];

// Enable Firebase Realtime Database verbose logging (remove in production)
if (__DEV__) {
  app.database.enableLogging(true);
}

export default firebase;

import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_KEY
);
export { supabase };
