// Système de personnalisation complet pour SwiftPOS
// Plus de 100 fonctions de personnalisation

import { logout, getCurrentUser, isAdmin } from './auth.js';
import { getDoc, doc, setDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import { db } from './firebase-config.js';

let designSettings = {};
let autoSaveTimer = null;

// Vérifier l'authentification et le rôle
window.addEventListener('DOMContentLoaded', () => {
    const user = getCurrentUser();
    
    if (!user) {
        window.location.href = '/login.html';
        return;
    }
    
    if (!isAdmin()) {
        window.location.href = '/pos.html';
        return;
    }
    
    displayUserInfo(user);
    setupTabs();
    setupFormHandlers();
    setupSaveHandlers();
    loadDesignSettings();
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

function setupTabs() {
    const tabs = document.querySelectorAll('.design-tab');
    const sections = document.querySelectorAll('.design-section');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetSection = tab.dataset.section;
            
            // Mettre à jour les tabs
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Mettre à jour les sections
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(targetSection).classList.add('active');
        });
    });
}

function setupFormHandlers() {
    // Cette fonction sera appelée après le chargement des données
    // Les handlers sont configurés dans les fonctions individuelles
    // qui sont appelées dans loadDesignSettings()
}

// Fonction 1-10: Gestion des valeurs de range
function setupRangeInputs() {
    const rangeInputs = document.querySelectorAll('input[type="range"]');
    rangeInputs.forEach(input => {
        const valueDisplay = document.getElementById(input.id + 'Value');
        if (valueDisplay) {
            input.addEventListener('input', () => {
                const suffix = input.id.includes('Opacity') || input.id.includes('Intensity') || input.id.includes('Speed') || input.id.includes('Shadow') ? '%' : 
                              input.id.includes('Height') || input.id.includes('Width') || input.id.includes('Size') || input.id.includes('Padding') || input.id.includes('Spacing') || input.id.includes('Radius') || input.id.includes('Gap') ? 'px' :
                              input.id.includes('Delay') || input.id.includes('Fast') || input.id.includes('Base') || input.id.includes('Slow') ? 'ms' : '';
                valueDisplay.textContent = input.value + suffix;
                handleSettingChange(input.id, input.value);
            });
        }
    });
}

// Fonction 11-20: Gestion des inputs texte
function setupTextInputs() {
    const textInputs = document.querySelectorAll('input[type="text"], input[type="url"], textarea');
    textInputs.forEach(input => {
        input.addEventListener('input', () => {
            handleSettingChange(input.id, input.value);
        });
        input.addEventListener('blur', () => {
            handleSettingChange(input.id, input.value);
        });
    });
}

// Fonction 21-30: Gestion des inputs couleur
function setupColorInputs() {
    const colorInputs = document.querySelectorAll('input[type="color"]');
    colorInputs.forEach(input => {
        input.addEventListener('change', () => {
            handleSettingChange(input.id, input.value);
            updateColorPreview(input.id, input.value);
        });
    });
}

// Fonction 31-40: Gestion des selects
function setupSelectInputs() {
    const selectInputs = document.querySelectorAll('select');
    selectInputs.forEach(select => {
        select.addEventListener('change', () => {
            handleSettingChange(select.id, select.value);
        });
    });
}

// Fonction 41-50: Gestion des checkboxes
function setupCheckboxInputs() {
    const checkboxInputs = document.querySelectorAll('input[type="checkbox"]');
    checkboxInputs.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            handleSettingChange(checkbox.id, checkbox.checked);
        });
    });
}

// Fonction 51-60: Gestion des fichiers
function setupFileInputs() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                // Ici on pourrait uploader vers Firebase Storage
                // Pour l'instant, on utilise FileReader pour prévisualiser
                const reader = new FileReader();
                reader.onload = (event) => {
                    handleSettingChange(input.id.replace('File', 'Url'), event.target.result);
                    if (input.id.includes('logo')) {
                        updateLogoPreview(event.target.result);
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    });
}

// Fonction 61-70: Gestion des icônes
function setupIconSelectors() {
    const iconSelectors = document.querySelectorAll('.icon-selector');
    iconSelectors.forEach(selector => {
        const iconType = selector.dataset.icon;
        const options = selector.querySelectorAll('.icon-option');
        
        options.forEach(option => {
            option.addEventListener('click', () => {
                options.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                handleSettingChange(`icon${iconType.charAt(0).toUpperCase() + iconType.slice(1)}`, option.dataset.value);
            });
        });
    });
}

