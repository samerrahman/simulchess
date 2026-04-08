import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Replace with your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAB9i2Ra8offf_W63inx0NDal_OBbACqwk",
  authDomain: "simulchess-daf26.firebaseapp.com",
  databaseURL: "https://simulchess-daf26-default-rtdb.firebaseio.com",
  projectId: "simulchess-daf26",
  storageBucket: "simulchess-daf26.firebasestorage.app",
  messagingSenderId: "1092507602888",
  appId: "1:1092507602888:web:7e8f791aec465d788d7afd"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
