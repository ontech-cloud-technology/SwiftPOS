// Gestion des codes-barres
import { logout, getCurrentUser, isAdmin } from './auth.js';
import { getAllProducts, getAllCategories, updateProduct, getProductById } from './firestore.js';

let products = [];
let categories = [];
let filteredProducts = [];
let selectedProducts = new Set();
let currentSearchTerm = '';
let currentCategoryFilter = '';
let currentBarcodeFilter = 'all';
let currentViewingProductId = null;
let viewModalMode = 'view'; // 'view' ou 'print'
let barcodeSettings = {
    format: 'CODE128',
    width: 2,
    height: 100,
    fontSize: 20,
    color: '#000000',
    bgColor: '#FFFFFF',
    showProductName: true,
    showPrice: true,
    showBarcodeValue: true
};
let generatedBarcodes = new Map(); // Stocke les codes-barres générés
let barcodeHistory = []; // Historique des générations
let currentPrintProduct = null; // Produit actuellement en cours d'impression
let selectedPrintFormat = null; // Format sélectionné pour l'impression

// Vérifier l'authentification et le rôle
window.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 [DEBUG] DOMContentLoaded - Début de l\'initialisation');
    const user = getCurrentUser();
    
    if (!user) {
        console.log('❌ [DEBUG] Pas d\'utilisateur, redirection vers login');
        window.location.href = '/login.html';
        return;
    }
    
    if (!isAdmin()) {
        console.log('❌ [DEBUG] Pas admin, redirection vers pos');
        window.location.href = '/pos.html';
        return;
    }
    
    console.log('✅ [DEBUG] Utilisateur authentifié:', user.email);
    
    // Afficher les infos utilisateur
    displayUserInfo(user);
    
    // Charger les données
    console.log('📦 [DEBUG] Chargement des catégories...');
    await loadCategories();
    console.log('📦 [DEBUG] Chargement des produits...');
    await loadProducts();
    
    // Configurer les événements
    console.log('🔧 [DEBUG] Configuration des event listeners...');
    setupEventListeners();
    console.log('✅ [DEBUG] Event listeners configurés');
    
    // Configurer le logout
    setupLogout();
    
    // Mettre à jour les statistiques
    updateStats();
    
    console.log('✅ [DEBUG] Initialisation terminée');
    
    // Vérifier que les boutons existent et sont cliquables
    setTimeout(() => {
        console.log('🔍 [DEBUG] Vérification finale des éléments:');
        const searchBtn = document.getElementById('searchBtn');
        const filterBtn = document.getElementById('filterBtn');
        const settingsBtn = document.getElementById('settingsBtn');
        const viewButtons = document.querySelectorAll('.view-btn');
        
        console.log('  - searchBtn:', !!searchBtn, searchBtn);
        console.log('  - filterBtn:', !!filterBtn, filterBtn);
        console.log('  - settingsBtn:', !!settingsBtn, settingsBtn);
        console.log('  - view-buttons:', viewButtons.length);
        
        // Vérifier les styles des boutons
        if (searchBtn) {
            const btnStyle = window.getComputedStyle(searchBtn);
            console.log('  - searchBtn styles:', {
                display: btnStyle.display,
                visibility: btnStyle.visibility,
                pointerEvents: btnStyle.pointerEvents,
                zIndex: btnStyle.zIndex,
                position: btnStyle.position
            });
        }
        
        if (settingsBtn) {
            const btnStyle = window.getComputedStyle(settingsBtn);
            console.log('  - settingsBtn styles:', {
                display: btnStyle.display,
                visibility: btnStyle.visibility,
                pointerEvents: btnStyle.pointerEvents,
                zIndex: btnStyle.zIndex,
                position: btnStyle.position
            });
        }
        
        // Vérifier s'il y a des éléments qui recouvrent les boutons
        if (settingsBtn) {
            const rect = settingsBtn.getBoundingClientRect();
            const elementAtPoint = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            console.log('  - Élément au centre de settingsBtn:', elementAtPoint);
            console.log('  - Est-ce le bouton lui-même?', elementAtPoint === settingsBtn || settingsBtn.contains(elementAtPoint));
        }
        
        // Vérifier les event listeners attachés
        console.log('🔍 [DEBUG] Vérification des event listeners:');
        if (settingsBtn) {
            // Note: On ne peut pas vérifier directement les event listeners, mais on peut vérifier si le bouton est cliquable
            console.log('  - settingsBtn est cliquable:', settingsBtn.disabled === false);
        }
    }, 1000);
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

async function loadCategories() {
    try {
        categories = await getAllCategories();
        populateCategoryFilter();
    } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
    }
}

function populateCategoryFilter() {
    const filter = document.getElementById('categoryFilter');
    if (!filter) return;
    
    filter.innerHTML = '<option value="">Toutes les catégories</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = `${category.icon || '🏷️'} ${category.name}`;
        filter.appendChild(option);
    });
}

async function loadProducts() {
    try {
        products = await getAllProducts();
        filteredProducts = [...products];
        
        // Générer des codes-barres uniques pour les produits qui n'en ont pas
        await ensureBarcodesExist();
        
        displayProducts(filteredProducts);
        updateStats();
    } catch (error) {
        console.error('Erreur lors du chargement des produits:', error);
        showToast('Erreur lors du chargement des produits', 'error');
    }
}

// Fonction 1: Générer un code-barres unique pour un produit
function generateBarcodeForProduct(product) {
    if (product.barcode) {
        return product.barcode;
    }
    
    // Générer un code-barres unique basé sur l'ID du produit
    // Format: 8 chiffres + ID hashé
    const productIdHash = hashString(product.id);
    const timestamp = Date.now().toString().slice(-6);
    const barcode = `${timestamp}${productIdHash.slice(0, 6)}`.padStart(13, '0');
    
    return barcode;
}

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString();
}

// Fonction 2: S'assurer que tous les produits ont un code-barres
async function ensureBarcodesExist() {
    const productsToUpdate = [];
    
    for (const product of products) {
        if (!product.barcode) {
            const barcode = generateBarcodeForProduct(product);
            productsToUpdate.push({
                product,
                barcode
            });
        }
    }
    
    // Mettre à jour les produits en lot
    for (const { product, barcode } of productsToUpdate) {
        try {
            await updateProduct(product.id, { barcode });
            product.barcode = barcode;
        } catch (error) {
            console.error(`Erreur lors de la mise à jour du produit ${product.id}:`, error);
        }
    }
}

// Fonction 3: Générer le SVG du code-barres
function generateBarcodeSVG(product, settings = null) {
    const settingsToUse = settings || barcodeSettings;
    const barcode = product.barcode || generateBarcodeForProduct(product);
    
    // Créer un élément SVG temporaire
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', `barcode-${product.id}`);
    // Laisser JsBarcode définir les dimensions automatiquement
    // On peut définir width="100%" après la génération si nécessaire
    
    try {
        // Utiliser JsBarcode pour générer le code-barres
        JsBarcode(svg, barcode, {
            format: settingsToUse.format,
            width: settingsToUse.width,
            height: settingsToUse.height,
            displayValue: settingsToUse.showBarcodeValue,
            fontSize: settingsToUse.fontSize,
            textMargin: 5,
            margin: 10,
            background: settingsToUse.bgColor,
            lineColor: settingsToUse.color,
            valid: function(valid) {
                if (!valid) {
                    console.warn(`Code-barres invalide pour le produit ${product.id}`);
                }
            }
        });
        
        // Après la génération, ajuster le SVG pour qu'il s'adapte au conteneur
        // JsBarcode définit les dimensions, on peut maintenant définir width="100%"
        // et utiliser viewBox pour préserver les proportions
        const currentWidth = svg.getAttribute('width');
        const currentHeight = svg.getAttribute('height');
        if (currentWidth && currentHeight) {
            // Convertir les valeurs en nombres (enlever "px" si présent)
            const widthNum = parseFloat(currentWidth.toString().replace('px', ''));
            const heightNum = parseFloat(currentHeight.toString().replace('px', ''));
            if (!isNaN(widthNum) && !isNaN(heightNum)) {
                svg.setAttribute('viewBox', `0 0 ${widthNum} ${heightNum}`);
                svg.setAttribute('width', '100%');
                svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            }
        }
    } catch (error) {
        console.error('Erreur lors de la génération du code-barres:', error);
        // Créer un SVG d'erreur avec des dimensions valides
        svg.setAttribute('width', '200');
        svg.setAttribute('height', '50');
        svg.setAttribute('viewBox', '0 0 200 50');
        svg.innerHTML = `
            <text x="50%" y="50%" text-anchor="middle" fill="red" dominant-baseline="middle">Erreur</text>
        `;
    }
    
    return svg;
}

// Fonction 4: Afficher les produits
function displayProducts(productsList) {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;
    
    if (productsList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 3rem;">
                    <div class="empty-state">
                        <div class="empty-state-icon">📦</div>
                        <div class="empty-state-title">Aucun produit trouvé</div>
                        <div class="empty-state-message">Ajustez vos filtres pour voir plus de résultats</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = productsList.map(product => createProductRow(product)).join('');
    
    // Attacher les événements après le rendu
    attachProductTableEvents();
}

// Fonction 5: Créer une ligne de tableau produit
function createProductRow(product) {
    const barcode = product.barcode || generateBarcodeForProduct(product);
    const isSelected = selectedProducts.has(product.id);
    const category = categories.find(c => c.id === product.categoryId);
    const price = parseFloat(product.price || 0);
    const stock = parseFloat(product.stock || 0);
    
    return `
        <tr class="${isSelected ? 'selected' : ''}" data-product-id="${product.id}">
            <td>
                <input type="checkbox" class="table-checkbox product-checkbox" data-product-id="${product.id}" ${isSelected ? 'checked' : ''}>
            </td>
            <td class="product-image-cell">
                ${product.imageUrl ? 
                    `<img src="${product.imageUrl}" alt="${product.name}" class="product-image">` : 
                    '<div class="product-image-placeholder">📦</div>'
                }
            </td>
            <td style="font-weight: 600; color: var(--color-text-primary);">${escapeHtml(product.name)}</td>
            <td>$${price.toFixed(2)}</td>
            <td>
                ${category ? `
                    <div style="display: inline-flex; align-items: center; gap: 0.25rem;">
                        <span>${category.icon || '🏷️'}</span>
                        <span>${escapeHtml(category.name)}</span>
                    </div>
                ` : '<span style="color: var(--color-text-secondary);">Sans catégorie</span>'}
            </td>
            <td>
                <span style="padding: 0.25rem 0.5rem; background: ${stock > 10 ? 'var(--color-success)' : stock > 0 ? 'var(--color-warning)' : 'var(--color-error)'}; color: white; border-radius: var(--border-radius-sm); font-size: 0.875rem; font-weight: 600;">
                    ${stock}
                </span>
            </td>
            <td>
                <span style="font-family: 'Courier New', monospace; font-size: 0.875rem; color: var(--color-text-secondary);">
                    ${barcode}
                </span>
            </td>
            <td style="text-align: right;">
                <div class="table-actions">
                    <button class="view-btn" type="button" data-product-id="${product.id}">
                        👁️ Voir
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// Fonction 6: Attacher les événements au tableau
function attachProductTableEvents() {
    // Checkbox "Sélectionner tout"
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            document.querySelectorAll('.product-checkbox').forEach(checkbox => {
                checkbox.checked = isChecked;
                const productId = checkbox.dataset.productId;
                if (isChecked) {
                    selectedProducts.add(productId);
                } else {
                    selectedProducts.delete(productId);
                }
            });
            updateTableSelections();
            updateStats();
        });
    }
    
    // Checkboxes individuels
    document.querySelectorAll('.product-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const productId = e.target.dataset.productId;
            if (e.target.checked) {
                selectedProducts.add(productId);
            } else {
                selectedProducts.delete(productId);
            }
            updateTableSelections();
            updateStats();
        });
    });
    
    // Boutons "Voir"
    const viewButtons = document.querySelectorAll('.view-btn');
    console.log('👁️ [DEBUG] Nombre de boutons "Voir" trouvés:', viewButtons.length);
    viewButtons.forEach((btn, index) => {
        console.log(`👁️ [DEBUG] Ajout event listener sur view-btn #${index}`, btn);
        btn.addEventListener('click', (e) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:403',message:'view-btn click',data:{eventType:'click',productId:btn.dataset.productId,index:index},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            console.log('👁️ [DEBUG] Clic sur view-btn détecté!', e, btn);
            e.preventDefault();
            e.stopPropagation();
            const productId = btn.dataset.productId;
            console.log('👁️ [DEBUG] productId:', productId);
            if (productId) {
                window.openViewBarcodeModal(productId);
            } else {
                console.error('❌ [DEBUG] productId manquant sur le bouton!');
            }
        });
    });
}

