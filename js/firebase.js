import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const firebaseConfig = {
  apiKey:            "AIzaSyAbJK1C9RcPZfMTNljPSz4raBC6gUeFPf8",
  authDomain:        "payroll-10a48.firebaseapp.com",
  projectId:         "payroll-10a48",
  storageBucket:     "payroll-10a48.firebasestorage.app",
  messagingSenderId: "265030239911",
  appId:             "1:265030239911:web:e85f53b1b6a04b97647d82"
};

const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);
