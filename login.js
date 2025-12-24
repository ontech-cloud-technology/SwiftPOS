// Script de connexion
import { login, redirectByRole } from './auth.js';

const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');
const loadingIndicator = document.getElementById('loadingIndicator');

// Gérer la soumission du formulaire
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    // Masquer l'erreur précédente
    errorMessage.classList.remove('show');
    errorMessage.textContent = '';
    
    // Afficher le loading
    loadingIndicator.classList.add('show');
    loginForm.querySelector('button[type="submit"]').disabled = true;
    
    try {
        const { role } = await login(email, password);
        
        // Rediriger selon le rôle
        redirectByRole(role);
    } catch (error) {
        // Afficher l'erreur
        let errorText = 'Erreur de connexion';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorText = 'Aucun compte trouvé avec cet email';
                break;
            case 'auth/wrong-password':
                errorText = 'Mot de passe incorrect';
                break;
            case 'auth/invalid-email':
                errorText = 'Email invalide';
                break;
            case 'auth/user-disabled':
                errorText = 'Ce compte a été désactivé';
                break;
            case 'auth/too-many-requests':
                errorText = 'Trop de tentatives. Veuillez réessayer plus tard';
                break;
            default:
                errorText = error.message || 'Une erreur est survenue';
        }
        
        errorMessage.textContent = errorText;
        errorMessage.classList.add('show');
        
        // Masquer le loading
        loadingIndicator.classList.remove('show');
        loginForm.querySelector('button[type="submit"]').disabled = false;
    }
});

// Vérifier si l'utilisateur est déjà connecté
import { checkAuthState } from './auth.js';
checkAuthState((user) => {
    if (user) {
        redirectByRole(user.role);
    }
});