// Fonction 7: Mettre à jour les sélections dans le tableau
function updateTableSelections() {
    document.querySelectorAll('tbody tr').forEach(row => {
        const productId = row.dataset.productId;
        if (selectedProducts.has(productId)) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    });
    
    // Mettre à jour le checkbox "Sélectionner tout"
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        const allChecked = filteredProducts.length > 0 && 
            filteredProducts.every(p => selectedProducts.has(p.id));
        selectAllCheckbox.checked = allChecked;
    }
}

// Fonction 9: Mettre à jour les statistiques
function updateStats() {
    const selectionInfoEl = document.getElementById('selectionInfo');
    
    if (selectionInfoEl) {
        selectionInfoEl.textContent = `${selectedProducts.size} produit(s) sélectionné(s)`;
    }
}

// Fonction 10: Configurer les événements
function setupEventListeners() {
    console.log('🔧 [DEBUG] setupEventListeners() appelée');
    
    // Modal de recherche
    const searchBtn = document.getElementById('searchBtn');
    const searchModal = document.getElementById('searchModal');
    const closeSearchModalBtn = document.getElementById('closeSearchModalBtn');
    const cancelSearchBtn = document.getElementById('cancelSearchBtn');
    const applySearchBtn = document.getElementById('applySearchBtn');
    const searchInputModal = document.getElementById('searchInputModal');
    
    console.log('🔍 [DEBUG] Éléments de recherche:', {
        searchBtn: !!searchBtn,
        searchModal: !!searchModal,
        closeSearchModalBtn: !!closeSearchModalBtn,
        cancelSearchBtn: !!cancelSearchBtn,
        applySearchBtn: !!applySearchBtn,
        searchInputModal: !!searchInputModal
    });
    
    if (searchBtn) {
        console.log('✅ [DEBUG] Ajout event listener sur searchBtn');
        searchBtn.addEventListener('click', (e) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:470',message:'searchBtn click',data:{eventType:'click',targetId:searchBtn.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            console.log('🔍 [DEBUG] Clic sur searchBtn détecté!', e);
            e.preventDefault();
            e.stopPropagation();
            if (searchModal) {
                // #region agent log
                const modalBefore = {
                    className: searchModal.className,
                    display: window.getComputedStyle(searchModal).display,
                    opacity: window.getComputedStyle(searchModal).opacity,
                    visibility: window.getComputedStyle(searchModal).visibility,
                    zIndex: window.getComputedStyle(searchModal).zIndex,
                    offsetParent: searchModal.offsetParent !== null
                };
                fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:475',message:'modal state before',data:modalBefore,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                console.log('🔍 [DEBUG] Ouverture du modal de recherche');
                console.log('🔍 [DEBUG] Classes du modal avant:', searchModal.className);
                searchModal.classList.add('active');
                // FORCER les styles directement sur l'overlay
                searchModal.style.setProperty('display', 'flex', 'important');
                searchModal.style.setProperty('opacity', '1', 'important');
                searchModal.style.setProperty('visibility', 'visible', 'important');
                searchModal.style.setProperty('pointer-events', 'auto', 'important');
                searchModal.style.setProperty('z-index', '10000', 'important');
                
                // FORCER les styles sur le contenu .modal à l'intérieur
                const searchModalContent = searchModal.querySelector('.modal');
                if (searchModalContent) {
                    searchModalContent.style.setProperty('display', 'block', 'important');
                    searchModalContent.style.setProperty('opacity', '1', 'important');
                    searchModalContent.style.setProperty('visibility', 'visible', 'important');
                }
                
                // #region agent log
                const modalAfter = {
                    className: searchModal.className,
                    display: window.getComputedStyle(searchModal).display,
                    opacity: window.getComputedStyle(searchModal).opacity,
                    visibility: window.getComputedStyle(searchModal).visibility,
                    zIndex: window.getComputedStyle(searchModal).zIndex,
                    offsetParent: searchModal.offsetParent !== null,
                    hasActiveClass: searchModal.classList.contains('active')
                };
                const modalContent = searchModal.querySelector('.modal');
                const modalContentStyles = modalContent ? {
                    display: window.getComputedStyle(modalContent).display,
                    opacity: window.getComputedStyle(modalContent).opacity,
                    visibility: window.getComputedStyle(modalContent).visibility,
                    zIndex: window.getComputedStyle(modalContent).zIndex,
                    offsetParent: modalContent.offsetParent !== null,
                    offsetWidth: modalContent.offsetWidth,
                    offsetHeight: modalContent.offsetHeight
                } : null;
                fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:485',message:'modal state after',data:{overlay:modalAfter,content:modalContentStyles},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                
                console.log('🔍 [DEBUG] Classes du modal après:', searchModal.className);
                console.log('🔍 [DEBUG] Modal a la classe active?', searchModal.classList.contains('active'));
                document.body.style.overflow = 'hidden';
                if (searchInputModal) {
                    searchInputModal.value = currentSearchTerm || '';
                    searchInputModal.focus();
                }
            } else {
                console.error('❌ [DEBUG] searchModal est null!');
            }
        });
    } else {
        console.error('❌ [DEBUG] searchBtn non trouvé dans le DOM!');
    }
    
    const closeSearchModal = () => {
        if (searchModal) {
            searchModal.classList.remove('active');
            // FORCER les styles pour fermer
            searchModal.style.removeProperty('display');
            searchModal.style.removeProperty('opacity');
            searchModal.style.removeProperty('visibility');
            searchModal.style.removeProperty('pointer-events');
            searchModal.style.removeProperty('z-index');
            const searchModalContent = searchModal.querySelector('.modal');
            if (searchModalContent) {
                searchModalContent.style.removeProperty('display');
                searchModalContent.style.removeProperty('opacity');
                searchModalContent.style.removeProperty('visibility');
            }
            document.body.style.overflow = '';
        }
    };
    
    if (closeSearchModalBtn) closeSearchModalBtn.addEventListener('click', closeSearchModal);
    if (cancelSearchBtn) cancelSearchBtn.addEventListener('click', closeSearchModal);
    
    if (searchModal) {
        searchModal.addEventListener('click', (e) => {
            if (e.target === searchModal) closeSearchModal();
        });
    }
    
    if (applySearchBtn) {
        applySearchBtn.addEventListener('click', () => {
            if (searchInputModal) {
                currentSearchTerm = searchInputModal.value.toLowerCase();
            }
            applyFilters();
            closeSearchModal();
        });
    }
    
    if (searchInputModal) {
        searchInputModal.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (applySearchBtn) applySearchBtn.click();
            }
        });
    }
    
    // Modal de filtre
    const filterBtn = document.getElementById('filterBtn');
    const filterModal = document.getElementById('filterModal');
    const closeFilterModalBtn = document.getElementById('closeFilterModalBtn');
    const resetFilterBtn = document.getElementById('resetFilterBtn');
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    const categoryFilterModal = document.getElementById('categoryFilterModal');
    const barcodeFilterModal = document.getElementById('barcodeFilterModal');
    
    console.log('🎯 [DEBUG] Éléments de filtre:', {
        filterBtn: !!filterBtn,
        filterModal: !!filterModal,
        closeFilterModalBtn: !!closeFilterModalBtn,
        resetFilterBtn: !!resetFilterBtn,
        applyFilterBtn: !!applyFilterBtn
    });
    
    // Populer le filtre de catégorie dans le modal
    if (categoryFilterModal) {
        categoryFilterModal.innerHTML = '<option value="">Toutes les catégories</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = `${category.icon || '🏷️'} ${category.name}`;
            categoryFilterModal.appendChild(option);
        });
    }
    
    if (filterBtn) {
        console.log('✅ [DEBUG] Ajout event listener sur filterBtn');
        filterBtn.addEventListener('click', (e) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:568',message:'filterBtn click',data:{eventType:'click',targetId:filterBtn.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            console.log('🎯 [DEBUG] Clic sur filterBtn détecté!', e);
            e.preventDefault();
            e.stopPropagation();
            if (filterModal) {
                // #region agent log
                const modalBefore = {
                    className: filterModal.className,
                    display: window.getComputedStyle(filterModal).display,
                    opacity: window.getComputedStyle(filterModal).opacity,
                    visibility: window.getComputedStyle(filterModal).visibility,
                    zIndex: window.getComputedStyle(filterModal).zIndex,
                    offsetParent: filterModal.offsetParent !== null
                };
                fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:573',message:'filter modal state before',data:modalBefore,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
                console.log('🎯 [DEBUG] Ouverture du modal de filtre');
                console.log('🎯 [DEBUG] Classes du modal avant:', filterModal.className);
                filterModal.classList.add('active');
                // FORCER les styles directement sur l'overlay
                filterModal.style.setProperty('display', 'flex', 'important');
                filterModal.style.setProperty('opacity', '1', 'important');
                filterModal.style.setProperty('visibility', 'visible', 'important');
                filterModal.style.setProperty('pointer-events', 'auto', 'important');
                filterModal.style.setProperty('z-index', '10000', 'important');
                
                // FORCER les styles sur le contenu .modal à l'intérieur
                const filterModalContent = filterModal.querySelector('.modal');
                if (filterModalContent) {
                    filterModalContent.style.setProperty('display', 'block', 'important');
                    filterModalContent.style.setProperty('opacity', '1', 'important');
                    filterModalContent.style.setProperty('visibility', 'visible', 'important');
                }
                
                // #region agent log
                const modalAfter = {
                    className: filterModal.className,
                    display: window.getComputedStyle(filterModal).display,
                    opacity: window.getComputedStyle(filterModal).opacity,
                    visibility: window.getComputedStyle(filterModal).visibility,
                    zIndex: window.getComputedStyle(filterModal).zIndex,
                    offsetParent: filterModal.offsetParent !== null,
                    hasActiveClass: filterModal.classList.contains('active')
                };
                const modalContent = filterModal.querySelector('.modal');
                const modalContentStyles = modalContent ? {
                    display: window.getComputedStyle(modalContent).display,
                    opacity: window.getComputedStyle(modalContent).opacity,
                    visibility: window.getComputedStyle(modalContent).visibility,
                    zIndex: window.getComputedStyle(modalContent).zIndex,
                    offsetParent: modalContent.offsetParent !== null,
                    offsetWidth: modalContent.offsetWidth,
                    offsetHeight: modalContent.offsetHeight
                } : null;
                fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:583',message:'filter modal state after',data:{overlay:modalAfter,content:modalContentStyles},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
                
                console.log('🎯 [DEBUG] Classes du modal après:', filterModal.className);
                console.log('🎯 [DEBUG] Modal a la classe active?', filterModal.classList.contains('active'));
                document.body.style.overflow = 'hidden';
                if (categoryFilterModal) categoryFilterModal.value = currentCategoryFilter || '';
                if (barcodeFilterModal) barcodeFilterModal.value = currentBarcodeFilter || 'all';
            } else {
                console.error('❌ [DEBUG] filterModal est null!');
            }
        });
    } else {
        console.error('❌ [DEBUG] filterBtn non trouvé dans le DOM!');
    }
    
    const closeFilterModal = () => {
        if (filterModal) {
            filterModal.classList.remove('active');
            // FORCER les styles pour fermer
            filterModal.style.removeProperty('display');
            filterModal.style.removeProperty('opacity');
            filterModal.style.removeProperty('visibility');
            filterModal.style.removeProperty('pointer-events');
            filterModal.style.removeProperty('z-index');
            const filterModalContent = filterModal.querySelector('.modal');
            if (filterModalContent) {
                filterModalContent.style.removeProperty('display');
                filterModalContent.style.removeProperty('opacity');
                filterModalContent.style.removeProperty('visibility');
            }
            document.body.style.overflow = '';
        }
    };
    
    if (closeFilterModalBtn) closeFilterModalBtn.addEventListener('click', closeFilterModal);
    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', () => {
            currentCategoryFilter = '';
            currentBarcodeFilter = 'all';
            if (categoryFilterModal) categoryFilterModal.value = '';
            if (barcodeFilterModal) barcodeFilterModal.value = 'all';
            applyFilters();
            closeFilterModal();
        });
    }
    
    if (filterModal) {
        filterModal.addEventListener('click', (e) => {
            if (e.target === filterModal) closeFilterModal();
        });
    }
    
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', () => {
            if (categoryFilterModal) currentCategoryFilter = categoryFilterModal.value;
            if (barcodeFilterModal) currentBarcodeFilter = barcodeFilterModal.value;
            applyFilters();
            closeFilterModal();
        });
    }
    
    // Modal des paramètres de génération
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
    const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    
    console.log('⚙️ [DEBUG] Éléments de paramètres:', {
        settingsBtn: !!settingsBtn,
        settingsModal: !!settingsModal,
        closeSettingsModalBtn: !!closeSettingsModalBtn,
        cancelSettingsBtn: !!cancelSettingsBtn,
        saveSettingsBtn: !!saveSettingsBtn
    });
    
    const openSettingsModal = () => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:649',message:'openSettingsModal called',data:{modalExists:!!settingsModal},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        console.log('⚙️ [DEBUG] openSettingsModal() appelée');
        if (settingsModal) {
            console.log('⚙️ [DEBUG] Modal trouvé, ouverture...');
            // #region agent log
            const modalBefore = {
                className: settingsModal.className,
                display: window.getComputedStyle(settingsModal).display,
                opacity: window.getComputedStyle(settingsModal).opacity,
                visibility: window.getComputedStyle(settingsModal).visibility,
                zIndex: window.getComputedStyle(settingsModal).zIndex,
                offsetParent: settingsModal.offsetParent !== null
            };
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:653',message:'settings modal state before',data:modalBefore,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            // Charger les valeurs actuelles dans le modal
            const formatSelect = document.getElementById('barcodeFormat');
            const widthInput = document.getElementById('barcodeWidth');
            const heightInput = document.getElementById('barcodeHeight');
            const fontSizeInput = document.getElementById('barcodeFontSize');
            const colorInput = document.getElementById('barcodeColor');
            const bgColorInput = document.getElementById('barcodeBgColor');
            const showProductNameCheck = document.getElementById('showProductName');
            const showPriceCheck = document.getElementById('showPrice');
            const showBarcodeValueCheck = document.getElementById('showBarcodeValue');
            
            if (formatSelect) formatSelect.value = barcodeSettings.format || 'CODE128';
            if (widthInput) widthInput.value = barcodeSettings.width || 2;
            if (heightInput) heightInput.value = barcodeSettings.height || 100;
            if (fontSizeInput) fontSizeInput.value = barcodeSettings.fontSize || 20;
            if (colorInput) colorInput.value = barcodeSettings.color || '#000000';
            if (bgColorInput) bgColorInput.value = barcodeSettings.bgColor || '#FFFFFF';
            if (showProductNameCheck) showProductNameCheck.checked = barcodeSettings.showProductName !== false;
            if (showPriceCheck) showPriceCheck.checked = barcodeSettings.showPrice !== false;
            if (showBarcodeValueCheck) showBarcodeValueCheck.checked = barcodeSettings.showBarcodeValue !== false;
            
            console.log('⚙️ [DEBUG] Classes du modal avant:', settingsModal.className);
            settingsModal.classList.add('active');
            
            // FORCER les styles directement pour contourner les conflits CSS
            settingsModal.style.setProperty('display', 'flex', 'important');
            settingsModal.style.setProperty('opacity', '1', 'important');
            settingsModal.style.setProperty('visibility', 'visible', 'important');
            settingsModal.style.setProperty('pointer-events', 'auto', 'important');
            settingsModal.style.setProperty('z-index', '10000', 'important');
            
            // FORCER les styles sur le contenu .modal à l'intérieur
            const settingsModalContent = settingsModal.querySelector('.modal');
            if (settingsModalContent) {
                settingsModalContent.style.setProperty('display', 'block', 'important');
                settingsModalContent.style.setProperty('opacity', '1', 'important');
                settingsModalContent.style.setProperty('visibility', 'visible', 'important');
            }
            
            // #region agent log
            const modalAfter = {
                className: settingsModal.className,
                display: window.getComputedStyle(settingsModal).display,
                opacity: window.getComputedStyle(settingsModal).opacity,
                visibility: window.getComputedStyle(settingsModal).visibility,
                zIndex: window.getComputedStyle(settingsModal).zIndex,
                offsetParent: settingsModal.offsetParent !== null,
                hasActiveClass: settingsModal.classList.contains('active')
            };
            const modalContent = settingsModal.querySelector('.modal');
            const modalContentStyles = modalContent ? {
                display: window.getComputedStyle(modalContent).display,
                opacity: window.getComputedStyle(modalContent).opacity,
                visibility: window.getComputedStyle(modalContent).visibility,
                zIndex: window.getComputedStyle(modalContent).zIndex,
                offsetParent: modalContent.offsetParent !== null,
                offsetWidth: modalContent.offsetWidth,
                offsetHeight: modalContent.offsetHeight,
                position: window.getComputedStyle(modalContent).position
            } : null;
            const conflictingStyles = modalContent ? {
                hasStyleCssRule: document.querySelector('style[data-source="style.css"]') !== null,
                computedDisplay: window.getComputedStyle(modalContent).display
            } : null;
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:685',message:'settings modal state after',data:{overlay:modalAfter,content:modalContentStyles,conflicting:conflictingStyles},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            
            console.log('⚙️ [DEBUG] Classes du modal après:', settingsModal.className);
            console.log('⚙️ [DEBUG] Modal a la classe active?', settingsModal.classList.contains('active'));
            
            // Vérifier le style calculé
            const computedStyle = window.getComputedStyle(settingsModal);
            console.log('⚙️ [DEBUG] Style display du modal:', computedStyle.display);
            console.log('⚙️ [DEBUG] Style visibility:', computedStyle.visibility);
            console.log('⚙️ [DEBUG] Style opacity:', computedStyle.opacity);
            console.log('⚙️ [DEBUG] Style z-index:', computedStyle.zIndex);
            console.log('⚙️ [DEBUG] Style position:', computedStyle.position);
            console.log('⚙️ [DEBUG] Modal visible dans le DOM?', settingsModal.offsetParent !== null);
            
            document.body.style.overflow = 'hidden';
        } else {
            console.error('❌ [DEBUG] settingsModal est null!');
        }
    };
    
    const closeSettingsModal = () => {
        console.log('⚙️ [DEBUG] closeSettingsModal() appelée');
        if (settingsModal) {
            settingsModal.classList.remove('active');
            // FORCER les styles pour fermer
            settingsModal.style.removeProperty('display');
            settingsModal.style.removeProperty('opacity');
            settingsModal.style.removeProperty('visibility');
            settingsModal.style.removeProperty('pointer-events');
            settingsModal.style.removeProperty('z-index');
            const settingsModalContent = settingsModal.querySelector('.modal');
            if (settingsModalContent) {
                settingsModalContent.style.removeProperty('display');
                settingsModalContent.style.removeProperty('opacity');
                settingsModalContent.style.removeProperty('visibility');
            }
            document.body.style.overflow = '';
        }
    };
    
    if (settingsBtn) {
        console.log('✅ [DEBUG] Ajout event listener sur settingsBtn');
        settingsBtn.addEventListener('click', (e) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:717',message:'settingsBtn click',data:{eventType:'click',targetId:settingsBtn.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            console.log('⚙️ [DEBUG] Clic sur settingsBtn détecté!', e);
            e.preventDefault();
            e.stopPropagation();
            openSettingsModal();
        });
    } else {
        console.error('❌ [DEBUG] settingsBtn non trouvé dans le DOM!');
    }
    
    if (closeSettingsModalBtn) {
        closeSettingsModalBtn.addEventListener('click', closeSettingsModal);
    }
    
    if (cancelSettingsBtn) {
        cancelSettingsBtn.addEventListener('click', closeSettingsModal);
    }
    
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            // Mettre à jour les paramètres
            updateBarcodeSettings();
            closeSettingsModal();
            showToast('Paramètres enregistrés avec succès', 'success');
        });
    }
    
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) closeSettingsModal();
        });
    }
    
    // Fermer avec Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsModal && settingsModal.classList.contains('active')) {
            closeSettingsModal();
        }
    });
    
    // Modal de téléchargement
    const downloadModal = document.getElementById('downloadModal');
    const closeDownloadModalBtn = document.getElementById('closeDownloadModalBtn');
    const cancelDownloadBtn = document.getElementById('cancelDownloadBtn');
    
    const closeDownloadModal = () => {
        if (downloadModal) {
            downloadModal.classList.remove('active');
            downloadModal.style.removeProperty('display');
            downloadModal.style.removeProperty('opacity');
            downloadModal.style.removeProperty('visibility');
            downloadModal.style.removeProperty('pointer-events');
            downloadModal.style.removeProperty('z-index');
            const downloadModalContent = downloadModal.querySelector('.modal');
            if (downloadModalContent) {
                downloadModalContent.style.removeProperty('display');
                downloadModalContent.style.removeProperty('opacity');
                downloadModalContent.style.removeProperty('visibility');
            }
            document.body.style.overflow = '';
            currentViewingProductId = null;
        }
    };
    
    if (closeDownloadModalBtn) closeDownloadModalBtn.addEventListener('click', closeDownloadModal);
    if (cancelDownloadBtn) cancelDownloadBtn.addEventListener('click', closeDownloadModal);
    
    if (downloadModal) {
        downloadModal.addEventListener('click', (e) => {
            if (e.target === downloadModal) closeDownloadModal();
        });
    }
    
    // Gérer les clics sur les méthodes de téléchargement
    document.querySelectorAll('.download-method-card').forEach(card => {
        card.addEventListener('click', () => {
            // Retirer l'état actif de toutes les cartes
            document.querySelectorAll('.download-method-card').forEach(c => {
                c.classList.remove('active');
            });
            
            // Ajouter l'état actif à la carte cliquée
            card.classList.add('active');
            
            // Récupérer la méthode
            const method = card.dataset.method;
            
            // Exporter avec la méthode choisie
            if (currentViewingProductId) {
                setTimeout(() => {
                    exportBarcodeWithQuantity(currentViewingProductId, method);
                    closeDownloadModal();
                }, 300);
            }
        });
    });
    
    // Paramètres
    const settingsInputs = [
        'barcodeFormat', 'barcodeWidth', 'barcodeHeight', 
        'barcodeFontSize', 'barcodeColor', 'barcodeBgColor',
        'showProductName', 'showPrice', 'showBarcodeValue'
    ];
    
    settingsInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('change', () => {
                updateBarcodeSettings();
            });
        }
    });
    
    // Actions en lot
    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', selectAllProducts);
    }
    
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', deselectAllProducts);
    }
    
    const generateSelectedBtn = document.getElementById('generateSelectedBtn');
    if (generateSelectedBtn) {
        generateSelectedBtn.addEventListener('click', generateSelectedBarcodes);
    }
    
    const generateAllBtn = document.getElementById('generateAllBtn');
    if (generateAllBtn) {
        generateAllBtn.addEventListener('click', generateAllBarcodes);
    }
    
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => {
            if (selectedProducts.size === 0) {
                showToast('Veuillez sélectionner au moins un produit', 'warning');
                return;
            }
            openBulkDownloadModal('pdf');
        });
    }
    
    const exportPngBtn = document.getElementById('exportPngBtn');
    if (exportPngBtn) {
        exportPngBtn.addEventListener('click', () => {
            if (selectedProducts.size === 0) {
                showToast('Veuillez sélectionner au moins un produit', 'warning');
                return;
            }
            openBulkDownloadModal('png');
        });
    }
    
    const exportSvgBtn = document.getElementById('exportSvgBtn');
    if (exportSvgBtn) {
        exportSvgBtn.addEventListener('click', () => {
            if (selectedProducts.size === 0) {
                showToast('Veuillez sélectionner au moins un produit', 'warning');
                return;
            }
            openBulkDownloadModal('svg');
        });
    }
    
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            if (selectedProducts.size === 0) {
                showToast('Veuillez sélectionner au moins un produit', 'warning');
                return;
            }
            openBulkDownloadModal('csv');
        });
    }
    
    const previewBtn = document.getElementById('previewBtn');
    if (previewBtn) {
        previewBtn.addEventListener('click', showPreview);
    }
    
    const printBtn = document.getElementById('printBtn');
    if (printBtn) {
        printBtn.addEventListener('click', printBarcodes);
    }
    
    // Modal d'aperçu
    const closePreviewBtn = document.getElementById('closePreviewBtn');
    const closePreviewBtn2 = document.getElementById('closePreviewBtn2');
    const previewModal = document.getElementById('previewModal');
    
    const closePreview = () => {
        if (previewModal) {
            previewModal.classList.remove('active');
            previewModal.style.removeProperty('display');
            previewModal.style.removeProperty('opacity');
            previewModal.style.removeProperty('visibility');
            previewModal.style.removeProperty('pointer-events');
            previewModal.style.removeProperty('z-index');
            const previewModalContent = previewModal.querySelector('.modal');
            if (previewModalContent) {
                previewModalContent.style.removeProperty('display');
                previewModalContent.style.removeProperty('opacity');
                previewModalContent.style.removeProperty('visibility');
            }
            document.body.style.overflow = '';
        }
    };
    
    if (closePreviewBtn) closePreviewBtn.addEventListener('click', closePreview);
    if (closePreviewBtn2) closePreviewBtn2.addEventListener('click', closePreview);
    
    if (previewModal) {
        previewModal.addEventListener('click', (e) => {
            if (e.target === previewModal) closePreview();
        });
    }
    
    // Modal de visualisation du code-barres
    const viewBarcodeModal = document.getElementById('viewBarcodeModal');
    const closeViewBarcodeModalBtn = document.getElementById('closeViewBarcodeModalBtn');
    const closeViewBarcodeBtn = document.getElementById('closeViewBarcodeBtn');
    
    const closeViewBarcodeModal = () => {
        if (viewBarcodeModal) {
            viewBarcodeModal.classList.remove('active');
            viewBarcodeModal.style.removeProperty('display');
            viewBarcodeModal.style.removeProperty('opacity');
            viewBarcodeModal.style.removeProperty('visibility');
            viewBarcodeModal.style.removeProperty('pointer-events');
            viewBarcodeModal.style.removeProperty('z-index');
            const viewBarcodeModalContent = viewBarcodeModal.querySelector('.modal');
            if (viewBarcodeModalContent) {
                viewBarcodeModalContent.style.removeProperty('display');
                viewBarcodeModalContent.style.removeProperty('opacity');
                viewBarcodeModalContent.style.removeProperty('visibility');
            }
            document.body.style.overflow = '';
            currentViewingProductId = null;
        }
    };
    
    if (closeViewBarcodeModalBtn) closeViewBarcodeModalBtn.addEventListener('click', closeViewBarcodeModal);
    if (closeViewBarcodeBtn) closeViewBarcodeBtn.addEventListener('click', closeViewBarcodeModal);
    
    if (viewBarcodeModal) {
        viewBarcodeModal.addEventListener('click', (e) => {
            if (e.target === viewBarcodeModal) closeViewBarcodeModal();
        });
    }
    
    // Bouton Imprimer dans le modal de visualisation
    const printBarcodeBtn = document.getElementById('printBarcodeBtn');
    if (printBarcodeBtn) {
        printBarcodeBtn.addEventListener('click', () => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:1143',message:'printBarcodeBtn click',data:{currentViewingProductId:currentViewingProductId,hasProductId:!!currentViewingProductId,mode:viewModalMode},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            if (currentViewingProductId) {
                const product = products.find(p => p.id === currentViewingProductId);
                if (product) {
                    showPrintOptionsInViewModal(product);
                } else {
                    showToast('Produit non trouvé', 'error');
                }
            } else {
                showToast('Aucun produit sélectionné', 'error');
            }
        });
    }
    
    // Bouton Retour dans le modal d'impression
    const backToViewBtn = document.getElementById('backToViewBtn');
    if (backToViewBtn) {
        backToViewBtn.addEventListener('click', () => {
            if (currentViewingProductId) {
                const product = products.find(p => p.id === currentViewingProductId);
                if (product) {
                    showViewModeInModal(product);
                }
            }
        });
    }
    
    // Bouton Confirmer l'impression
    const confirmPrintInViewBtn = document.getElementById('confirmPrintInViewBtn');
    if (confirmPrintInViewBtn) {
        confirmPrintInViewBtn.addEventListener('click', async () => {
            // #region agent log
            const barcodesPerProductInput = document.getElementById('viewPrintBarcodesPerProduct');
            const numberOfPagesInput = document.getElementById('viewPrintNumberOfPages');
            const barcodesPerProduct = parseInt(barcodesPerProductInput?.value || 1);
            const numberOfPages = parseInt(numberOfPagesInput?.value || 1);
            const selectedFormat = document.querySelector('#viewBarcodeModal .download-method-card.active')?.dataset.method;
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:1170',message:'confirmPrintInView click',data:{barcodesPerProduct:barcodesPerProduct,numberOfPages:numberOfPages,selectedFormat:selectedFormat,currentViewingProductId:currentViewingProductId},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            if (!currentViewingProductId) {
                showToast('Aucun produit sélectionné', 'error');
                return;
            }
            
            const product = products.find(p => p.id === currentViewingProductId);
            if (!product) {
                showToast('Produit non trouvé', 'error');
                return;
            }
            
            if (!selectedFormat) {
                showToast('Veuillez sélectionner un format', 'error');
                return;
            }
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:1188',message:'executing print',data:{format:selectedFormat,barcodesPerProduct:barcodesPerProduct,numberOfPages:numberOfPages},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            
            if (selectedFormat === 'pdf') {
                await exportSingleProductToPDF(product, barcodesPerProduct, numberOfPages);
            } else if (selectedFormat === 'png') {
                await exportSingleProductToPNG(product, barcodesPerProduct, numberOfPages);
            } else if (selectedFormat === 'svg') {
                exportSingleProductToSVG(product, barcodesPerProduct, numberOfPages);
            }
        });
    }
    
    // Sélection du format dans le modal de visualisation
    const viewModal = document.getElementById('viewBarcodeModal');
    if (viewModal) {
        viewModal.addEventListener('click', (e) => {
            const methodCard = e.target.closest('.download-method-card');
            if (methodCard && viewModalMode === 'print') {
                // Retirer la classe active de tous les cards
                viewModal.querySelectorAll('.download-method-card').forEach(c => c.classList.remove('active'));
                // Ajouter la classe active au card cliqué
                methodCard.classList.add('active');
            }
        });
    }
    
    // Modal d'impression du code-barres
    const printBarcodeModal = document.getElementById('printBarcodeModal');
    const closePrintBarcodeModalBtn = document.getElementById('closePrintBarcodeModalBtn');
    const cancelPrintBarcodeBtn = document.getElementById('cancelPrintBarcodeBtn');
    const confirmPrintBarcodeBtn = document.getElementById('confirmPrintBarcodeBtn');
    
    const closePrintBarcodeModal = () => {
        if (printBarcodeModal) {
            printBarcodeModal.classList.remove('active');
            printBarcodeModal.style.removeProperty('display');
            printBarcodeModal.style.removeProperty('opacity');
            printBarcodeModal.style.removeProperty('visibility');
            printBarcodeModal.style.removeProperty('pointer-events');
            printBarcodeModal.style.removeProperty('z-index');
            const printBarcodeModalContent = printBarcodeModal.querySelector('.modal');
            if (printBarcodeModalContent) {
                printBarcodeModalContent.style.removeProperty('display');
                printBarcodeModalContent.style.removeProperty('opacity');
                printBarcodeModalContent.style.removeProperty('visibility');
            }
            document.body.style.overflow = '';
            currentPrintProduct = null;
            selectedPrintFormat = null;
        }
    };
    
    if (closePrintBarcodeModalBtn) closePrintBarcodeModalBtn.addEventListener('click', closePrintBarcodeModal);
    if (cancelPrintBarcodeBtn) cancelPrintBarcodeBtn.addEventListener('click', closePrintBarcodeModal);
    
    if (printBarcodeModal) {
        printBarcodeModal.addEventListener('click', (e) => {
            if (e.target === printBarcodeModal) closePrintBarcodeModal();
        });
    }
    
    // Sélection du format dans le modal d'impression
    const printMethodCards = printBarcodeModal?.querySelectorAll('.download-method-card');
    if (printMethodCards) {
        printMethodCards.forEach(card => {
            card.addEventListener('click', () => {
                // Retirer la classe active de tous les cards
                printMethodCards.forEach(c => c.classList.remove('active'));
                // Ajouter la classe active au card cliqué
                card.classList.add('active');
                selectedPrintFormat = card.dataset.method;
            });
        });
    }
    
    // Confirmer l'export
    if (confirmPrintBarcodeBtn) {
        confirmPrintBarcodeBtn.addEventListener('click', async () => {
            if (!currentPrintProduct) {
                showToast('Aucun produit sélectionné', 'error');
                return;
            }
            
            if (!selectedPrintFormat) {
                showToast('Veuillez sélectionner un format', 'error');
                return;
            }
            
            const barcodesPerProduct = parseInt(document.getElementById('printBarcodesPerProduct')?.value || 1);
            const numberOfPages = parseInt(document.getElementById('printNumberOfPages')?.value || 1);
            
            closePrintBarcodeModal();
            
            if (selectedPrintFormat === 'pdf') {
                await exportSingleProductToPDF(currentPrintProduct, barcodesPerProduct, numberOfPages);
            } else if (selectedPrintFormat === 'png') {
                await exportSingleProductToPNG(currentPrintProduct, barcodesPerProduct, numberOfPages);
            } else if (selectedPrintFormat === 'svg') {
                exportSingleProductToSVG(currentPrintProduct, barcodesPerProduct, numberOfPages);
            }
        });
    }
    
    // Modal de téléchargement en masse
    const bulkDownloadModal = document.getElementById('bulkDownloadModal');
    const closeBulkDownloadModalBtn = document.getElementById('closeBulkDownloadModalBtn');
    const cancelBulkDownloadBtn = document.getElementById('cancelBulkDownloadBtn');
    const confirmBulkDownloadBtn = document.getElementById('confirmBulkDownloadBtn');
    const bulkBarcodesPerPage = document.getElementById('bulkBarcodesPerPage');
    const bulkBarcodesPerProduct = document.getElementById('bulkBarcodesPerProduct');
    const bulkNumberOfPages = document.getElementById('bulkNumberOfPages');
    const bulkDownloadInfo = document.getElementById('bulkDownloadInfo');
    
    const closeBulkDownloadModal = () => {
        if (bulkDownloadModal) {
            bulkDownloadModal.classList.remove('active');
            bulkDownloadModal.style.removeProperty('display');
            bulkDownloadModal.style.removeProperty('opacity');
            bulkDownloadModal.style.removeProperty('visibility');
            bulkDownloadModal.style.removeProperty('pointer-events');
            bulkDownloadModal.style.removeProperty('z-index');
            const bulkDownloadModalContent = bulkDownloadModal.querySelector('.modal');
            if (bulkDownloadModalContent) {
                bulkDownloadModalContent.style.removeProperty('display');
                bulkDownloadModalContent.style.removeProperty('opacity');
                bulkDownloadModalContent.style.removeProperty('visibility');
            }
            document.body.style.overflow = '';
        }
    };
    
    const updateBulkDownloadInfo = () => {
        if (!bulkDownloadInfo) return;
        
        const barcodesPerPage = parseInt(bulkBarcodesPerPage?.value || 1);
        const barcodesPerProduct = parseInt(bulkBarcodesPerProduct?.value || 1);
        const numberOfPages = parseInt(bulkNumberOfPages?.value || 1);
        const selectedCount = selectedProducts.size;
        
        const totalBarcodesPerPage = barcodesPerPage;
        const totalBarcodesPerProduct = barcodesPerProduct;
        const totalPages = numberOfPages;
        const totalBarcodes = selectedCount * barcodesPerProduct * numberOfPages;
        
        bulkDownloadInfo.innerHTML = `
            <div>• <strong>${selectedCount}</strong> produit(s) sélectionné(s)</div>
            <div>• <strong>${totalBarcodesPerPage}</strong> code(s)-barres par page</div>
            <div>• <strong>${totalBarcodesPerProduct}</strong> code(s)-barres du même produit par page</div>
            <div>• <strong>${totalPages}</strong> page(s) à imprimer</div>
            <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(59, 130, 246, 0.2);">
                <strong>Total: ${totalBarcodes} code(s)-barres</strong>
            </div>
        `;
    };
    
    if (closeBulkDownloadModalBtn) closeBulkDownloadModalBtn.addEventListener('click', closeBulkDownloadModal);
    if (cancelBulkDownloadBtn) cancelBulkDownloadBtn.addEventListener('click', closeBulkDownloadModal);
    if (confirmBulkDownloadBtn) confirmBulkDownloadBtn.addEventListener('click', exportBulkWithSettings);
    
    if (bulkDownloadModal) {
        bulkDownloadModal.addEventListener('click', (e) => {
            if (e.target === bulkDownloadModal) closeBulkDownloadModal();
        });
    }
    
    // Mettre à jour les informations quand les valeurs changent
    if (bulkBarcodesPerPage) bulkBarcodesPerPage.addEventListener('input', updateBulkDownloadInfo);
    if (bulkBarcodesPerProduct) bulkBarcodesPerProduct.addEventListener('input', updateBulkDownloadInfo);
    if (bulkNumberOfPages) bulkNumberOfPages.addEventListener('input', updateBulkDownloadInfo);
    
    // Mettre à jour les informations quand le modal s'ouvre
    if (bulkDownloadModal) {
        const observer = new MutationObserver((mutations) => {
            if (bulkDownloadModal.classList.contains('active')) {
                updateBulkDownloadInfo();
            }
        });
        observer.observe(bulkDownloadModal, { attributes: true, attributeFilter: ['class'] });
    }
}