// Fonction 71-80: Mise à jour des prévisualisations
function updateColorPreview(inputId, color) {
    const previewId = 'preview' + inputId.replace('color', '').charAt(0).toUpperCase() + inputId.replace('color', '').slice(1);
    const preview = document.getElementById(previewId);
    if (preview) {
        preview.style.backgroundColor = color;
    }
}

function updateLogoPreview(url) {
    const preview = document.getElementById('logoPreview');
    if (preview && url) {
        preview.innerHTML = `<img src="${url}" style="max-width: 100%; max-height: 100px;" alt="Logo preview">`;
    }
}

function updateFontPreview() {
    const fontFamily = document.getElementById('fontFamily')?.value || 'Inter, system-ui, sans-serif';
    const preview = document.getElementById('fontPreview');
    if (preview) {
        preview.style.fontFamily = fontFamily;
    }
}

// Fonction 81-90: Application des styles dynamiques
function applyDesignSettings(settings) {
    if (!settings) return;
    
    const root = document.documentElement;
    
    // Couleurs
    if (settings.colorPrimary) root.style.setProperty('--color-primary', settings.colorPrimary);
    if (settings.colorPrimaryLight) root.style.setProperty('--color-primary-light', settings.colorPrimaryLight);
    if (settings.colorPrimaryDark) root.style.setProperty('--color-primary-dark', settings.colorPrimaryDark);
    if (settings.colorSecondary) root.style.setProperty('--color-secondary', settings.colorSecondary);
    if (settings.colorBgPrimary) root.style.setProperty('--color-bg-primary', settings.colorBgPrimary);
    if (settings.colorBgSecondary) root.style.setProperty('--color-bg-secondary', settings.colorBgSecondary);
    if (settings.colorBgSidebar) root.style.setProperty('--color-bg-sidebar', settings.colorBgSidebar);
    if (settings.colorTextPrimary) root.style.setProperty('--color-text-primary', settings.colorTextPrimary);
    if (settings.colorTextSecondary) root.style.setProperty('--color-text-secondary', settings.colorTextSecondary);
    if (settings.colorSuccess) root.style.setProperty('--color-success', settings.colorSuccess);
    if (settings.colorError) root.style.setProperty('--color-error', settings.colorError);
    if (settings.colorWarning) root.style.setProperty('--color-warning', settings.colorWarning);
    if (settings.colorInfo) root.style.setProperty('--color-info', settings.colorInfo);
    
    // Typographie
    if (settings.fontFamily) {
        root.style.setProperty('--font-family', settings.fontFamily);
        document.body.style.fontFamily = settings.fontFamily;
    }
    if (settings.fontSizeBase) root.style.setProperty('--font-size-base', settings.fontSizeBase + 'px');
    if (settings.fontSizeH1) root.style.setProperty('--font-size-h1', settings.fontSizeH1 + 'px');
    if (settings.fontSizeH2) root.style.setProperty('--font-size-h2', settings.fontSizeH2 + 'px');
    if (settings.fontSizeH3) root.style.setProperty('--font-size-h3', settings.fontSizeH3 + 'px');
    if (settings.lineHeight) root.style.setProperty('--line-height', settings.lineHeight);
    if (settings.letterSpacing) root.style.setProperty('--letter-spacing', settings.letterSpacing + 'px');
    if (settings.fontWeightNormal) root.style.setProperty('--font-weight-normal', settings.fontWeightNormal);
    if (settings.fontWeightHeading) root.style.setProperty('--font-weight-heading', settings.fontWeightHeading);
    
    // Layout
    if (settings.sidebarWidth) root.style.setProperty('--sidebar-width', settings.sidebarWidth + 'px');
    if (settings.headerHeight) root.style.setProperty('--header-height', settings.headerHeight + 'px');
    if (settings.contentMaxWidth) root.style.setProperty('--content-max-width', settings.contentMaxWidth + 'px');
    if (settings.contentPadding) root.style.setProperty('--content-padding', settings.contentPadding + 'px');
    if (settings.gridGap) root.style.setProperty('--grid-gap', settings.gridGap + 'px');
    
    // Composants
    if (settings.buttonRadius) root.style.setProperty('--button-radius', settings.buttonRadius + 'px');
    if (settings.cardRadius) root.style.setProperty('--card-radius', settings.cardRadius + 'px');
    if (settings.inputRadius) root.style.setProperty('--input-radius', settings.inputRadius + 'px');
    if (settings.modalRadius) root.style.setProperty('--modal-radius', settings.modalRadius + 'px');
    if (settings.badgeRadius) root.style.setProperty('--badge-radius', settings.badgeRadius + 'px');
    
    // Transitions
    if (settings.transitionFast) root.style.setProperty('--transition-fast', settings.transitionFast + 'ms');
    if (settings.transitionBase) root.style.setProperty('--transition-base', settings.transitionBase + 'ms');
    if (settings.transitionSlow) root.style.setProperty('--transition-slow', settings.transitionSlow + 'ms');
    if (settings.animationEasing) root.style.setProperty('--animation-easing', settings.animationEasing);
    
    // Images de fond
    if (settings.bgImageUrl) {
        document.body.style.backgroundImage = `url(${settings.bgImageUrl})`;
        if (settings.bgImagePosition) document.body.style.backgroundPosition = settings.bgImagePosition;
        if (settings.bgImageSize) document.body.style.backgroundSize = settings.bgImageSize;
        if (settings.bgImageOpacity) {
            const opacity = settings.bgImageOpacity / 100;
            document.body.style.setProperty('--bg-image-opacity', opacity);
        }
        if (settings.bgImageRepeat !== undefined) {
            document.body.style.backgroundRepeat = settings.bgImageRepeat ? 'repeat' : 'no-repeat';
        }
    }
    
    if (settings.sidebarBgImageUrl) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.style.backgroundImage = `url(${settings.sidebarBgImageUrl})`;
            if (settings.sidebarBgImageOpacity) {
                const opacity = settings.sidebarBgImageOpacity / 100;
                sidebar.style.setProperty('--sidebar-bg-opacity', opacity);
            }
        }
    }
    
    // Nom de l'application
    if (settings.appName) {
        const appNameDisplay = document.getElementById('appNameDisplay');
        const appIcon = settings.appIcon || '⚡';
        if (appNameDisplay) {
            appNameDisplay.textContent = `${appIcon} ${settings.appName}`;
        }
        document.title = settings.appName + ' - Personnalisation';
    }
    
    // Logo
    if (settings.logoUrl) {
        const logoElements = document.querySelectorAll('.logo, .app-logo');
        logoElements.forEach(el => {
            el.innerHTML = `<img src="${settings.logoUrl}" style="max-height: ${settings.logoSize || 40}px;" alt="Logo">`;
        });
    }
    
    // CSS personnalisé
    if (settings.customCSS) {
        let styleEl = document.getElementById('custom-design-css');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'custom-design-css';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = settings.customCSS;
    }
    
    // JavaScript personnalisé
    if (settings.customJS) {
        let scriptEl = document.getElementById('custom-design-js');
        if (scriptEl) {
            scriptEl.remove();
        }
        scriptEl = document.createElement('script');
        scriptEl.id = 'custom-design-js';
        scriptEl.textContent = settings.customJS;
        document.body.appendChild(scriptEl);
    }
}

