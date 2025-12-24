// Script inline pour appliquer les styles de personnalisation IMMÉDIATEMENT
// Ce script doit être placé dans le <head> de chaque page, AVANT le CSS

(function() {
    'use strict';
    
    // Fonction pour appliquer les styles depuis localStorage
    function applyDesignStylesImmediately() {
        try {
            const stored = localStorage.getItem('swiftpos_design');
            if (!stored) return;
            
            const settings = JSON.parse(stored);
            if (!settings) return;
            
            // Créer un style tag dans le head
            let styleEl = document.getElementById('swiftpos-design-inline-styles');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'swiftpos-design-inline-styles';
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
            
            styleEl.textContent = css;
        } catch (error) {
            console.error('Erreur lors de l\'application des styles inline:', error);
        }
    }
    
    // Appliquer immédiatement si le head existe déjà
    if (document.head) {
        applyDesignStylesImmediately();
    } else {
        // Attendre que le head soit disponible
        document.addEventListener('DOMContentLoaded', applyDesignStylesImmediately);
    }
    
    // Écouter les changements de localStorage
    window.addEventListener('storage', function(e) {
        if (e.key === 'swiftpos_design') {
            applyDesignStylesImmediately();
        }
    });
    
    // Écouter les événements personnalisés
    window.addEventListener('swiftpos-design-updated', function(e) {
        if (e.detail) {
            localStorage.setItem('swiftpos_design', JSON.stringify(e.detail));
            applyDesignStylesImmediately();
        }
    });
})();