// Fonction 11: Appliquer les filtres
function applyFilters() {
    filteredProducts = products.filter(product => {
        // Recherche par nom
        const nameMatch = !currentSearchTerm || product.name?.toLowerCase().includes(currentSearchTerm);
        
        // Filtre par catégorie
        const categoryMatch = !currentCategoryFilter || product.categoryId === currentCategoryFilter;
        
        // Filtre par code-barres
        let barcodeMatch = true;
        if (currentBarcodeFilter === 'with') {
            barcodeMatch = !!product.barcode;
        } else if (currentBarcodeFilter === 'without') {
            barcodeMatch = !product.barcode;
        }
        
        return nameMatch && categoryMatch && barcodeMatch;
    });
    
    displayProducts(filteredProducts);
    updateStats();
}

// Fonction 12: Mettre à jour les paramètres
function updateBarcodeSettings() {
    barcodeSettings = {
        format: document.getElementById('barcodeFormat')?.value || 'CODE128',
        width: parseFloat(document.getElementById('barcodeWidth')?.value || 2),
        height: parseFloat(document.getElementById('barcodeHeight')?.value || 100),
        fontSize: parseFloat(document.getElementById('barcodeFontSize')?.value || 20),
        color: document.getElementById('barcodeColor')?.value || '#000000',
        bgColor: document.getElementById('barcodeBgColor')?.value || '#FFFFFF',
        showProductName: document.getElementById('showProductName')?.checked ?? true,
        showPrice: document.getElementById('showPrice')?.checked ?? true,
        showBarcodeValue: document.getElementById('showBarcodeValue')?.checked ?? true
    };
}

