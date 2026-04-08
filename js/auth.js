import { auth } from './firebase.js';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const googleProvider    = new GoogleAuthProvider();
const microsoftProvider = new OAuthProvider('microsoft.com');

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signInWithMicrosoft() {
  return signInWithPopup(auth, microsoftProvider);
}

export function signOutUser() {
  return signOut(auth);
}

export function onAuthChanged(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}
