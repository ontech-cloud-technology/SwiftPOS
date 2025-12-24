// Configuration Firebase pour SwiftPOS
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD4QXSJWVL8jFLEhky6-Ri6B4x-89jtwfg",
  authDomain: "swiftpos-bd354.firebaseapp.com",
  projectId: "swiftpos-bd354",
  storageBucket: "swiftpos-bd354.firebasestorage.app",
  messagingSenderId: "940090565588",
  appId: "1:940090565588:web:5d07171280b02f56d4ec41"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Initialiser les services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;