// Fonction 13: Sélectionner tous les produits
function selectAllProducts() {
    filteredProducts.forEach(product => {
        selectedProducts.add(product.id);
    });
    updateTableSelections();
    updateStats();
}

// Fonction 15: Désélectionner tous les produits
function deselectAllProducts() {
    filteredProducts.forEach(product => {
        selectedProducts.delete(product.id);
    });
    updateTableSelections();
    updateStats();
}

// Fonction 17: Générer les codes-barres sélectionnés
async function generateSelectedBarcodes() {
    if (selectedProducts.size === 0) {
        showToast('Veuillez sélectionner au moins un produit', 'warning');
        return;
    }
    
    const selectedProductsList = Array.from(selectedProducts).map(id => 
        products.find(p => p.id === id)
    ).filter(Boolean);
    
    await generateBarcodesForProducts(selectedProductsList);
    showToast(`${selectedProductsList.length} code(s)-barres généré(s)`, 'success');
}

// Fonction 18: Générer tous les codes-barres
async function generateAllBarcodes() {
    await generateBarcodesForProducts(filteredProducts);
    showToast(`${filteredProducts.length} code(s)-barres généré(s)`, 'success');
}

// Fonction 19: Générer des codes-barres pour une liste de produits
async function generateBarcodesForProducts(productsList) {
    for (const product of productsList) {
        if (!product.barcode) {
            const barcode = generateBarcodeForProduct(product);
            try {
                await updateProduct(product.id, { barcode });
                product.barcode = barcode;
            } catch (error) {
                console.error(`Erreur lors de la mise à jour du produit ${product.id}:`, error);
            }
        }
        generateBarcodePreview(product.id);
    }
    
    // Ajouter à l'historique
    barcodeHistory.push({
        timestamp: new Date(),
        count: productsList.length,
        products: productsList.map(p => p.id)
    });
}

