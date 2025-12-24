// Gestion du stockage Firebase Storage
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";
import { storage } from './firebase-config.js';

/**
 * Upload une image vers Firebase Storage
 * @param {File} file - Le fichier image à uploader
 * @param {string} path - Le chemin dans le storage (ex: 'products/product-id')
 * @returns {Promise<string>} L'URL de téléchargement
 */
export async function uploadImage(file, path) {
  try {
    // Créer une référence
    const storageRef = ref(storage, path);
    
    // Upload le fichier
    await uploadBytes(storageRef, file);
    
    // Obtenir l'URL de téléchargement
    const downloadURL = await getDownloadURL(storageRef);
    
    return downloadURL;
  } catch (error) {
    console.error('Erreur lors de l\'upload:', error);
    throw error;
  }
}

/**
 * Supprimer une image du Storage
 * @param {string} path - Le chemin de l'image à supprimer
 */
export async function deleteImage(path) {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    throw error;
  }
}

/**
 * Générer un nom de fichier unique
 * @param {string} originalName - Le nom original du fichier
 * @returns {string} Un nom de fichier unique
 */
export function generateFileName(originalName) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop();
  return `${timestamp}_${random}.${extension}`;
}


