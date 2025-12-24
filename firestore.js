// Opérations Firestore pour SwiftPOS
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { db } from './firebase-config.js';

// ========== USERS ==========

/**
 * Récupérer tous les utilisateurs
 */
export async function getAllUsers() {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    return usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    throw error;
  }
}

/**
 * Récupérer un utilisateur par ID
 */
export async function getUserById(userId) {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    throw error;
  }
}

/**
 * Créer un utilisateur
 */
export async function createUser(userData) {
  try {
    const docRef = await addDoc(collection(db, 'users'), {
      ...userData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    throw error;
  }
}

/**
 * Mettre à jour un utilisateur
 */
export async function updateUser(userId, userData) {
  try {
    await updateDoc(doc(db, 'users', userId), {
      ...userData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
    throw error;
  }
}

/**
 * Supprimer un utilisateur
 */
export async function deleteUser(userId) {
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    throw error;
  }
}

// ========== PRODUCTS ==========

/**
 * Récupérer tous les produits
 */
export async function getAllProducts() {
  try {
    const productsSnapshot = await getDocs(collection(db, 'products'));
    return productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des produits:', error);
    throw error;
  }
}

/**
 * Récupérer un produit par ID
 */
export async function getProductById(productId) {
  try {
    const productDoc = await getDoc(doc(db, 'products', productId));
    if (productDoc.exists()) {
      return { id: productDoc.id, ...productDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Erreur lors de la récupération du produit:', error);
    throw error;
  }
}

/**
 * Créer un produit
 */
export async function createProduct(productData) {
  try {
    const docRef = await addDoc(collection(db, 'products'), {
      ...productData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de la création du produit:', error);
    throw error;
  }
}

/**
 * Mettre à jour un produit
 */
export async function updateProduct(productId, productData) {
  try {
    await updateDoc(doc(db, 'products', productId), {
      ...productData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du produit:', error);
    throw error;
  }
}

/**
 * Supprimer un produit
 */
export async function deleteProduct(productId) {
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    console.error('Erreur lors de la suppression du produit:', error);
    throw error;
  }
}

// ========== SALES ==========

/**
 * Récupérer toutes les ventes
 */
export async function getAllSales() {
  try {
    const salesSnapshot = await getDocs(
      query(collection(db, 'sales'), orderBy('createdAt', 'desc'))
    );
    return salesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des ventes:', error);
    throw error;
  }
}

/**
 * Récupérer les ventes d'un utilisateur
 * Note: Filtre côté client pour éviter de nécessiter un index composite
 */
export async function getUserSales(userId) {
  try {
    // Récupérer toutes les ventes triées par date (ne nécessite pas d'index composite)
    const salesSnapshot = await getDocs(
      query(
        collection(db, 'sales'),
        orderBy('createdAt', 'desc')
      )
    );
    
    // Filtrer côté client par userId
    const allSales = salesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return allSales.filter(sale => sale.userId === userId);
  } catch (error) {
    console.error('Erreur lors de la récupération des ventes:', error);
    throw error;
  }
}

/**
 * Créer une vente
 */
export async function createSale(saleData) {
  try {
    const docRef = await addDoc(collection(db, 'sales'), {
      ...saleData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de la création de la vente:', error);
    throw error;
  }
}

// ========== CATEGORIES ==========

/**
 * Récupérer toutes les catégories
 */
export async function getAllCategories() {
  try {
    const categoriesSnapshot = await getDocs(
      query(collection(db, 'categories'), orderBy('name', 'asc'))
    );
    return categoriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error);
    throw error;
  }
}

/**
 * Récupérer une catégorie par ID
 */
export async function getCategoryById(categoryId) {
  try {
    const categoryDoc = await getDoc(doc(db, 'categories', categoryId));
    if (categoryDoc.exists()) {
      return { id: categoryDoc.id, ...categoryDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Erreur lors de la récupération de la catégorie:', error);
    throw error;
  }
}

/**
 * Créer une catégorie
 */
export async function createCategory(categoryData) {
  try {
    const docRef = await addDoc(collection(db, 'categories'), {
      ...categoryData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de la création de la catégorie:', error);
    throw error;
  }
}

/**
 * Mettre à jour une catégorie
 */
export async function updateCategory(categoryId, categoryData) {
  try {
    await updateDoc(doc(db, 'categories', categoryId), {
      ...categoryData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la catégorie:', error);
    throw error;
  }
}

/**
 * Supprimer une catégorie
 */
export async function deleteCategory(categoryId) {
  try {
    await deleteDoc(doc(db, 'categories', categoryId));
  } catch (error) {
    console.error('Erreur lors de la suppression de la catégorie:', error);
    throw error;
  }
}

// ========== PROMOTIONS ==========

/**
 * Récupérer toutes les promotions
 */
export async function getAllPromotions() {
  try {
    const promotionsSnapshot = await getDocs(
      query(collection(db, 'promotions'), orderBy('createdAt', 'desc'))
    );
    return promotionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des promotions:', error);
    throw error;
  }
}

/**
 * Récupérer une promotion par ID
 */
export async function getPromotionById(promotionId) {
  try {
    const promotionDoc = await getDoc(doc(db, 'promotions', promotionId));
    if (promotionDoc.exists()) {
      return { id: promotionDoc.id, ...promotionDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Erreur lors de la récupération de la promotion:', error);
    throw error;
  }
}

/**
 * Créer une promotion
 */
export async function createPromotion(promotionData) {
  try {
    const docRef = await addDoc(collection(db, 'promotions'), {
      ...promotionData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de la création de la promotion:', error);
    throw error;
  }
}

/**
 * Mettre à jour une promotion
 */
export async function updatePromotion(promotionId, promotionData) {
  try {
    await updateDoc(doc(db, 'promotions', promotionId), {
      ...promotionData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la promotion:', error);
    throw error;
  }
}

/**
 * Supprimer une promotion
 */
export async function deletePromotion(promotionId) {
  try {
    await deleteDoc(doc(db, 'promotions', promotionId));
  } catch (error) {
    console.error('Erreur lors de la suppression de la promotion:', error);
    throw error;
  }
}

// ========== SETTINGS ==========

/**
 * Récupérer les paramètres système
 */
export async function getSettings() {
  try {
    const settingsDoc = await getDoc(doc(db, 'settings', 'system'));
    if (settingsDoc.exists()) {
      return { id: settingsDoc.id, ...settingsDoc.data() };
    }
    // Retourner les paramètres par défaut si aucun n'existe
    return {
      id: 'system',
      currency: 'CAD',
      currencySymbol: '$',
      taxes: {
        tps: { enabled: true, rate: 0.05, name: 'TPS' },
        tvq: { enabled: true, rate: 0.09975, name: 'TVQ' }
      },
      stockAlert: {
        enabled: true,
        threshold: 10
      },
      features: {
        promotions: true,
        notifications: true
      },
      updatedAt: null
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres:', error);
    throw error;
  }
}

/**
 * Mettre à jour les paramètres système
 */
export async function updateSettings(settingsData) {
  try {
    const settingsRef = doc(db, 'settings', 'system');
    const settingsDoc = await getDoc(settingsRef);
    
    if (settingsDoc.exists()) {
      // Mise à jour
      await updateDoc(settingsRef, {
        ...settingsData,
        updatedAt: serverTimestamp()
      });
    } else {
      // Création
      await setDoc(settingsRef, {
        ...settingsData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour des paramètres:', error);
    throw error;
  }
}