// Fonction 20: Exporter les produits sélectionnés en PDF
async function exportSelectedToPDF() {
    const productsToExport = Array.from(selectedProducts).map(id => products.find(p => p.id === id)).filter(Boolean);
    
    if (productsToExport.length === 0) {
        showToast('Aucun produit sélectionné', 'warning');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const cardWidth = (pageWidth - margin * 3) / 2;
        const cardHeight = 60;
        let x = margin;
        let y = margin;
        
        for (let i = 0; i < productsToExport.length; i++) {
            const product = productsToExport[i];
            
            // Nouvelle page si nécessaire
            if (y + cardHeight > pageHeight - margin) {
                pdf.addPage();
                y = margin;
                x = margin;
            }
            
            // Générer le SVG du code-barres
            const svg = generateBarcodeSVG(product);
            const svgString = new XMLSerializer().serializeToString(svg);
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(svgBlob);
            
            // Convertir SVG en image
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
            });
            
            // Créer un canvas pour convertir l'image
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = cardWidth - 10;
            const imgHeight = (img.height / img.width) * imgWidth;
            
            // Ajouter le code-barres
            pdf.addImage(imgData, 'PNG', x + 5, y + 5, imgWidth, Math.min(imgHeight, cardHeight - 20));
            
            // Ajouter le nom du produit
            pdf.setFontSize(10);
            pdf.text(product.name.substring(0, 30), x + 5, y + cardHeight - 10);
            
            // Ajouter le prix
            pdf.setFontSize(8);
            pdf.text(`$${parseFloat(product.price || 0).toFixed(2)}`, x + 5, y + cardHeight - 5);
            
            // Positionner le prochain élément
            x += cardWidth + margin;
            if (x + cardWidth > pageWidth - margin) {
                x = margin;
                y += cardHeight + margin;
            }
            
            URL.revokeObjectURL(url);
        }
        
        pdf.save(`codes-barres-${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('Export PDF réussi', 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export PDF:', error);
        showToast('Erreur lors de l\'export PDF', 'error');
    }
}

// Fonction 21: Exporter les produits sélectionnés en PNG
async function exportSelectedToPNG() {
    const productsToExport = Array.from(selectedProducts).map(id => products.find(p => p.id === id)).filter(Boolean);
    
    if (productsToExport.length === 0) {
        showToast('Aucun produit sélectionné', 'warning');
        return;
    }
    
    try {
        for (const product of productsToExport) {
            const svg = generateBarcodeSVG(product);
            const svgString = new XMLSerializer().serializeToString(svg);
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(svgBlob);
            
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
            });
            
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            canvas.toBlob((blob) => {
                const downloadUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `barcode-${product.name.replace(/[^a-z0-9]/gi, '-')}-${product.id}.png`;
                a.click();
                URL.revokeObjectURL(downloadUrl);
            });
            
            URL.revokeObjectURL(url);
        }
        
        showToast('Export PNG réussi', 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export PNG:', error);
        showToast('Erreur lors de l\'export PNG', 'error');
    }
}

// Fonction 22: Exporter les produits sélectionnés en SVG
function exportSelectedToSVG() {
    const productsToExport = Array.from(selectedProducts).map(id => products.find(p => p.id === id)).filter(Boolean);
    
    if (productsToExport.length === 0) {
        showToast('Aucun produit sélectionné', 'warning');
        return;
    }
    
    try {
        productsToExport.forEach(product => {
            const svg = generateBarcodeSVG(product);
            const svgString = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `barcode-${product.name.replace(/[^a-z0-9]/gi, '-')}-${product.id}.svg`;
            a.click();
            URL.revokeObjectURL(url);
        });
        
        showToast('Export SVG réussi', 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export SVG:', error);
        showToast('Erreur lors de l\'export SVG', 'error');
    }
}

// Fonction 23: Exporter les produits sélectionnés en CSV
function exportSelectedToCSV() {
    const productsToExport = Array.from(selectedProducts).map(id => products.find(p => p.id === id)).filter(Boolean);
    
    if (productsToExport.length === 0) {
        showToast('Aucun produit sélectionné', 'warning');
        return;
    }
    
    try {
        const headers = ['Nom', 'Code-barres', 'Prix', 'Stock', 'Catégorie'];
        const rows = productsToExport.map(product => {
            const category = categories.find(c => c.id === product.categoryId);
            return [
                product.name,
                product.barcode || generateBarcodeForProduct(product),
                parseFloat(product.price || 0).toFixed(2),
                product.stock || 0,
                category?.name || 'Sans catégorie'
            ];
        });
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `codes-barres-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        showToast('Export CSV réussi', 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export CSV:', error);
        showToast('Erreur lors de l\'export CSV', 'error');
    }
}

// Fonction 24: Afficher l'aperçu
function showPreview() {
    const productsToPreview = selectedProducts.size > 0 
        ? Array.from(selectedProducts).map(id => products.find(p => p.id === id)).filter(Boolean)
        : filteredProducts.slice(0, 20);
    
    if (productsToPreview.length === 0) {
        showToast('Veuillez sélectionner au moins un produit', 'warning');
        return;
    }
    
    const previewGrid = document.getElementById('previewGrid');
    if (!previewGrid) return;
    
    previewGrid.innerHTML = productsToPreview.map(product => {
        const svg = generateBarcodeSVG(product);
        const svgString = new XMLSerializer().serializeToString(svg);
        return `
            <div class="preview-item">
                <div style="margin-bottom: 0.5rem; font-weight: 600;">${escapeHtml(product.name)}</div>
                <div style="margin-bottom: 0.5rem;">$${parseFloat(product.price || 0).toFixed(2)}</div>
                <div>${svgString}</div>
            </div>
        `;
    }).join('');
    
    const modal = document.getElementById('previewModal');
    if (modal) {
        modal.classList.add('active');
        modal.style.setProperty('display', 'flex', 'important');
        modal.style.setProperty('opacity', '1', 'important');
        modal.style.setProperty('visibility', 'visible', 'important');
        modal.style.setProperty('pointer-events', 'auto', 'important');
        modal.style.setProperty('z-index', '10000', 'important');
        
        // FORCER les styles sur le contenu .modal à l'intérieur
        const previewModalContent = modal.querySelector('.modal');
        if (previewModalContent) {
            previewModalContent.style.setProperty('display', 'block', 'important');
            previewModalContent.style.setProperty('opacity', '1', 'important');
            previewModalContent.style.setProperty('visibility', 'visible', 'important');
        }
        
        document.body.style.overflow = 'hidden';
    }
}

