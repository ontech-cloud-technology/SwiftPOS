// Gestion de l'authentification Firebase
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { 
  doc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { auth, db } from './firebase-config.js';

/**
 * Connexion avec email et mot de passe
 */
export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Récupérer le rôle de l'utilisateur
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      throw new Error('Profil utilisateur introuvable');
    }
    
    const userData = userDoc.data();
    const role = userData.role || 'user';
    const superadmin = userData.superadmin || 'no';
    
    // Stocker les infos utilisateur dans sessionStorage
    sessionStorage.setItem('user', JSON.stringify({
      uid: user.uid,
      email: user.email,
      name: userData.name,
      role: role,
      superadmin: superadmin
    }));
    
    return { user, role, userData };
  } catch (error) {
    console.error('Erreur de connexion:', error);
    throw error;
  }
}

/**
 * Déconnexion
 */
export async function logout() {
  try {
    await signOut(auth);
    sessionStorage.removeItem('user');
    window.location.href = '/login.html';
  } catch (error) {
    console.error('Erreur de déconnexion:', error);
    throw error;
  }
}

/**
 * Vérifier l'état d'authentification
 */
export function checkAuthState(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userInfo = {
            uid: user.uid,
            email: user.email,
            name: userData.name,
            role: userData.role || 'user',
            superadmin: userData.superadmin || 'no'
          };
          sessionStorage.setItem('user', JSON.stringify(userInfo));
          callback(userInfo);
        } else {
          callback(null);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification:', error);
        callback(null);
      }
    } else {
      sessionStorage.removeItem('user');
      callback(null);
    }
  });
}

/**
 * Obtenir l'utilisateur actuel depuis sessionStorage
 */
export function getCurrentUser() {
  const userStr = sessionStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Vérifier si l'utilisateur est admin
 */
export function isAdmin() {
  const user = getCurrentUser();
  return user && user.role === 'admin';
}

/**
 * Vérifier si l'utilisateur est superadmin
 */
export function isSuperAdmin() {
  const user = getCurrentUser();
  return user && user.superadmin === 'yes';
}

/**
 * Rediriger selon le rôle
 */
export function redirectByRole(role) {
  if (role === 'admin') {
    window.location.href = '/admin.html';
  } else {
    window.location.href = '/pos.html';
  }
}

