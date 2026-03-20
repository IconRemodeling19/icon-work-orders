import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDwSR8OG2WOJAXn45DPI5jy0dmZhkRylEY",
  authDomain: "icon-work-orders.firebaseapp.com",
  databaseURL: "https://icon-work-orders-default-rtdb.firebaseio.com",
  projectId: "icon-work-orders",
  storageBucket: "icon-work-orders.firebasestorage.app",
  messagingSenderId: "398209180761",
  appId: "1:398209180761:web:9a820bf3f4be2c88bc7d48"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);
const auth = getAuth(app);

signInAnonymously(auth).catch((err) => console.error("Auth error:", err));

export { db, ref, set, onValue, storage, storageRef, uploadBytes, getDownloadURL };