// Fonction 25: Imprimer les codes-barres
function printBarcodes() {
    const productsToPrint = selectedProducts.size > 0 
        ? Array.from(selectedProducts).map(id => products.find(p => p.id === id)).filter(Boolean)
        : filteredProducts;
    
    if (productsToPrint.length === 0) {
        showToast('Veuillez sélectionner au moins un produit', 'warning');
        return;
    }
    
    // Ouvrir une nouvelle fenêtre pour l'impression
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Impression Codes-Barres</title>
            <style>
                body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
                .print-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
                .print-item { border: 1px solid #000; padding: 10px; text-align: center; page-break-inside: avoid; }
                .print-item h3 { margin: 0 0 10px 0; font-size: 14px; }
                .print-item .price { margin: 5px 0; font-size: 12px; }
                svg { max-width: 100%; height: auto; }
            </style>
        </head>
        <body>
            <div class="print-grid">
                ${productsToPrint.map(product => {
                    const svg = generateBarcodeSVG(product);
                    const svgString = new XMLSerializer().serializeToString(svg);
                    return `
                        <div class="print-item">
                            <h3>${escapeHtml(product.name)}</h3>
                            <div class="price">$${parseFloat(product.price || 0).toFixed(2)}</div>
                            ${svgString}
                        </div>
                    `;
                }).join('')}
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

// Fonction 26: Ouvrir le modal de téléchargement
window.openDownloadModal = function(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    currentViewingProductId = productId;
    const downloadModal = document.getElementById('downloadModal');
    const downloadProductInfo = document.getElementById('downloadProductInfo');
    const downloadBarcodePreview = document.getElementById('downloadBarcodePreview');
    
    if (!downloadModal || !downloadProductInfo || !downloadBarcodePreview) return;
    
    const category = categories.find(c => c.id === product.categoryId);
    const barcode = product.barcode || generateBarcodeForProduct(product);
    
    // Afficher les informations du produit
    downloadProductInfo.innerHTML = `
        <h4>${escapeHtml(product.name)}</h4>
        <div class="product-details">
            <div class="detail-item">
                <span>💰</span>
                <span>$${parseFloat(product.price || 0).toFixed(2)}</span>
            </div>
            <div class="detail-item">
                <span>📦</span>
                <span>Stock: ${product.stock || 0}</span>
            </div>
            ${category ? `
                <div class="detail-item">
                    <span>${category.icon || '🏷️'}</span>
                    <span>${escapeHtml(category.name)}</span>
                </div>
            ` : ''}
            <div class="detail-item">
                <span>📋</span>
                <span style="font-family: 'Courier New', monospace;">${barcode}</span>
            </div>
        </div>
    `;
    
    // Générer le code-barres
    const svg = generateBarcodeSVG(product);
    const svgString = new XMLSerializer().serializeToString(svg);
    
    downloadBarcodePreview.innerHTML = `
        ${svgString}
        <div style="margin-top: 1rem; text-align: center;">
            <div style="font-weight: 600; font-size: 1rem; color: var(--color-text-primary); margin-bottom: 0.5rem;">
                ${escapeHtml(product.name)}
            </div>
            <div style="font-size: 0.875rem; color: var(--color-text-secondary);">
                $${parseFloat(product.price || 0).toFixed(2)}
            </div>
        </div>
    `;
    
    // Réinitialiser les options
    const barcodesPerPage = document.getElementById('downloadBarcodesPerPage');
    const numberOfPages = document.getElementById('downloadNumberOfPages');
    if (barcodesPerPage) barcodesPerPage.value = 1;
    if (numberOfPages) numberOfPages.value = 1;
    
    // Retirer l'état actif de toutes les cartes
    document.querySelectorAll('.download-method-card').forEach(c => {
        c.classList.remove('active');
    });
    
    // Ouvrir le modal
    downloadModal.classList.add('active');
    downloadModal.style.setProperty('display', 'flex', 'important');
    downloadModal.style.setProperty('opacity', '1', 'important');
    downloadModal.style.setProperty('visibility', 'visible', 'important');
    downloadModal.style.setProperty('pointer-events', 'auto', 'important');
    downloadModal.style.setProperty('z-index', '10000', 'important');
    
    // FORCER les styles sur le contenu .modal à l'intérieur
    const downloadModalContent = downloadModal.querySelector('.modal');
    if (downloadModalContent) {
        downloadModalContent.style.setProperty('display', 'block', 'important');
        downloadModalContent.style.setProperty('opacity', '1', 'important');
        downloadModalContent.style.setProperty('visibility', 'visible', 'important');
    }
    
    document.body.style.overflow = 'hidden';
};

// Fonction 27: Exporter un code-barres avec quantité
async function exportBarcodeWithQuantity(productId, format) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const barcodesPerPage = parseInt(document.getElementById('downloadBarcodesPerPage')?.value || 1);
    const numberOfPages = parseInt(document.getElementById('downloadNumberOfPages')?.value || 1);
    const totalBarcodes = barcodesPerPage * numberOfPages;
    
    if (format === 'pdf') {
        await exportBarcodePDFWithQuantity(product, barcodesPerPage, numberOfPages);
    } else if (format === 'png') {
        await exportBarcodePNGWithQuantity(product, totalBarcodes);
    } else if (format === 'svg') {
        exportBarcodeSVGWithQuantity(product, totalBarcodes);
    } else if (format === 'csv') {
        exportBarcodeCSVWithQuantity(product);
    }
}

// Fonction 28: Exporter PDF avec quantité
async function exportBarcodePDFWithQuantity(product, barcodesPerPage, numberOfPages) {
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const cardWidth = (pageWidth - margin * 3) / Math.min(barcodesPerPage, 2);
        const cardHeight = (pageHeight - margin * 3) / Math.ceil(barcodesPerPage / 2);
        
        for (let page = 0; page < numberOfPages; page++) {
            if (page > 0) pdf.addPage();
            
            let x = margin;
            let y = margin;
            
            for (let i = 0; i < barcodesPerPage; i++) {
                // Générer le SVG
                const svg = generateBarcodeSVG(product);
                const svgString = new XMLSerializer().serializeToString(svg);
                const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(svgBlob);
                
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = url;
                });
                
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = cardWidth - 10;
                const imgHeight = (img.height / img.width) * imgWidth;
                
                pdf.addImage(imgData, 'PNG', x + 5, y + 5, imgWidth, Math.min(imgHeight, cardHeight - 30));
                
                pdf.setFontSize(10);
                pdf.text(product.name.substring(0, 30), x + 5, y + cardHeight - 15);
                
                pdf.setFontSize(8);
                pdf.text(`$${parseFloat(product.price || 0).toFixed(2)}`, x + 5, y + cardHeight - 10);
                
                x += cardWidth + margin;
                if (x + cardWidth > pageWidth - margin) {
                    x = margin;
                    y += cardHeight + margin;
                }
                
                URL.revokeObjectURL(url);
            }
        }
        
        pdf.save(`code-barres-${product.name.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.pdf`);
        showToast('Export PDF réussi', 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export PDF:', error);
        showToast('Erreur lors de l\'export PDF', 'error');
    }
}

// Fonction 29: Exporter PNG avec quantité
async function exportBarcodePNGWithQuantity(product, totalBarcodes) {
    try {
        for (let i = 0; i < totalBarcodes; i++) {
            const svg = generateBarcodeSVG(product);
            const svgString = new XMLSerializer().serializeToString(svg);
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(svgBlob);
            
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
            });
            
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            canvas.toBlob((blob) => {
                const downloadUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `barcode-${product.name.replace(/[^a-z0-9]/gi, '-')}-${i + 1}.png`;
                a.click();
                URL.revokeObjectURL(downloadUrl);
            });
            
            URL.revokeObjectURL(url);
        }
        
        showToast(`${totalBarcodes} fichier(s) PNG exporté(s)`, 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export PNG:', error);
        showToast('Erreur lors de l\'export PNG', 'error');
    }
}

