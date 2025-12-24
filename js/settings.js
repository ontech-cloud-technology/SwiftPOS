// Gestion des paramètres système
import { logout, getCurrentUser, isAdmin } from './auth.js';
import { getSettings, updateSettings } from './firestore.js';

// Vérifier l'authentification et le rôle
window.addEventListener('DOMContentLoaded', async () => {
    const user = getCurrentUser();
    
    if (!user) {
        window.location.href = '/login.html';
        return;
    }
    
    if (!isAdmin()) {
        window.location.href = '/pos.html';
        return;
    }
    
    // Afficher les infos utilisateur
    displayUserInfo(user);
    
    // Charger les paramètres
    await loadSettings();
    
    // Configurer le formulaire
    setupForm();
    
    // Configurer le logout
    setupLogout();
});

function displayUserInfo(user) {
    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    
    if (nameEl) nameEl.textContent = user.name || user.email;
    if (emailEl) emailEl.textContent = user.email;
}

function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
                await logout();
            }
        });
    }
}

async function loadSettings() {
    try {
        const settings = await getSettings();
        
        // Taxes
        document.getElementById('tpsEnabled').checked = settings.taxes?.tps?.enabled ?? true;
        document.getElementById('tpsName').value = settings.taxes?.tps?.name || 'TPS';
        document.getElementById('tpsRate').value = ((settings.taxes?.tps?.rate || 0.05) * 100).toFixed(4);
        
        document.getElementById('tvqEnabled').checked = settings.taxes?.tvq?.enabled ?? true;
        document.getElementById('tvqName').value = settings.taxes?.tvq?.name || 'TVQ';
        document.getElementById('tvqRate').value = ((settings.taxes?.tvq?.rate || 0.09975) * 100).toFixed(4);
        
        // Devise
        document.getElementById('currency').value = settings.currency || 'CAD';
        document.getElementById('currencySymbol').value = settings.currencySymbol || '$';
        
        // Stock alert
        document.getElementById('stockAlertEnabled').checked = settings.stockAlert?.enabled ?? true;
        document.getElementById('stockAlertThreshold').value = settings.stockAlert?.threshold || 10;
        
        // Fonctionnalités
        document.getElementById('featurePromotions').checked = settings.features?.promotions ?? true;
        document.getElementById('featureNotifications').checked = settings.features?.notifications ?? true;
        
    } catch (error) {
        console.error('Erreur lors du chargement des paramètres:', error);
        showMessage('Erreur lors du chargement des paramètres', 'error');
    }
}

function setupForm() {
    const form = document.getElementById('settingsForm');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            const settingsData = {
                currency: document.getElementById('currency').value,
                currencySymbol: document.getElementById('currencySymbol').value.trim(),
                taxes: {
                    tps: {
                        enabled: document.getElementById('tpsEnabled').checked,
                        name: document.getElementById('tpsName').value.trim() || 'TPS',
                        rate: parseFloat(document.getElementById('tpsRate').value) / 100
                    },
                    tvq: {
                        enabled: document.getElementById('tvqEnabled').checked,
                        name: document.getElementById('tvqName').value.trim() || 'TVQ',
                        rate: parseFloat(document.getElementById('tvqRate').value) / 100
                    }
                },
                stockAlert: {
                    enabled: document.getElementById('stockAlertEnabled').checked,
                    threshold: parseInt(document.getElementById('stockAlertThreshold').value) || 10
                },
                features: {
                    promotions: document.getElementById('featurePromotions').checked,
                    notifications: document.getElementById('featureNotifications').checked
                }
            };
            
            // Validation
            if (!settingsData.currencySymbol) {
                showMessage('Veuillez entrer un symbole de devise', 'error');
                return;
            }
            
            if (settingsData.taxes.tps.enabled && (isNaN(settingsData.taxes.tps.rate) || settingsData.taxes.tps.rate < 0 || settingsData.taxes.tps.rate > 1)) {
                showMessage('Le taux TPS doit être entre 0 et 100%', 'error');
                return;
            }
            
            if (settingsData.taxes.tvq.enabled && (isNaN(settingsData.taxes.tvq.rate) || settingsData.taxes.tvq.rate < 0 || settingsData.taxes.tvq.rate > 1)) {
                showMessage('Le taux TVQ doit être entre 0 et 100%', 'error');
                return;
            }
            
            if (settingsData.stockAlert.enabled && (isNaN(settingsData.stockAlert.threshold) || settingsData.stockAlert.threshold < 0)) {
                showMessage('Le seuil d\'alerte de stock doit être un nombre positif', 'error');
                return;
            }
            
            await updateSettings(settingsData);
            showMessage('Paramètres enregistrés avec succès!', 'success');
            
        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
            showMessage('Erreur lors de la sauvegarde: ' + (error.message || 'Une erreur est survenue'), 'error');
        }
    });
}

function showMessage(message, type = 'success') {
    const messageEl = document.getElementById('formMessage');
    messageEl.className = `alert alert-${type}`;
    messageEl.textContent = message;
    messageEl.style.display = 'block';
    
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
}

