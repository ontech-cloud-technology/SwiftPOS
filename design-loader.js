// Chargeur de personnalisation globale pour toutes les pages
// Applique automatiquement les styles de personnalisation

import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import { db } from './firebase-config.js';
import { getCurrentUser } from './auth.js';

let designSettings = null;

// Fonction pour appliquer les styles de personnalisation
function applyDesignSettings(settings) {
    if (!settings) return;
    
    const root = document.documentElement;
    const body = document.body;
    
    // Couleurs primaires
    if (settings.colorPrimary) {
        root.style.setProperty('--color-primary', settings.colorPrimary);
        root.style.setProperty('--color-primary-500', settings.colorPrimary);
    }
    if (settings.colorPrimaryLight) {
        root.style.setProperty('--color-primary-light', settings.colorPrimaryLight);
        root.style.setProperty('--color-primary-100', settings.colorPrimaryLight);
    }
    if (settings.colorPrimaryDark) {
        root.style.setProperty('--color-primary-dark', settings.colorPrimaryDark);
        root.style.setProperty('--color-primary-600', settings.colorPrimaryDark);
        root.style.setProperty('--color-primary-700', settings.colorPrimaryDark);
    }
    
    // Couleurs secondaires
    if (settings.colorSecondary) {
        root.style.setProperty('--color-accent-green', settings.colorSecondary);
        root.style.setProperty('--color-success', settings.colorSecondary);
    }
    if (settings.colorSecondaryLight) {
        root.style.setProperty('--color-accent-green-light', settings.colorSecondaryLight);
        root.style.setProperty('--color-success-light', settings.colorSecondaryLight);
    }
    if (settings.colorAccent) {
        root.style.setProperty('--color-accent-gold', settings.colorAccent);
    }
    
    // Couleurs de fond
    if (settings.colorBgPrimary) {
        root.style.setProperty('--color-bg-primary', settings.colorBgPrimary);
    }
    if (settings.colorBgSecondary) {
        root.style.setProperty('--color-bg-secondary', settings.colorBgSecondary);
        body.style.backgroundColor = settings.colorBgSecondary;
    }
    if (settings.colorBgSidebar) {
        root.style.setProperty('--color-bg-sidebar', settings.colorBgSidebar);
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.style.backgroundColor = settings.colorBgSidebar;
    }
    if (settings.colorBgCard) {
        root.style.setProperty('--color-bg-primary', settings.colorBgCard);
    }
    
    // Couleurs de texte
    if (settings.colorTextPrimary) {
        root.style.setProperty('--color-text-primary', settings.colorTextPrimary);
        root.style.setProperty('--color-gray-text', settings.colorTextPrimary);
    }
    if (settings.colorTextSecondary) {
        root.style.setProperty('--color-text-secondary', settings.colorTextSecondary);
        root.style.setProperty('--color-gray-500', settings.colorTextSecondary);
    }
    if (settings.colorTextSidebar) {
        root.style.setProperty('--color-text-sidebar', settings.colorTextSidebar);
    }
    if (settings.colorTextWhite) {
        root.style.setProperty('--color-text-white', settings.colorTextWhite);
    }
    
    // Couleurs système
    if (settings.colorSuccess) root.style.setProperty('--color-success', settings.colorSuccess);
    if (settings.colorError) root.style.setProperty('--color-error', settings.colorError);
    if (settings.colorWarning) root.style.setProperty('--color-warning', settings.colorWarning);
    if (settings.colorInfo) root.style.setProperty('--color-info', settings.colorInfo);
    
    // Bordures
    if (settings.colorBorder) root.style.setProperty('--color-gray-200', settings.colorBorder);
    if (settings.colorBorderSecondary) root.style.setProperty('--color-gray-300', settings.colorBorderSecondary);
    
    // Typographie
    if (settings.fontFamily) {
        root.style.setProperty('--font-family', settings.fontFamily);
        body.style.fontFamily = settings.fontFamily;
        
        // Charger la police Google Fonts si fournie
        if (settings.customFontUrl) {
            let link = document.querySelector('link[data-custom-font]');
            if (!link) {
                link = document.createElement('link');
                link.rel = 'stylesheet';
                link.setAttribute('data-custom-font', 'true');
                document.head.appendChild(link);
            }
            link.href = settings.customFontUrl;
        }
    }
    
    if (settings.fontSizeBase) {
        root.style.setProperty('font-size', settings.fontSizeBase + 'px');
        body.style.fontSize = settings.fontSizeBase + 'px';
    }
    if (settings.fontSizeH1) {
        root.style.setProperty('--font-size-h1', settings.fontSizeH1 + 'px');
        document.querySelectorAll('h1').forEach(h1 => {
            h1.style.fontSize = settings.fontSizeH1 + 'px';
        });
    }
    if (settings.fontSizeH2) {
        root.style.setProperty('--font-size-h2', settings.fontSizeH2 + 'px');
        document.querySelectorAll('h2').forEach(h2 => {
            h2.style.fontSize = settings.fontSizeH2 + 'px';
        });
    }
    if (settings.fontSizeH3) {
        root.style.setProperty('--font-size-h3', settings.fontSizeH3 + 'px');
        document.querySelectorAll('h3').forEach(h3 => {
            h3.style.fontSize = settings.fontSizeH3 + 'px';
        });
    }
    if (settings.lineHeight) {
        root.style.setProperty('--line-height', settings.lineHeight);
        body.style.lineHeight = settings.lineHeight;
    }
    if (settings.letterSpacing) {
        root.style.setProperty('--letter-spacing', settings.letterSpacing + 'px');
    }
    if (settings.letterSpacingHeading) {
        document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
            heading.style.letterSpacing = settings.letterSpacingHeading + 'px';
        });
    }
    if (settings.fontWeightNormal) {
        root.style.setProperty('--font-weight-normal', settings.fontWeightNormal);
        body.style.fontWeight = settings.fontWeightNormal;
    }
    if (settings.fontWeightHeading) {
        root.style.setProperty('--font-weight-heading', settings.fontWeightHeading);
        document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
            heading.style.fontWeight = settings.fontWeightHeading;
        });
    }
    
    // Layout - Sidebar
    // Toujours ajuster le main-content pour correspondre à la largeur de la sidebar
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (settings.sidebarWidth) {
        const sidebarWidth = settings.sidebarWidth;
        root.style.setProperty('--sidebar-width', sidebarWidth + 'px');
        if (sidebar) sidebar.style.width = sidebarWidth + 'px';
        
        // Ajuster le main-content pour correspondre à la largeur de la sidebar
        if (mainContent) {
            mainContent.style.marginLeft = sidebarWidth + 'px';
            mainContent.style.width = `calc(100vw - ${sidebarWidth}px)`;
            mainContent.style.maxWidth = `calc(100vw - ${sidebarWidth}px)`;
        }
    } else {
        // Si pas de sidebarWidth défini, utiliser la largeur actuelle de la sidebar ou 260px par défaut
        const sidebarWidth = sidebar ? (sidebar.offsetWidth || 260) : 260;
        if (mainContent) {
            mainContent.style.marginLeft = sidebarWidth + 'px';
            mainContent.style.width = `calc(100vw - ${sidebarWidth}px)`;
            mainContent.style.maxWidth = `calc(100vw - ${sidebarWidth}px)`;
        }
    }
    if (settings.sidebarPosition) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            if (settings.sidebarPosition === 'right') {
                sidebar.style.order = '2';
                const main = document.querySelector('.main-content');
                if (main) main.style.order = '1';
            } else {
                sidebar.style.order = '1';
                const main = document.querySelector('.main-content');
                if (main) main.style.order = '2';
            }
        }
    }
    if (settings.sidebarFixed !== undefined) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.style.position = settings.sidebarFixed ? 'fixed' : 'relative';
        }
    }
    if (settings.sidebarOpacity) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.style.opacity = settings.sidebarOpacity / 100;
        }
    }
    
    // Layout - Header
    if (settings.headerHeight) {
        root.style.setProperty('--header-height', settings.headerHeight + 'px');
        const header = document.querySelector('.main-header');
        if (header) header.style.minHeight = settings.headerHeight + 'px';
    }
    if (settings.headerFixed !== undefined) {
        const header = document.querySelector('.main-header');
        if (header) {
            header.style.position = settings.headerFixed ? 'sticky' : 'relative';
            if (settings.headerFixed) {
                header.style.top = '0';
                header.style.zIndex = '100';
            }
        }
    }
    if (settings.headerShadow !== undefined) {
        const header = document.querySelector('.main-header');
        if (header) {
            header.style.boxShadow = settings.headerShadow ? 'var(--shadow-sm)' : 'none';
        }
    }
    if (settings.headerPadding) {
        const header = document.querySelector('.main-header');
        if (header) header.style.padding = `0 ${settings.headerPadding}px`;
    }
    
    // Layout - Contenu
    if (settings.contentMaxWidth) {
        const containers = document.querySelectorAll('.dashboard-container, .content-section, .design-container');
        containers.forEach(container => {
            container.style.maxWidth = settings.contentMaxWidth + 'px';
        });
    }
    if (settings.contentPadding) {
        root.style.setProperty('--content-padding', settings.contentPadding + 'px');
    }
    if (settings.sectionSpacing) {
        root.style.setProperty('--section-spacing', settings.sectionSpacing + 'px');
    }
    if (settings.gridGap) {
        root.style.setProperty('--grid-gap', settings.gridGap + 'px');
        document.querySelectorAll('.dashboard-grid, .design-grid, .quick-actions-grid').forEach(grid => {
            grid.style.gap = settings.gridGap + 'px';
        });
    }
    
    // Layout - Footer
    if (settings.footerEnabled !== undefined) {
        let footer = document.querySelector('footer');
        if (settings.footerEnabled) {
            if (!footer) {
                footer = document.createElement('footer');
                document.body.appendChild(footer);
            }
            footer.style.display = 'block';
            footer.style.height = (settings.footerHeight || 60) + 'px';
            footer.style.textAlign = 'center';
            footer.style.padding = '1rem';
            footer.textContent = settings.footerText || '© 2024 SwiftPOS';
        } else if (footer) {
            footer.style.display = 'none';
        }
    }
    
    // Composants - Boutons
    if (settings.buttonRadius) {
        root.style.setProperty('--border-radius-md', settings.buttonRadius + 'px');
        document.querySelectorAll('.btn').forEach(btn => {
            btn.style.borderRadius = settings.buttonRadius + 'px';
        });
    }
    if (settings.buttonPaddingY) {
        document.querySelectorAll('.btn').forEach(btn => {
            btn.style.paddingTop = settings.buttonPaddingY + 'px';
            btn.style.paddingBottom = settings.buttonPaddingY + 'px';
        });
    }
    if (settings.buttonPaddingX) {
        document.querySelectorAll('.btn').forEach(btn => {
            btn.style.paddingLeft = settings.buttonPaddingX + 'px';
            btn.style.paddingRight = settings.buttonPaddingX + 'px';
        });
    }
    if (settings.buttonFontSize) {
        document.querySelectorAll('.btn').forEach(btn => {
            btn.style.fontSize = settings.buttonFontSize + 'px';
        });
    }
    if (settings.buttonShadow !== undefined) {
        document.querySelectorAll('.btn').forEach(btn => {
            btn.style.boxShadow = settings.buttonShadow ? 'var(--shadow-sm)' : 'none';
        });
    }
    if (settings.buttonUppercase !== undefined) {
        document.querySelectorAll('.btn').forEach(btn => {
            btn.style.textTransform = settings.buttonUppercase ? 'uppercase' : 'none';
        });
    }
    
    // Composants - Cartes
    if (settings.cardRadius) {
        root.style.setProperty('--card-radius', settings.cardRadius + 'px');
        root.style.setProperty('--border-radius-xl', settings.cardRadius + 'px');
        document.querySelectorAll('.dashboard-card, .design-card, .stat-card-modern, .quick-action-card').forEach(card => {
            card.style.borderRadius = settings.cardRadius + 'px';
        });
    }
    if (settings.cardPadding) {
        document.querySelectorAll('.dashboard-card, .design-card').forEach(card => {
            card.style.padding = settings.cardPadding + 'px';
        });
    }
    if (settings.cardShadow !== undefined) {
        const shadowIntensity = settings.cardShadow / 100;
        document.querySelectorAll('.dashboard-card, .design-card, .stat-card-modern').forEach(card => {
            card.style.boxShadow = `0 1px 3px 0 rgba(0, 0, 0, ${0.05 * shadowIntensity}), 0 1px 2px 0 rgba(0, 0, 0, ${0.03 * shadowIntensity})`;
        });
    }
    if (settings.cardHover !== undefined) {
        document.querySelectorAll('.dashboard-card, .design-card, .stat-card-modern').forEach(card => {
            if (settings.cardHover) {
                card.style.transition = 'transform 0.2s, box-shadow 0.2s';
                card.addEventListener('mouseenter', () => {
                    card.style.transform = 'translateY(-2px)';
                    card.style.boxShadow = 'var(--shadow-md)';
                });
                card.addEventListener('mouseleave', () => {
                    card.style.transform = 'translateY(0)';
                    card.style.boxShadow = '';
                });
            }
        });
    }
    if (settings.cardBorder !== undefined) {
        document.querySelectorAll('.dashboard-card, .design-card').forEach(card => {
            card.style.border = settings.cardBorder ? '1px solid var(--color-gray-200)' : 'none';
        });
    }
    
    // Composants - Inputs
    if (settings.inputRadius) {
        root.style.setProperty('--border-radius-sm', settings.inputRadius + 'px');
        document.querySelectorAll('input, select, textarea').forEach(input => {
            input.style.borderRadius = settings.inputRadius + 'px';
        });
    }
    if (settings.inputHeight) {
        document.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], input[type="password"], select').forEach(input => {
            input.style.height = settings.inputHeight + 'px';
        });
    }
    if (settings.inputPaddingX) {
        document.querySelectorAll('input, select, textarea').forEach(input => {
            input.style.paddingLeft = settings.inputPaddingX + 'px';
            input.style.paddingRight = settings.inputPaddingX + 'px';
        });
    }
    if (settings.inputFocusGlow !== undefined) {
        const style = document.createElement('style');
        style.id = 'input-focus-glow';
        style.textContent = settings.inputFocusGlow ? `
            input:focus, select:focus, textarea:focus {
                box-shadow: 0 0 0 3px var(--color-primary-50) !important;
            }
        ` : '';
        const existing = document.getElementById('input-focus-glow');
        if (existing) existing.remove();
        if (settings.inputFocusGlow) document.head.appendChild(style);
    }
    
    // Composants - Tableaux
    if (settings.tableCellRadius) {
        document.querySelectorAll('table td, table th').forEach(cell => {
            cell.style.borderRadius = settings.tableCellRadius + 'px';
        });
    }
    if (settings.tableStriped !== undefined) {
        const style = document.createElement('style');
        style.id = 'table-striped';
        style.textContent = settings.tableStriped ? `
            table tbody tr:nth-child(even) {
                background-color: var(--color-gray-50);
            }
        ` : '';
        const existing = document.getElementById('table-striped');
        if (existing) existing.remove();
        if (settings.tableStriped) document.head.appendChild(style);
    }
    if (settings.tableHover !== undefined) {
        const style = document.createElement('style');
        style.id = 'table-hover';
        style.textContent = settings.tableHover ? `
            table tbody tr:hover {
                background-color: var(--color-gray-100);
            }
        ` : '';
        const existing = document.getElementById('table-hover');
        if (existing) existing.remove();
        if (settings.tableHover) document.head.appendChild(style);
    }
    if (settings.tableBordered !== undefined) {
        document.querySelectorAll('table').forEach(table => {
            table.style.border = settings.tableBordered ? '1px solid var(--color-gray-200)' : 'none';
        });
    }
    
    // Composants - Modales
    if (settings.modalRadius) {
        document.querySelectorAll('.modal, .modal-content').forEach(modal => {
            modal.style.borderRadius = settings.modalRadius + 'px';
        });
    }
    if (settings.modalOverlay !== undefined) {
        const style = document.createElement('style');
        style.id = 'modal-overlay';
        style.textContent = `
            .modal-backdrop {
                background-color: rgba(0, 0, 0, ${settings.modalOverlay / 100}) !important;
            }
        `;
        const existing = document.getElementById('modal-overlay');
        if (existing) existing.remove();
        document.head.appendChild(style);
    }
    if (settings.modalBackdrop !== undefined) {
        const style = document.createElement('style');
        style.id = 'modal-backdrop-blur';
        style.textContent = settings.modalBackdrop ? `
            .modal-backdrop {
                backdrop-filter: blur(4px);
            }
        ` : '';
        const existing = document.getElementById('modal-backdrop-blur');
        if (existing) existing.remove();
        if (settings.modalBackdrop) document.head.appendChild(style);
    }
    
    // Composants - Badges
    if (settings.badgeRadius) {
        document.querySelectorAll('.badge, .tag').forEach(badge => {
            badge.style.borderRadius = settings.badgeRadius + 'px';
        });
    }
    if (settings.badgePadding) {
        document.querySelectorAll('.badge, .tag').forEach(badge => {
            badge.style.padding = settings.badgePadding + 'px';
        });
    }
    if (settings.badgeFontSize) {
        document.querySelectorAll('.badge, .tag').forEach(badge => {
            badge.style.fontSize = settings.badgeFontSize + 'px';
        });
    }
    
    // Transitions et animations
    if (settings.transitionFast) {
        root.style.setProperty('--transition-fast', settings.transitionFast + 'ms');
    }
    if (settings.transitionBase) {
        root.style.setProperty('--transition-base', settings.transitionBase + 'ms');
    }
    if (settings.transitionSlow) {
        root.style.setProperty('--transition-slow', settings.transitionSlow + 'ms');
    }
    if (settings.animationEasing) {
        root.style.setProperty('--animation-easing', settings.animationEasing);
        root.style.setProperty('--transition-base', `${settings.transitionBase || 300}ms ${settings.animationEasing}`);
    }
    
    // Images de fond
    if (settings.bgImageUrl) {
        body.style.backgroundImage = `url(${settings.bgImageUrl})`;
        if (settings.bgImagePosition) body.style.backgroundPosition = settings.bgImagePosition;
        if (settings.bgImageSize) body.style.backgroundSize = settings.bgImageSize;
        if (settings.bgImageOpacity) {
            const opacity = settings.bgImageOpacity / 100;
            body.style.setProperty('--bg-image-opacity', opacity);
            // Créer un overlay pour l'opacité
            let overlay = document.getElementById('bg-image-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'bg-image-overlay';
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: var(--color-bg-secondary);
                    opacity: ${1 - opacity};
                    z-index: -1;
                    pointer-events: none;
                `;
                body.appendChild(overlay);
            } else {
                overlay.style.opacity = 1 - opacity;
            }
        }
        if (settings.bgImageRepeat !== undefined) {
            body.style.backgroundRepeat = settings.bgImageRepeat ? 'repeat' : 'no-repeat';
        }
    }
    
    if (settings.sidebarBgImageUrl) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.style.backgroundImage = `url(${settings.sidebarBgImageUrl})`;
            sidebar.style.backgroundSize = 'cover';
            sidebar.style.backgroundPosition = 'center';
            if (settings.sidebarBgImageOpacity) {
                const opacity = settings.sidebarBgImageOpacity / 100;
                sidebar.style.setProperty('--sidebar-bg-opacity', opacity);
                // Overlay pour sidebar
                let overlay = sidebar.querySelector('.sidebar-bg-overlay');
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.className = 'sidebar-bg-overlay';
                    overlay.style.cssText = `
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background-color: var(--color-bg-sidebar);
                        opacity: ${1 - opacity};
                        z-index: -1;
                        pointer-events: none;
                    `;
                    sidebar.style.position = 'relative';
                    sidebar.appendChild(overlay);
                } else {
                    overlay.style.opacity = 1 - opacity;
                }
            }
        }
    }
    
    if (settings.headerBgImageUrl) {
        const header = document.querySelector('.main-header');
        if (header) {
            header.style.backgroundImage = `url(${settings.headerBgImageUrl})`;
            header.style.backgroundSize = 'cover';
            header.style.backgroundPosition = 'center';
        }
    }
    
    // Nom de l'application
    if (settings.appName) {
        const appNameElements = document.querySelectorAll('.sidebar-header h2, .app-name, [data-app-name]');
        const appIcon = settings.appIcon || '⚡';
        appNameElements.forEach(el => {
            el.textContent = `${appIcon} ${settings.appName}`;
        });
        if (!document.title.includes('Personnalisation')) {
            document.title = settings.appName + (document.title ? ' - ' + document.title.split(' - ').slice(1).join(' - ') : '');
        }
    }
    
    // Logo
    if (settings.logoUrl) {
        const logoElements = document.querySelectorAll('.logo, .app-logo, .sidebar-header img');
        const logoSize = settings.logoSize || 40;
        logoElements.forEach(el => {
            if (el.tagName === 'IMG') {
                el.src = settings.logoUrl;
                el.style.maxHeight = logoSize + 'px';
            } else {
                el.innerHTML = `<img src="${settings.logoUrl}" style="max-height: ${logoSize}px;" alt="Logo">`;
            }
        });
    }
    
    // Favicon
    if (settings.faviconUrl) {
        let favicon = document.querySelector('link[rel="icon"]');
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }
        favicon.href = settings.faviconUrl;
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
    
    // Textes personnalisés
    if (settings.textDashboard) {
        document.querySelectorAll('[data-text="dashboard"]').forEach(el => {
            el.textContent = settings.textDashboard;
        });
    }
    if (settings.textProducts) {
        document.querySelectorAll('[data-text="products"]').forEach(el => {
            el.textContent = settings.textProducts;
        });
    }
    if (settings.textSales) {
        document.querySelectorAll('[data-text="sales"]').forEach(el => {
            el.textContent = settings.textSales;
        });
    }
    // ... autres textes personnalisés
}

// Charger les paramètres de design depuis Firestore
export async function loadDesignSettings() {
    try {
        // D'abord essayer depuis localStorage (plus rapide)
        const stored = localStorage.getItem('swiftpos_design');
        if (stored) {
            try {
                designSettings = JSON.parse(stored);
                applyDesignSettings(designSettings);
            } catch (e) {
                console.error('Erreur lors du parsing des paramètres stockés:', e);
            }
        }
        
        // Vérifier si l'utilisateur est authentifié avant d'accéder à Firestore
        const user = getCurrentUser();
        if (!user) {
            // Si l'utilisateur n'est pas authentifié, utiliser uniquement localStorage
            return;
        }
        
        // Ensuite charger depuis Firestore (pour avoir la dernière version)
        try {
            const designDoc = await getDoc(doc(db, 'settings', 'design'));
            if (designDoc.exists()) {
                designSettings = designDoc.data();
                // Sauvegarder dans localStorage pour accès rapide
                localStorage.setItem('swiftpos_design', JSON.stringify(designSettings));
                applyDesignSettings(designSettings);
            }
        } catch (firestoreError) {
            // Si Firestore n'est pas disponible, utiliser localStorage
            console.warn('Firestore non disponible, utilisation de localStorage:', firestoreError);
            if (stored) {
                try {
                    designSettings = JSON.parse(stored);
                    applyDesignSettings(designSettings);
                } catch (e) {
                    console.error('Erreur lors du parsing des paramètres stockés:', e);
                }
            }
        }
    } catch (error) {
        console.error('Erreur lors du chargement des paramètres de design:', error);
    }
}

// Fonction pour appliquer les styles immédiatement (sans attendre le DOM)
function applyStylesImmediately() {
    const stored = localStorage.getItem('swiftpos_design');
    if (stored) {
        try {
            const settings = JSON.parse(stored);
            // Créer un style tag dans le head pour appliquer les variables CSS immédiatement
            injectGlobalStyles(settings);
        } catch (e) {
            console.error('Erreur lors de l\'application immédiate des styles:', e);
        }
    }
}

// Injecter les styles globaux dans le head
function injectGlobalStyles(settings) {
    if (!settings) return;
    
    let styleEl = document.getElementById('swiftpos-design-styles');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'swiftpos-design-styles';
        document.head.appendChild(styleEl);
    }
    
    let css = ':root {\n';
    
    // Couleurs primaires
    if (settings.colorPrimary) {
        css += `    --color-primary: ${settings.colorPrimary} !important;\n`;
        css += `    --color-primary-500: ${settings.colorPrimary} !important;\n`;
    }
    if (settings.colorPrimaryLight) {
        css += `    --color-primary-light: ${settings.colorPrimaryLight} !important;\n`;
        css += `    --color-primary-100: ${settings.colorPrimaryLight} !important;\n`;
    }
    if (settings.colorPrimaryDark) {
        css += `    --color-primary-dark: ${settings.colorPrimaryDark} !important;\n`;
        css += `    --color-primary-600: ${settings.colorPrimaryDark} !important;\n`;
        css += `    --color-primary-700: ${settings.colorPrimaryDark} !important;\n`;
    }
    
    // Couleurs secondaires
    if (settings.colorSecondary) {
        css += `    --color-accent-green: ${settings.colorSecondary} !important;\n`;
        css += `    --color-success: ${settings.colorSecondary} !important;\n`;
    }
    if (settings.colorSecondaryLight) {
        css += `    --color-accent-green-light: ${settings.colorSecondaryLight} !important;\n`;
        css += `    --color-success-light: ${settings.colorSecondaryLight} !important;\n`;
    }
    if (settings.colorAccent) {
        css += `    --color-accent-gold: ${settings.colorAccent} !important;\n`;
    }
    
    // Couleurs de fond
    if (settings.colorBgPrimary) {
        css += `    --color-bg-primary: ${settings.colorBgPrimary} !important;\n`;
    }
    if (settings.colorBgSecondary) {
        css += `    --color-bg-secondary: ${settings.colorBgSecondary} !important;\n`;
    }
    if (settings.colorBgSidebar) {
        css += `    --color-bg-sidebar: ${settings.colorBgSidebar} !important;\n`;
    }
    if (settings.colorBgCard) {
        css += `    --color-bg-primary: ${settings.colorBgCard} !important;\n`;
    }
    
    // Couleurs de texte
    if (settings.colorTextPrimary) {
        css += `    --color-text-primary: ${settings.colorTextPrimary} !important;\n`;
        css += `    --color-gray-text: ${settings.colorTextPrimary} !important;\n`;
    }
    if (settings.colorTextSecondary) {
        css += `    --color-text-secondary: ${settings.colorTextSecondary} !important;\n`;
        css += `    --color-gray-500: ${settings.colorTextSecondary} !important;\n`;
    }
    if (settings.colorTextSidebar) {
        css += `    --color-text-sidebar: ${settings.colorTextSidebar} !important;\n`;
    }
    if (settings.colorTextWhite) {
        css += `    --color-text-white: ${settings.colorTextWhite} !important;\n`;
    }
    
    // Couleurs système
    if (settings.colorSuccess) css += `    --color-success: ${settings.colorSuccess} !important;\n`;
    if (settings.colorError) css += `    --color-error: ${settings.colorError} !important;\n`;
    if (settings.colorWarning) css += `    --color-warning: ${settings.colorWarning} !important;\n`;
    if (settings.colorInfo) css += `    --color-info: ${settings.colorInfo} !important;\n`;
    
    // Bordures
    if (settings.colorBorder) css += `    --color-gray-200: ${settings.colorBorder} !important;\n`;
    if (settings.colorBorderSecondary) css += `    --color-gray-300: ${settings.colorBorderSecondary} !important;\n`;
    
    // Typographie
    if (settings.fontFamily) {
        css += `    --font-family: ${settings.fontFamily} !important;\n`;
    }
    if (settings.fontSizeBase) {
        css += `    font-size: ${settings.fontSizeBase}px !important;\n`;
    }
    if (settings.fontSizeH1) css += `    --font-size-h1: ${settings.fontSizeH1}px !important;\n`;
    if (settings.fontSizeH2) css += `    --font-size-h2: ${settings.fontSizeH2}px !important;\n`;
    if (settings.fontSizeH3) css += `    --font-size-h3: ${settings.fontSizeH3}px !important;\n`;
    if (settings.lineHeight) css += `    --line-height: ${settings.lineHeight} !important;\n`;
    if (settings.letterSpacing) css += `    --letter-spacing: ${settings.letterSpacing}px !important;\n`;
    if (settings.fontWeightNormal) css += `    --font-weight-normal: ${settings.fontWeightNormal} !important;\n`;
    if (settings.fontWeightHeading) css += `    --font-weight-heading: ${settings.fontWeightHeading} !important;\n`;
    
    // Layout
    if (settings.sidebarWidth) css += `    --sidebar-width: ${settings.sidebarWidth}px !important;\n`;
    if (settings.headerHeight) css += `    --header-height: ${settings.headerHeight}px !important;\n`;
    if (settings.contentMaxWidth) css += `    --content-max-width: ${settings.contentMaxWidth}px !important;\n`;
    if (settings.contentPadding) css += `    --content-padding: ${settings.contentPadding}px !important;\n`;
    if (settings.gridGap) css += `    --grid-gap: ${settings.gridGap}px !important;\n`;
    
    // Composants
    if (settings.buttonRadius) css += `    --border-radius-md: ${settings.buttonRadius}px !important;\n`;
    if (settings.cardRadius) {
        css += `    --card-radius: ${settings.cardRadius}px !important;\n`;
        css += `    --border-radius-xl: ${settings.cardRadius}px !important;\n`;
    }
    if (settings.inputRadius) css += `    --border-radius-sm: ${settings.inputRadius}px !important;\n`;
    if (settings.modalRadius) css += `    --modal-radius: ${settings.modalRadius}px !important;\n`;
    if (settings.badgeRadius) css += `    --badge-radius: ${settings.badgeRadius}px !important;\n`;
    
    // Transitions
    if (settings.transitionFast) css += `    --transition-fast: ${settings.transitionFast}ms !important;\n`;
    if (settings.transitionBase) css += `    --transition-base: ${settings.transitionBase}ms !important;\n`;
    if (settings.transitionSlow) css += `    --transition-slow: ${settings.transitionSlow}ms !important;\n`;
    if (settings.animationEasing) css += `    --animation-easing: ${settings.animationEasing} !important;\n`;
    
    css += '}\n\n';
    
    // Styles pour body
    if (settings.colorBgSecondary) {
        css += `body { background-color: ${settings.colorBgSecondary} !important; }\n`;
    }
    if (settings.fontFamily) {
        css += `body { font-family: ${settings.fontFamily} !important; }\n`;
    }
    if (settings.fontSizeBase) {
        css += `body { font-size: ${settings.fontSizeBase}px !important; }\n`;
    }
    if (settings.lineHeight) {
        css += `body { line-height: ${settings.lineHeight} !important; }\n`;
    }
    
    // Image de fond
    if (settings.bgImageUrl) {
        css += `body { background-image: url(${settings.bgImageUrl}) !important; `;
        if (settings.bgImagePosition) css += `background-position: ${settings.bgImagePosition} !important; `;
        if (settings.bgImageSize) css += `background-size: ${settings.bgImageSize} !important; `;
        if (settings.bgImageRepeat !== undefined) {
            css += `background-repeat: ${settings.bgImageRepeat ? 'repeat' : 'no-repeat'} !important; `;
        }
        css += '}\n';
    }
    
    // Sidebar
    if (settings.colorBgSidebar) {
        css += `.sidebar { background-color: ${settings.colorBgSidebar} !important; }\n`;
    }
    if (settings.sidebarWidth) {
        const sidebarWidth = settings.sidebarWidth;
        css += `.sidebar { width: ${sidebarWidth}px !important; }\n`;
        css += `.main-content { margin-left: ${sidebarWidth}px !important; width: calc(100vw - ${sidebarWidth}px) !important; max-width: calc(100vw - ${sidebarWidth}px) !important; }\n`;
    }
    if (settings.sidebarBgImageUrl) {
        css += `.sidebar { background-image: url(${settings.sidebarBgImageUrl}) !important; background-size: cover !important; background-position: center !important; }\n`;
    }
    
    // Nom de l'application
    if (settings.appName) {
        const appIcon = settings.appIcon || '⚡';
        css += `.sidebar-header h2::before { content: "${appIcon} "; }\n`;
    }
    
    styleEl.textContent = css;
}

// Appliquer les styles immédiatement (avant même que le DOM soit prêt)
applyStylesImmediately();

// Appliquer les styles au chargement de la page
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadDesignSettings();
    });
} else {
    loadDesignSettings();
}

// Écouter les changements de localStorage pour application en temps réel
window.addEventListener('storage', (e) => {
    if (e.key === 'swiftpos_design') {
        try {
            designSettings = JSON.parse(e.newValue);
            applyDesignSettings(designSettings);
            injectGlobalStyles(designSettings);
        } catch (error) {
            console.error('Erreur lors de l\'application des styles:', error);
        }
    }
});

// Écouter les événements personnalisés pour mise à jour en temps réel
window.addEventListener('swiftpos-design-updated', (e) => {
    if (e.detail) {
        designSettings = e.detail;
        applyDesignSettings(designSettings);
        injectGlobalStyles(designSettings);
        localStorage.setItem('swiftpos_design', JSON.stringify(designSettings));
    }
});

// Écouter les messages postMessage (pour iframes)
window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'swiftpos-design-updated') {
        designSettings = e.data.data;
        applyDesignSettings(designSettings);
        injectGlobalStyles(designSettings);
        localStorage.setItem('swiftpos_design', JSON.stringify(designSettings));
    }
});

// Vérifier périodiquement les mises à jour (toutes les 5 secondes)
setInterval(() => {
    const stored = localStorage.getItem('swiftpos_design');
    if (stored) {
        try {
            const current = JSON.parse(stored);
            if (JSON.stringify(current) !== JSON.stringify(designSettings)) {
                designSettings = current;
                applyDesignSettings(designSettings);
                injectGlobalStyles(designSettings);
            }
        } catch (e) {
            // Ignorer les erreurs
        }
    }
}, 5000);

// Exporter pour utilisation dans d'autres modules
export { designSettings, applyDesignSettings };