// Fonction 30: Exporter SVG avec quantité
function exportBarcodeSVGWithQuantity(product, totalBarcodes) {
    try {
        for (let i = 0; i < totalBarcodes; i++) {
            const svg = generateBarcodeSVG(product);
            const svgString = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `barcode-${product.name.replace(/[^a-z0-9]/gi, '-')}-${i + 1}.svg`;
            a.click();
            URL.revokeObjectURL(url);
        }
        
        showToast(`${totalBarcodes} fichier(s) SVG exporté(s)`, 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export SVG:', error);
        showToast('Erreur lors de l\'export SVG', 'error');
    }
}

// Fonction 31: Exporter CSV avec quantité
function exportBarcodeCSVWithQuantity(product) {
    try {
        const category = categories.find(c => c.id === product.categoryId);
        const headers = ['Nom', 'Code-barres', 'Prix', 'Stock', 'Catégorie'];
        const row = [
            product.name,
            product.barcode || generateBarcodeForProduct(product),
            parseFloat(product.price || 0).toFixed(2),
            product.stock || 0,
            category?.name || 'Sans catégorie'
        ];
        
        const csvContent = [
            headers.join(','),
            row.map(cell => `"${cell}"`).join(',')
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `barcode-${product.name.replace(/[^a-z0-9]/gi, '-')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        showToast('Export CSV réussi', 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export CSV:', error);
        showToast('Erreur lors de l\'export CSV', 'error');
    }
}

// Fonction 31.5: Ouvrir le modal d'impression du code-barres
function openPrintBarcodeModal(product) {
    const printModal = document.getElementById('printBarcodeModal');
    const printProductInfo = document.getElementById('printProductInfo');
    const printBarcodePreview = document.getElementById('printBarcodePreview');
    
    if (!printModal || !printProductInfo || !printBarcodePreview) {
        showToast('Erreur: éléments du modal non trouvés', 'error');
        return;
    }
    
    currentPrintProduct = product;
    selectedPrintFormat = null;
    
    const category = categories.find(c => c.id === product.categoryId);
    const barcode = product.barcode || generateBarcodeForProduct(product);
    
    // Afficher les informations du produit
    printProductInfo.innerHTML = `
        <h4>${escapeHtml(product.name)}</h4>
        <div class="product-details">
            <div class="detail-item">
                <span>💰</span>
                <span>$${parseFloat(product.price || 0).toFixed(2)}</span>
            </div>
            <div class="detail-item">
                <span>📦</span>
                <span>Stock: ${product.stock || 0}</span>
            </div>
            ${category ? `
                <div class="detail-item">
                    <span>${category.icon || '🏷️'}</span>
                    <span>${escapeHtml(category.name)}</span>
                </div>
            ` : ''}
            <div class="detail-item">
                <span>📋</span>
                <span style="font-family: 'Courier New', monospace;">${barcode}</span>
            </div>
        </div>
    `;
    
    // Générer le code-barres
    const svg = generateBarcodeSVG(product);
    const svgString = new XMLSerializer().serializeToString(svg);
    
    printBarcodePreview.innerHTML = `
        ${svgString}
        <div style="margin-top: 1rem; text-align: center;">
            <div style="font-weight: 600; font-size: 1rem; color: var(--color-text-primary); margin-bottom: 0.5rem;">
                ${escapeHtml(product.name)}
            </div>
            <div style="font-size: 0.875rem; color: var(--color-text-secondary);">
                $${parseFloat(product.price || 0).toFixed(2)}
            </div>
        </div>
    `;
    
    // Réinitialiser les valeurs
    const barcodesPerProductInput = document.getElementById('printBarcodesPerProduct');
    const numberOfPagesInput = document.getElementById('printNumberOfPages');
    if (barcodesPerProductInput) barcodesPerProductInput.value = 1;
    if (numberOfPagesInput) numberOfPagesInput.value = 1;
    
    // Réinitialiser la sélection du format
    const printMethodCards = printModal.querySelectorAll('.download-method-card');
    printMethodCards.forEach(card => card.classList.remove('active'));
    
    // Ouvrir le modal
    printModal.classList.add('active');
    printModal.style.setProperty('display', 'flex', 'important');
    printModal.style.setProperty('opacity', '1', 'important');
    printModal.style.setProperty('visibility', 'visible', 'important');
    printModal.style.setProperty('pointer-events', 'auto', 'important');
    printModal.style.setProperty('z-index', '10000', 'important');
    
    const printModalContent = printModal.querySelector('.modal');
    if (printModalContent) {
        printModalContent.style.setProperty('display', 'block', 'important');
        printModalContent.style.setProperty('opacity', '1', 'important');
        printModalContent.style.setProperty('visibility', 'visible', 'important');
    }
    
    document.body.style.overflow = 'hidden';
}

// Fonction 31.6: Afficher les options d'impression dans le modal de visualisation
function showPrintOptionsInViewModal(product) {
    const viewModal = document.getElementById('viewBarcodeModal');
    const viewModalBody = viewModal?.querySelector('.modal-body');
    const viewModalHeader = viewModal?.querySelector('.modal-header h2');
    const viewModalFooter = viewModal?.querySelector('.modal-footer');
    
    if (!viewModal || !viewModalBody || !viewModalHeader || !viewModalFooter) {
        showToast('Erreur: éléments du modal non trouvés', 'error');
        return;
    }
    
    viewModalMode = 'print';
    
    // Changer le titre
    viewModalHeader.textContent = '🖨️ Imprimer le code-barres';
    
    const category = categories.find(c => c.id === product.categoryId);
    const barcode = product.barcode || generateBarcodeForProduct(product);
    const svg = generateBarcodeSVG(product);
    const svgString = new XMLSerializer().serializeToString(svg);
    
    // Changer le contenu du body
    viewModalBody.innerHTML = `
        <div class="download-content">
            <!-- Product Info -->
            <div class="download-product-info">
                <h4>${escapeHtml(product.name)}</h4>
                <div class="product-details">
                    <div class="detail-item">
                        <span>💰</span>
                        <span>$${parseFloat(product.price || 0).toFixed(2)}</span>
                    </div>
                    <div class="detail-item">
                        <span>📦</span>
                        <span>Stock: ${product.stock || 0}</span>
                    </div>
                    ${category ? `
                        <div class="detail-item">
                            <span>${category.icon || '🏷️'}</span>
                            <span>${escapeHtml(category.name)}</span>
                        </div>
                    ` : ''}
                    <div class="detail-item">
                        <span>📋</span>
                        <span style="font-family: 'Courier New', monospace;">${barcode}</span>
                    </div>
                </div>
            </div>
            
            <!-- Barcode Preview -->
            <div class="download-barcode-preview">
                ${svgString}
                <div style="margin-top: 1rem; text-align: center;">
                    <div style="font-weight: 600; font-size: 1rem; color: var(--color-text-primary); margin-bottom: 0.5rem;">
                        ${escapeHtml(product.name)}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--color-text-secondary);">
                        $${parseFloat(product.price || 0).toFixed(2)}
                    </div>
                </div>
            </div>
            
            <!-- Export Options -->
            <div class="download-options-section">
                <h3 class="download-section-title">Options d'impression</h3>
                <div class="download-options-grid">
                    <div class="download-option-group">
                        <label>Nombre de codes-barres de ce produit</label>
                        <input type="number" id="viewPrintBarcodesPerProduct" value="1" min="1" max="100">
                        <small style="color: var(--color-text-secondary); font-size: 0.75rem; margin-top: 0.25rem; display: block;">Nombre de codes-barres du même produit à imprimer</small>
                    </div>
                    <div class="download-option-group">
                        <label>Nombre de pages</label>
                        <input type="number" id="viewPrintNumberOfPages" value="1" min="1" max="100">
                        <small style="color: var(--color-text-secondary); font-size: 0.75rem; margin-top: 0.25rem; display: block;">Nombre total de pages à imprimer</small>
                    </div>
                </div>
            </div>
            
            <!-- Export Methods -->
            <div class="download-methods-section">
                <h3 class="download-section-title">Choisir le format</h3>
                <div class="download-methods-grid">
                    <button class="download-method-card" data-method="pdf">
                        <div class="method-icon">📄</div>
                        <div class="method-name">PDF</div>
                        <div class="method-description">Document imprimable</div>
                    </button>
                    <button class="download-method-card" data-method="png">
                        <div class="method-icon">🖼️</div>
                        <div class="method-name">PNG</div>
                        <div class="method-description">Image haute qualité</div>
                    </button>
                    <button class="download-method-card" data-method="svg">
                        <div class="method-icon">📐</div>
                        <div class="method-name">SVG</div>
                        <div class="method-description">Vectoriel scalable</div>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Changer le footer
    viewModalFooter.innerHTML = `
        <button class="btn btn-secondary" id="backToViewBtn">← Retour</button>
        <button class="btn btn-primary" id="confirmPrintInViewBtn">
            <span>🖨️</span>
            <span>Imprimer</span>
        </button>
    `;
    
    // Réattacher les event listeners
    const backBtn = document.getElementById('backToViewBtn');
    const confirmBtn = document.getElementById('confirmPrintInViewBtn');
    
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (currentViewingProductId) {
                const product = products.find(p => p.id === currentViewingProductId);
                if (product) {
                    showViewModeInModal(product);
                }
            }
        });
    }
    
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            const barcodesPerProductInput = document.getElementById('viewPrintBarcodesPerProduct');
            const numberOfPagesInput = document.getElementById('viewPrintNumberOfPages');
            const barcodesPerProduct = parseInt(barcodesPerProductInput?.value || 1);
            const numberOfPages = parseInt(numberOfPagesInput?.value || 1);
            const selectedFormat = viewModal.querySelector('.download-method-card.active')?.dataset.method;
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:showPrintOptions',message:'confirmPrint values',data:{barcodesPerProduct:barcodesPerProduct,numberOfPages:numberOfPages,selectedFormat:selectedFormat,rawBarcodesPerProduct:barcodesPerProductInput?.value,rawNumberOfPages:numberOfPagesInput?.value},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            
            if (!selectedFormat) {
                showToast('Veuillez sélectionner un format', 'error');
                return;
            }
            
            if (selectedFormat === 'pdf') {
                await exportSingleProductToPDF(product, barcodesPerProduct, numberOfPages);
            } else if (selectedFormat === 'png') {
                await exportSingleProductToPNG(product, barcodesPerProduct, numberOfPages);
            } else if (selectedFormat === 'svg') {
                exportSingleProductToSVG(product, barcodesPerProduct, numberOfPages);
            }
        });
    }
    
    // Réattacher les event listeners pour les cartes de format
    viewModal.querySelectorAll('.download-method-card').forEach(card => {
        card.addEventListener('click', () => {
            viewModal.querySelectorAll('.download-method-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        });
    });
}

// Fonction 31.7: Afficher le mode visualisation dans le modal
function showViewModeInModal(product) {
    const viewModal = document.getElementById('viewBarcodeModal');
    const viewModalBody = viewModal?.querySelector('.modal-body');
    const viewModalHeader = viewModal?.querySelector('.modal-header h2');
    const viewModalFooter = viewModal?.querySelector('.modal-footer');
    
    if (!viewModal || !viewModalBody || !viewModalHeader || !viewModalFooter) {
        return;
    }
    
    viewModalMode = 'view';
    
    // Changer le titre
    viewModalHeader.textContent = '👁️ Visualiser le code-barres';
    
    const category = categories.find(c => c.id === product.categoryId);
    const barcode = product.barcode || generateBarcodeForProduct(product);
    const svg = generateBarcodeSVG(product);
    const svgString = new XMLSerializer().serializeToString(svg);
    
    // Restaurer le contenu de visualisation
    viewModalBody.innerHTML = `
        <div class="barcode-view-content">
            <!-- Product Info -->
            <div class="download-product-info" id="viewProductInfo">
                <h4>${escapeHtml(product.name)}</h4>
                <div class="product-details">
                    <div class="detail-item">
                        <span>💰</span>
                        <span>$${parseFloat(product.price || 0).toFixed(2)}</span>
                    </div>
                    <div class="detail-item">
                        <span>📦</span>
                        <span>Stock: ${product.stock || 0}</span>
                    </div>
                    ${category ? `
                        <div class="detail-item">
                            <span>${category.icon || '🏷️'}</span>
                            <span>${escapeHtml(category.name)}</span>
                        </div>
                    ` : ''}
                    <div class="detail-item">
                        <span>📋</span>
                        <span style="font-family: 'Courier New', monospace;">${barcode}</span>
                    </div>
                </div>
            </div>
            
            <!-- Barcode Preview -->
            <div class="barcode-view-preview" id="viewBarcodePreview">
                ${svgString}
                <div style="margin-top: 1rem; text-align: center;">
                    <div style="font-weight: 600; font-size: 1rem; color: var(--color-text-primary); margin-bottom: 0.5rem;">
                        ${escapeHtml(product.name)}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--color-text-secondary);">
                        $${parseFloat(product.price || 0).toFixed(2)}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Restaurer le footer
    viewModalFooter.innerHTML = `
        <button class="btn btn-secondary" id="closeViewBarcodeBtn">Fermer</button>
        <button class="btn btn-primary" id="printBarcodeBtn" style="display: inline-flex; align-items: center; gap: 0.5rem;">
            <span>🖨️</span>
            <span>Imprimer</span>
        </button>
    `;
    
    // Réattacher les event listeners
    const closeBtn = document.getElementById('closeViewBarcodeBtn');
    const printBtn = document.getElementById('printBarcodeBtn');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const viewBarcodeModal = document.getElementById('viewBarcodeModal');
            if (viewBarcodeModal) {
                viewBarcodeModal.classList.remove('active');
                viewBarcodeModal.style.removeProperty('display');
                viewBarcodeModal.style.removeProperty('opacity');
                viewBarcodeModal.style.removeProperty('visibility');
                viewBarcodeModal.style.removeProperty('pointer-events');
                viewBarcodeModal.style.removeProperty('z-index');
                const viewBarcodeModalContent = viewBarcodeModal.querySelector('.modal');
                if (viewBarcodeModalContent) {
                    viewBarcodeModalContent.style.removeProperty('display');
                    viewBarcodeModalContent.style.removeProperty('opacity');
                    viewBarcodeModalContent.style.removeProperty('visibility');
                }
                document.body.style.overflow = '';
                currentViewingProductId = null;
            }
        });
    }
    
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            if (currentViewingProductId) {
                const product = products.find(p => p.id === currentViewingProductId);
                if (product) {
                    showPrintOptionsInViewModal(product);
                }
            }
        });
    }
}

// Fonction 32: Ouvrir le modal de visualisation du code-barres
window.openViewBarcodeModal = function(productId) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:1673',message:'openViewBarcodeModal called',data:{productId:productId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.log('👁️ [DEBUG] openViewBarcodeModal() appelée avec productId:', productId);
    const product = products.find(p => p.id === productId);
    if (!product) {
        console.error('❌ [DEBUG] Produit non trouvé:', productId);
        showToast('Produit non trouvé', 'error');
        return;
    }
    
    console.log('👁️ [DEBUG] Produit trouvé:', product.name);
    const viewModal = document.getElementById('viewBarcodeModal');
    const viewBarcodePreview = document.getElementById('viewBarcodePreview');
    const viewProductInfo = document.getElementById('viewProductInfo');
    
    console.log('👁️ [DEBUG] Éléments du modal:', {
        viewModal: !!viewModal,
        viewBarcodePreview: !!viewBarcodePreview,
        viewProductInfo: !!viewProductInfo
    });
    
    if (!viewModal || !viewBarcodePreview || !viewProductInfo) {
        console.error('❌ [DEBUG] Éléments du modal non trouvés!');
        showToast('Erreur: éléments du modal non trouvés', 'error');
        return;
    }
    
    // #region agent log
    const modalBefore = {
        className: viewModal.className,
        display: window.getComputedStyle(viewModal).display,
        opacity: window.getComputedStyle(viewModal).opacity,
        visibility: window.getComputedStyle(viewModal).visibility,
        zIndex: window.getComputedStyle(viewModal).zIndex,
        offsetParent: viewModal.offsetParent !== null
    };
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:1693',message:'view modal state before',data:modalBefore,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    const category = categories.find(c => c.id === product.categoryId);
    const barcode = product.barcode || generateBarcodeForProduct(product);
    
    // Afficher les informations du produit
    viewProductInfo.innerHTML = `
        <h4>${escapeHtml(product.name)}</h4>
        <div class="product-details">
            <div class="detail-item">
                <span>💰</span>
                <span>$${parseFloat(product.price || 0).toFixed(2)}</span>
            </div>
            <div class="detail-item">
                <span>📦</span>
                <span>Stock: ${product.stock || 0}</span>
            </div>
            ${category ? `
                <div class="detail-item">
                    <span>${category.icon || '🏷️'}</span>
                    <span>${escapeHtml(category.name)}</span>
                </div>
            ` : ''}
            <div class="detail-item">
                <span>📋</span>
                <span style="font-family: 'Courier New', monospace;">${barcode}</span>
            </div>
        </div>
    `;
    
    // Générer le code-barres
    const svg = generateBarcodeSVG(product);
    const svgString = new XMLSerializer().serializeToString(svg);
    
    viewBarcodePreview.innerHTML = `
        ${svgString}
        <div style="margin-top: 1rem; text-align: center;">
            <div style="font-weight: 600; font-size: 1rem; color: var(--color-text-primary); margin-bottom: 0.5rem;">
                ${escapeHtml(product.name)}
            </div>
            <div style="font-size: 0.875rem; color: var(--color-text-secondary);">
                $${parseFloat(product.price || 0).toFixed(2)}
            </div>
        </div>
    `;
    
    // Définir currentViewingProductId pour le bouton Imprimer
    currentViewingProductId = productId;
    
    // Ouvrir le modal
    console.log('👁️ [DEBUG] Classes du modal avant:', viewModal.className);
    viewModal.classList.add('active');
    // FORCER les styles directement sur l'overlay
    viewModal.style.setProperty('display', 'flex', 'important');
    viewModal.style.setProperty('opacity', '1', 'important');
    viewModal.style.setProperty('visibility', 'visible', 'important');
    viewModal.style.setProperty('pointer-events', 'auto', 'important');
    viewModal.style.setProperty('z-index', '10000', 'important');
    
    // FORCER les styles sur le contenu .modal à l'intérieur
    const viewModalContent = viewModal.querySelector('.modal');
    if (viewModalContent) {
        viewModalContent.style.setProperty('display', 'block', 'important');
        viewModalContent.style.setProperty('opacity', '1', 'important');
        viewModalContent.style.setProperty('visibility', 'visible', 'important');
    }
    
    // #region agent log
    const modalAfter = {
        className: viewModal.className,
        display: window.getComputedStyle(viewModal).display,
        opacity: window.getComputedStyle(viewModal).opacity,
        visibility: window.getComputedStyle(viewModal).visibility,
        zIndex: window.getComputedStyle(viewModal).zIndex,
        offsetParent: viewModal.offsetParent !== null,
        hasActiveClass: viewModal.classList.contains('active')
    };
    const modalContent = viewModal.querySelector('.modal');
    const modalContentStyles = modalContent ? {
        display: window.getComputedStyle(modalContent).display,
        opacity: window.getComputedStyle(modalContent).opacity,
        visibility: window.getComputedStyle(modalContent).visibility,
        zIndex: window.getComputedStyle(modalContent).zIndex,
        offsetParent: modalContent.offsetParent !== null,
        offsetWidth: modalContent.offsetWidth,
        offsetHeight: modalContent.offsetHeight,
        position: window.getComputedStyle(modalContent).position
    } : null;
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'barcodes.js:1752',message:'view modal state after',data:{overlay:modalAfter,content:modalContentStyles},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    console.log('👁️ [DEBUG] Classes du modal après:', viewModal.className);
    console.log('👁️ [DEBUG] Modal a la classe active?', viewModal.classList.contains('active'));
    console.log('👁️ [DEBUG] Style display du modal:', window.getComputedStyle(viewModal).display);
    document.body.style.overflow = 'hidden';
};

// Fonction 33: Ouvrir le modal de téléchargement en masse
function openBulkDownloadModal(format) {
    const bulkDownloadModal = document.getElementById('bulkDownloadModal');
    const bulkDownloadFormat = document.getElementById('bulkDownloadFormat');
    
    if (!bulkDownloadModal || !bulkDownloadFormat) return;
    
    // Définir le format sélectionné
    bulkDownloadFormat.value = format;
    
    // Réinitialiser les valeurs
    const barcodesPerPageInput = document.getElementById('bulkBarcodesPerPage');
    const barcodesPerProductInput = document.getElementById('bulkBarcodesPerProduct');
    const numberOfPagesInput = document.getElementById('bulkNumberOfPages');
    
    if (barcodesPerPageInput) barcodesPerPageInput.value = 1;
    if (barcodesPerProductInput) barcodesPerProductInput.value = 1;
    if (numberOfPagesInput) numberOfPagesInput.value = 1;
    
    // Ouvrir le modal
    bulkDownloadModal.classList.add('active');
    bulkDownloadModal.style.setProperty('display', 'flex', 'important');
    bulkDownloadModal.style.setProperty('opacity', '1', 'important');
    bulkDownloadModal.style.setProperty('visibility', 'visible', 'important');
    bulkDownloadModal.style.setProperty('pointer-events', 'auto', 'important');
    bulkDownloadModal.style.setProperty('z-index', '10000', 'important');
    
    // FORCER les styles sur le contenu .modal à l'intérieur
    const bulkDownloadModalContent = bulkDownloadModal.querySelector('.modal');
    if (bulkDownloadModalContent) {
        bulkDownloadModalContent.style.setProperty('display', 'block', 'important');
        bulkDownloadModalContent.style.setProperty('opacity', '1', 'important');
        bulkDownloadModalContent.style.setProperty('visibility', 'visible', 'important');
    }
    
    document.body.style.overflow = 'hidden';
}

// Fonction 34: Exporter en masse avec les paramètres
async function exportBulkWithSettings() {
    const format = document.getElementById('bulkDownloadFormat')?.value;
    const barcodesPerPage = parseInt(document.getElementById('bulkBarcodesPerPage')?.value || 1);
    const barcodesPerProduct = parseInt(document.getElementById('bulkBarcodesPerProduct')?.value || 1);
    const numberOfPages = parseInt(document.getElementById('bulkNumberOfPages')?.value || 1);
    
    if (!format) {
        showToast('Format non sélectionné', 'error');
        return;
    }
    
    const productsToExport = Array.from(selectedProducts).map(id => products.find(p => p.id === id)).filter(Boolean);
    
    if (productsToExport.length === 0) {
        showToast('Aucun produit sélectionné', 'warning');
        return;
    }
    
    // Fermer le modal
    const bulkDownloadModal = document.getElementById('bulkDownloadModal');
    if (bulkDownloadModal) {
        bulkDownloadModal.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    if (format === 'pdf') {
        await exportBulkToPDF(productsToExport, barcodesPerPage, barcodesPerProduct, numberOfPages);
    } else if (format === 'png') {
        await exportBulkToPNG(productsToExport, barcodesPerProduct, numberOfPages);
    } else if (format === 'svg') {
        exportBulkToSVG(productsToExport, barcodesPerProduct, numberOfPages);
    } else if (format === 'csv') {
        exportBulkToCSV(productsToExport);
    }
}

// Fonction 35: Exporter en PDF en masse
async function exportBulkToPDF(productsToExport, barcodesPerPage, barcodesPerProduct, numberOfPages) {
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const cardWidth = (pageWidth - margin * 3) / Math.min(barcodesPerPage, 2);
        const cardHeight = (pageHeight - margin * 3) / Math.ceil(barcodesPerPage / 2);
        
        for (let page = 0; page < numberOfPages; page++) {
            if (page > 0) pdf.addPage();
            
            let x = margin;
            let y = margin;
            let barcodesOnCurrentPage = 0;
            
            for (const product of productsToExport) {
                // Générer plusieurs codes-barres pour ce produit
                for (let i = 0; i < barcodesPerProduct; i++) {
                    if (barcodesOnCurrentPage >= barcodesPerPage) {
                        // Nouvelle page si nécessaire
                        pdf.addPage();
                        x = margin;
                        y = margin;
                        barcodesOnCurrentPage = 0;
                    }
                    
                    // Générer le SVG
                    const svg = generateBarcodeSVG(product);
                    const svgString = new XMLSerializer().serializeToString(svg);
                    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
                    const url = URL.createObjectURL(svgBlob);
                    
                    const img = new Image();
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                        img.src = url;
                    });
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    const imgData = canvas.toDataURL('image/png');
                    const imgWidth = cardWidth - 10;
                    const imgHeight = (img.height / img.width) * imgWidth;
                    
                    pdf.addImage(imgData, 'PNG', x + 5, y + 5, imgWidth, Math.min(imgHeight, cardHeight - 30));
                    
                    pdf.setFontSize(10);
                    pdf.text(product.name.substring(0, 30), x + 5, y + cardHeight - 15);
                    
                    pdf.setFontSize(8);
                    pdf.text(`$${parseFloat(product.price || 0).toFixed(2)}`, x + 5, y + cardHeight - 10);
                    
                    x += cardWidth + margin;
                    if (x + cardWidth > pageWidth - margin) {
                        x = margin;
                        y += cardHeight + margin;
                    }
                    
                    barcodesOnCurrentPage++;
                    URL.revokeObjectURL(url);
                }
            }
        }
        
        pdf.save(`codes-barres-${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('Export PDF réussi', 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export PDF:', error);
        showToast('Erreur lors de l\'export PDF', 'error');
    }
}

// Fonction 36: Exporter en PNG en masse
async function exportBulkToPNG(productsToExport, barcodesPerProduct, numberOfPages) {
    try {
        const totalBarcodes = productsToExport.length * barcodesPerProduct * numberOfPages;
        let count = 0;
        
        for (const product of productsToExport) {
            for (let page = 0; page < numberOfPages; page++) {
                for (let i = 0; i < barcodesPerProduct; i++) {
                    const svg = generateBarcodeSVG(product);
                    const svgString = new XMLSerializer().serializeToString(svg);
                    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
                    const url = URL.createObjectURL(svgBlob);
                    
                    const img = new Image();
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                        img.src = url;
                    });
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    canvas.toBlob((blob) => {
                        const downloadUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.download = `barcode-${product.name.replace(/[^a-z0-9]/gi, '-')}-${count + 1}.png`;
                        a.click();
                        URL.revokeObjectURL(downloadUrl);
                    });
                    
                    URL.revokeObjectURL(url);
                    count++;
                }
            }
        }
        
        showToast(`${totalBarcodes} fichier(s) PNG exporté(s)`, 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export PNG:', error);
        showToast('Erreur lors de l\'export PNG', 'error');
    }
}

// Fonction 37: Exporter en SVG en masse
function exportBulkToSVG(productsToExport, barcodesPerProduct, numberOfPages) {
    try {
        let count = 0;
        
        for (const product of productsToExport) {
            for (let page = 0; page < numberOfPages; page++) {
                for (let i = 0; i < barcodesPerProduct; i++) {
                    const svg = generateBarcodeSVG(product);
                    const svgString = new XMLSerializer().serializeToString(svg);
                    const blob = new Blob([svgString], { type: 'image/svg+xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `barcode-${product.name.replace(/[^a-z0-9]/gi, '-')}-${count + 1}.svg`;
                    a.click();
                    URL.revokeObjectURL(url);
                    count++;
                }
            }
        }
        
        const totalBarcodes = productsToExport.length * barcodesPerProduct * numberOfPages;
        showToast(`${totalBarcodes} fichier(s) SVG exporté(s)`, 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export SVG:', error);
        showToast('Erreur lors de l\'export SVG', 'error');
    }
}

// Fonction 38: Exporter en CSV en masse
function exportBulkToCSV(productsToExport) {
    try {
        const headers = ['Nom', 'Code-barres', 'Prix', 'Stock', 'Catégorie'];
        const rows = productsToExport.map(product => {
            const category = categories.find(c => c.id === product.categoryId);
            return [
                product.name,
                product.barcode || generateBarcodeForProduct(product),
                parseFloat(product.price || 0).toFixed(2),
                product.stock || 0,
                category?.name || 'Sans catégorie'
            ];
        });
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `codes-barres-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        showToast('Export CSV réussi', 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export CSV:', error);
        showToast('Erreur lors de l\'export CSV', 'error');
    }
}

// Fonction 38.5: Exporter un seul produit en PDF
async function exportSingleProductToPDF(product, barcodesPerProduct, numberOfPages) {
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const barcodesPerPage = 4; // 2x2 par page
        const cardWidth = (pageWidth - margin * 3) / 2;
        const cardHeight = (pageHeight - margin * 3) / 2;
        
        const totalBarcodes = barcodesPerProduct * numberOfPages;
        let barcodeCount = 0;
        
        for (let page = 0; page < numberOfPages; page++) {
            if (page > 0) pdf.addPage();
            
            let x = margin;
            let y = margin;
            let barcodesOnCurrentPage = 0;
            
            // Générer plusieurs codes-barres pour ce produit
            for (let i = 0; i < barcodesPerProduct && barcodeCount < totalBarcodes; i++) {
                if (barcodesOnCurrentPage >= barcodesPerPage) {
                    // Nouvelle page si nécessaire
                    pdf.addPage();
                    x = margin;
                    y = margin;
                    barcodesOnCurrentPage = 0;
                }
                
                // Générer le SVG
                const svg = generateBarcodeSVG(product);
                const svgString = new XMLSerializer().serializeToString(svg);
                const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(svgBlob);
                
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = url;
                });
                
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = cardWidth - 10;
                const imgHeight = (img.height / img.width) * imgWidth;
                
                pdf.addImage(imgData, 'PNG', x + 5, y + 5, imgWidth, Math.min(imgHeight, cardHeight - 30));
                
                pdf.setFontSize(10);
                pdf.text(product.name.substring(0, 30), x + 5, y + cardHeight - 15);
                
                pdf.setFontSize(8);
                pdf.text(`$${parseFloat(product.price || 0).toFixed(2)}`, x + 5, y + cardHeight - 10);
                
                x += cardWidth + margin;
                if (x + cardWidth > pageWidth - margin) {
                    x = margin;
                    y += cardHeight + margin;
                }
                
                barcodesOnCurrentPage++;
                barcodeCount++;
                URL.revokeObjectURL(url);
            }
        }
        
        const fileName = `code-barres-${product.name.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(fileName);
        showToast('Export PDF réussi', 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export PDF:', error);
        showToast('Erreur lors de l\'export PDF', 'error');
    }
}

// Fonction 38.6: Exporter un seul produit en PNG
async function exportSingleProductToPNG(product, barcodesPerProduct, numberOfPages) {
    try {
        const totalBarcodes = barcodesPerProduct * numberOfPages;
        let count = 0;
        
        for (let page = 0; page < numberOfPages; page++) {
            for (let i = 0; i < barcodesPerProduct; i++) {
                const svg = generateBarcodeSVG(product);
                const svgString = new XMLSerializer().serializeToString(svg);
                const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(svgBlob);
                
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = url;
                });
                
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                canvas.toBlob((blob) => {
                    const downloadUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = `barcode-${product.name.replace(/[^a-z0-9]/gi, '-')}-${count + 1}.png`;
                    a.click();
                    URL.revokeObjectURL(downloadUrl);
                });
                
                URL.revokeObjectURL(url);
                count++;
            }
        }
        
        showToast(`${totalBarcodes} fichier(s) PNG exporté(s)`, 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export PNG:', error);
        showToast('Erreur lors de l\'export PNG', 'error');
    }
}

// Fonction 38.7: Exporter un seul produit en SVG
function exportSingleProductToSVG(product, barcodesPerProduct, numberOfPages) {
    try {
        const totalBarcodes = barcodesPerProduct * numberOfPages;
        let count = 0;
        
        for (let page = 0; page < numberOfPages; page++) {
            for (let i = 0; i < barcodesPerProduct; i++) {
                const svg = generateBarcodeSVG(product);
                const svgString = new XMLSerializer().serializeToString(svg);
                const blob = new Blob([svgString], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `barcode-${product.name.replace(/[^a-z0-9]/gi, '-')}-${count + 1}.svg`;
                a.click();
                URL.revokeObjectURL(url);
                count++;
            }
        }
        
        showToast(`${totalBarcodes} fichier(s) SVG exporté(s)`, 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export SVG:', error);
        showToast('Erreur lors de l\'export SVG', 'error');
    }
}

// Fonction 30: Fonction utilitaire pour échapper le HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Fonction 31: Afficher un toast
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.zIndex = '10002';
    toast.style.padding = '1rem 1.5rem';
    toast.style.background = 'var(--color-bg-primary)';
    toast.style.border = '1px solid var(--color-gray-200)';
    toast.style.borderRadius = 'var(--border-radius-lg)';
    toast.style.boxShadow = 'var(--shadow-xl)';
    toast.style.borderLeft = `4px solid ${type === 'success' ? 'var(--color-success)' : type === 'error' ? 'var(--color-error)' : 'var(--color-warning)'}`;
    toast.style.color = 'var(--color-text-primary)';
    toast.style.fontWeight = '500';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

