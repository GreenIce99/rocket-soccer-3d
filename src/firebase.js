
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAPwkkU_pkoFmyBSHP4a0pQp3I6BUvJJQk",
  authDomain: "rocket-soccer-3d.firebaseapp.com",
  databaseURL: "https://rocket-soccer-3d-default-rtdb.firebaseio.com",
  projectId: "rocket-soccer-3d",
  storageBucket: "rocket-soccer-3d.firebasestorage.app",
  messagingSenderId: "116107807397",
  appId: "1:116107807397:web:5e565df94a3f13871f9b4c",
  measurementId: "G-6VDZCWN5RF"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);

export const playerReady = signInAnonymously(auth);