// Fonction 91-100: Gestion des changements et sauvegarde
function handleSettingChange(key, value) {
    designSettings[key] = value;
    
    // Appliquer immédiatement
    applyDesignSettings({ [key]: value });
    
    // Sauvegarde automatique avec délai
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        saveDesignSettings();
    }, 2000);
}

async function loadDesignSettings() {
    try {
        const designDoc = await getDoc(doc(db, 'settings', 'design'));
        if (designDoc.exists()) {
            designSettings = designDoc.data();
            populateForm(designSettings);
            applyDesignSettings(designSettings);
        } else {
            // Charger les valeurs par défaut
            designSettings = getDefaultSettings();
            populateForm(designSettings);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des paramètres de design:', error);
        designSettings = getDefaultSettings();
        populateForm(designSettings);
    }
    
    // Configurer tous les handlers après le chargement
    setupRangeInputs();
    setupTextInputs();
    setupColorInputs();
    setupSelectInputs();
    setupCheckboxInputs();
    setupFileInputs();
    setupIconSelectors();
}

function populateForm(settings) {
    // Remplir tous les champs du formulaire
    Object.keys(settings).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = settings[key];
            } else if (element.type === 'range') {
                element.value = settings[key];
                const valueDisplay = document.getElementById(key + 'Value');
                if (valueDisplay) {
                    const suffix = key.includes('Opacity') || key.includes('Intensity') || key.includes('Speed') || key.includes('Shadow') ? '%' : 
                                  key.includes('Height') || key.includes('Width') || key.includes('Size') || key.includes('Padding') || key.includes('Spacing') || key.includes('Radius') || key.includes('Gap') ? 'px' :
                                  key.includes('Delay') || key.includes('Fast') || key.includes('Base') || key.includes('Slow') ? 'ms' : '';
                    valueDisplay.textContent = settings[key] + suffix;
                }
            } else {
                element.value = settings[key];
            }
        }
    });
    
    // Mettre à jour les prévisualisations
    updateFontPreview();
    if (settings.logoUrl) updateLogoPreview(settings.logoUrl);
    if (settings.colorPrimary) updateColorPreview('colorPrimary', settings.colorPrimary);
}

