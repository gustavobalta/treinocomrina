import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCbLUXH5oMt4BXaJV3gbHPHIA_I0gFyRGo",
  authDomain: "treinocomrina-2d57f.firebaseapp.com",
  projectId: "treinocomrina-2d57f",
  storageBucket: "treinocomrina-2d57f.firebasestorage.app",
  messagingSenderId: "909965041717",
  appId: "1:909965041717:web:62a8298a6e8e22c60ed17c",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