function getDefaultSettings() {
    return {
        // Brand
        appName: 'SwiftPOS',
        appTagline: 'Point de Vente Premium',
        appDescription: '',
        appIcon: '⚡',
        logoUrl: '',
        logoSize: 40,
        faviconUrl: '',
        appIconUrl: '',
        companyName: '',
        companyAddress: '',
        companyPhone: '',
        companyEmail: '',
        companyWebsite: '',
        
        // Colors
        colorPrimary: '#3b82f6',
        colorPrimaryLight: '#60a5fa',
        colorPrimaryDark: '#2563eb',
        colorSecondary: '#10b981',
        colorSecondaryLight: '#34d399',
        colorAccent: '#d4af37',
        colorBgPrimary: '#ffffff',
        colorBgSecondary: '#f5f6f8',
        colorBgSidebar: '#1f2937',
        colorBgCard: '#ffffff',
        colorTextPrimary: '#2e2e2e',
        colorTextSecondary: '#6b7280',
        colorTextSidebar: '#e5e7eb',
        colorTextWhite: '#ffffff',
        colorSuccess: '#10b981',
        colorError: '#ef4444',
        colorWarning: '#f59e0b',
        colorInfo: '#3b82f6',
        colorBorder: '#e5e7eb',
        colorBorderSecondary: '#d1d5db',
        borderOpacity: 100,
        
        // Typography
        fontFamily: 'Inter, system-ui, sans-serif',
        customFontUrl: '',
        fontSizeBase: 16,
        fontSizeH1: 32,
        fontSizeH2: 24,
        fontSizeH3: 20,
        lineHeight: 1.6,
        letterSpacing: 0,
        letterSpacingHeading: -0.5,
        fontWeightNormal: 400,
        fontWeightHeading: 700,
        
        // Layout
        sidebarWidth: 280,
        sidebarPosition: 'left',
        sidebarCollapsible: false,
        sidebarFixed: true,
        sidebarOpacity: 100,
        headerHeight: 80,
        headerFixed: false,
        headerShadow: true,
        headerPadding: 24,
        contentMaxWidth: 1400,
        contentPadding: 32,
        sectionSpacing: 32,
        gridColumns: 3,
        gridGap: 24,
        footerEnabled: false,
        footerHeight: 60,
        footerText: '© 2024 SwiftPOS',
        
        // Components
        buttonRadius: 8,
        buttonPaddingY: 10,
        buttonPaddingX: 20,
        buttonFontSize: 14,
        buttonShadow: true,
        buttonUppercase: false,
        cardRadius: 18,
        cardPadding: 24,
        cardShadow: 5,
        cardHover: true,
        cardBorder: false,
        inputRadius: 8,
        inputHeight: 44,
        inputPaddingX: 12,
        inputFocusGlow: true,
        tableCellRadius: 4,
        tableStriped: false,
        tableHover: true,
        tableBordered: false,
        modalRadius: 16,
        modalOverlay: 50,
        modalBackdrop: false,
        badgeRadius: 12,
        badgePadding: 6,
        badgeFontSize: 12,
        
        // Animations
        animationsEnabled: true,
        transitionFast: 150,
        transitionBase: 300,
        transitionSlow: 500,
        animationEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        fadeInEnabled: true,
        slideInEnabled: false,
        scaleInEnabled: false,
        animationDelay: 0,
        hoverScale: false,
        hoverLift: true,
        hoverGlow: false,
        hoverIntensity: 10,
        scrollReveal: false,
        scrollParallax: false,
        parallaxSpeed: 20,
        
        // Icons
        iconSize: 24,
        iconSpacing: 8,
        iconDashboard: '📊',
        iconProducts: '📦',
        iconSales: '💰',
        
        // Images
        bgImageUrl: '',
        bgImagePosition: 'center',
        bgImageSize: 'cover',
        bgImageOpacity: 100,
        bgImageRepeat: false,
        sidebarBgImageUrl: '',
        sidebarBgImageOpacity: 20,
        headerBgImageUrl: '',
        
        // Texts
        textDashboard: 'Tableau de bord',
        textProducts: 'Produits',
        textSales: 'Ventes',
        textCategories: 'Catégories',
        textAccounts: 'Comptes',
        textSave: 'Enregistrer',
        textCancel: 'Annuler',
        textDelete: 'Supprimer',
        textEdit: 'Modifier',
        textAdd: 'Ajouter',
        textLoading: 'Chargement...',
        textSuccess: 'Opération réussie',
        textError: 'Une erreur est survenue',
        textConfirm: 'Êtes-vous sûr ?',
        
        // Advanced
        customCSS: '',
        customJS: '',
        metaDescription: '',
        metaKeywords: ''
    };
}

async function saveDesignSettings() {
    try {
        const designRef = doc(db, 'settings', 'design');
        const designDoc = await getDoc(designRef);
        
        if (designDoc.exists()) {
            await updateDoc(designRef, {
                ...designSettings,
                updatedAt: serverTimestamp()
            });
        } else {
            await setDoc(designRef, {
                ...designSettings,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
        
        // Sauvegarder aussi dans localStorage pour application immédiate
        localStorage.setItem('swiftpos_design', JSON.stringify(designSettings));
        
        // Déclencher un événement personnalisé pour notifier toutes les pages
        window.dispatchEvent(new CustomEvent('swiftpos-design-updated', { 
            detail: designSettings 
        }));
        
        // Recharger les styles dans toutes les pages ouvertes
        if (window.parent !== window) {
            // Si on est dans un iframe, notifier le parent
            window.parent.postMessage({ type: 'swiftpos-design-updated', data: designSettings }, '*');
        }
        
        showMessage('Paramètres sauvegardés avec succès', 'success');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        showMessage('Erreur lors de la sauvegarde', 'error');
    }
}

function setupSaveHandlers() {
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            saveDesignSettings();
        });
    }
    
    const resetBtn = document.getElementById('resetAllBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Êtes-vous sûr de vouloir réinitialiser toutes les personnalisations ?')) {
                designSettings = getDefaultSettings();
                populateForm(designSettings);
                applyDesignSettings(designSettings);
                saveDesignSettings();
            }
        });
    }
    
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const dataStr = JSON.stringify(designSettings, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'swiftpos-design-config.json';
            link.click();
            URL.revokeObjectURL(url);
        });
    }
    
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => {
            importFile.click();
        });
        
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const imported = JSON.parse(event.target.result);
                        designSettings = { ...designSettings, ...imported };
                        populateForm(designSettings);
                        applyDesignSettings(designSettings);
                        saveDesignSettings();
                        showMessage('Configuration importée avec succès', 'success');
                    } catch (error) {
                        showMessage('Erreur lors de l\'importation', 'error');
                    }
                };
                reader.readAsText(file);
            }
        });
    }
    
    const previewBtn = document.getElementById('previewBtn');
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            window.open('admin.html', '_blank');
        });
    }
}

function showMessage(message, type = 'info') {
    // Créer un élément de notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? 'var(--color-success)' : type === 'error' ? 'var(--color-error)' : 'var(--color-info)'};
        color: white;
        border-radius: var(--border-radius-md);
        box-shadow: var(--shadow-lg);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Fonction 101+: Application globale des styles sur toutes les pages
export function applyGlobalDesignSettings() {
    const stored = localStorage.getItem('swiftpos_design');
    if (stored) {
        try {
            const settings = JSON.parse(stored);
            applyDesignSettings(settings);
        } catch (error) {
            console.error('Erreur lors de l\'application des styles:', error);
        }
    }
}

// Appliquer les styles au chargement de la page
applyGlobalDesignSettings();

// Écouter les changements de localStorage pour application en temps réel
window.addEventListener('storage', (e) => {
    if (e.key === 'swiftpos_design') {
        try {
            const settings = JSON.parse(e.newValue);
            applyDesignSettings(settings);
        } catch (error) {
            console.error('Erreur lors de l\'application des styles:', error);
        }
    }
});

