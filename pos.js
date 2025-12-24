// ============================================
// PAGE CAISSE (POS) - LOGIQUE COMPLÈTE
// ============================================

import { logout, getCurrentUser, checkAuthState, isSuperAdmin } from './auth.js';
import { 
    getAllProducts, 
    getAllCategories, 
    getSettings, 
    createSale, 
    updateProduct,
    getProductById,
    getUserSales
} from './firestore.js';
import { showNotification } from './utils.js';

// ============================================
// VARIABLES GLOBALES
// ============================================

let products = [];
let categories = [];
let settings = null;
let cart = [];
let filteredProducts = [];
let currentUser = null;
let selectedPaymentMethod = 'cash';
let cashAmountGiven = 0;

// ============================================
// INITIALISATION
// ============================================

window.addEventListener('DOMContentLoaded', async () => {
    // Vérifier l'authentification
    checkAuthState(async (user) => {
        if (!user) {
            window.location.href = '/login.html';
            return;
        }
        
        currentUser = user;
        displayUserInfo(user);
        
        // Charger les données
        await loadSettings();
        await loadCategories();
        await loadProducts();
        
        // Configurer les événements
        setupEventListeners();
        
        // Initialiser le panier depuis localStorage (optionnel)
        loadCartFromStorage();
        
        // Configurer le profil
        setupProfile();
        
        // #region agent log - Global click listener for debugging
        document.addEventListener('click', function(e) {
            const target = e.target;
            const isCheckout = target.closest('#checkoutBtn');
            const isProfile = target.closest('#profileBtn');
            if (isCheckout || isProfile) {
                fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:58',message:'Global click detected',data:{targetId:target.id,targetTag:target.tagName,isCheckout:!!isCheckout,isProfile:!!isProfile,phase:e.eventPhase,defaultPrevented:e.defaultPrevented},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            }
        }, { capture: true });
        // #endregion
    });
});

// ============================================
// CHARGEMENT DES DONNÉES
// ============================================

async function loadSettings() {
    try {
        settings = await getSettings();
        if (!settings) {
            // Paramètres par défaut
            settings = {
                currency: 'CAD',
                currencySymbol: '$',
                taxes: {
                    tps: { enabled: true, rate: 0.05, name: 'TPS' },
                    tvq: { enabled: true, rate: 0.09975, name: 'TVQ' }
                }
            };
        }
    } catch (error) {
        console.error('Erreur lors du chargement des paramètres:', error);
        settings = {
            currency: 'CAD',
            currencySymbol: '$',
            taxes: {
                tps: { enabled: true, rate: 0.05, name: 'TPS' },
                tvq: { enabled: true, rate: 0.09975, name: 'TVQ' }
            }
        };
    }
}

async function loadCategories() {
    try {
        categories = await getAllCategories();
        populateCategoryFilter();
    } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
        showToast('Erreur lors du chargement des catégories', 'error');
    }
}

async function loadProducts() {
    const loadingEl = document.getElementById('productsLoading');
    const gridEl = document.getElementById('productsGrid');
    const emptyEl = document.getElementById('productsEmpty');
    
    try {
        if (loadingEl) loadingEl.style.display = 'flex';
        if (gridEl) gridEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';
        
        products = await getAllProducts();
        
        // Filtrer uniquement les produits en stock
        filteredProducts = products.filter(p => (p.stock || 0) > 0);
        
        // Appliquer les filtres actuels
        applyFilters();
        
        updateProductsStats();
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (gridEl) gridEl.style.display = 'grid';
        
    } catch (error) {
        console.error('Erreur lors du chargement des produits:', error);
        showToast('Erreur lors du chargement des produits', 'error');
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'flex';
    }
}

// ============================================
// AFFICHAGE DES PRODUITS
// ============================================

function displayProducts(productsList) {
    const gridEl = document.getElementById('productsGrid');
    const emptyEl = document.getElementById('productsEmpty');
    
    if (!gridEl) return;
    
    if (productsList.length === 0) {
        gridEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'flex';
        return;
    }
    
    gridEl.style.display = 'grid';
    if (emptyEl) emptyEl.style.display = 'none';
    
    gridEl.innerHTML = productsList.map(product => {
        const stock = product.stock || 0;
        const price = parseFloat(product.price || 0);
        const stockBadge = getStockBadge(stock);
        const isOutOfStock = stock === 0;
        
        return `
            <div class="product-card ${isOutOfStock ? 'disabled' : ''}" 
                 data-product-id="${product.id}"
                 ${!isOutOfStock ? `onclick="addToCart('${product.id}')"` : ''}>
                <div class="product-image">
                    ${product.imageUrl ? 
                        `<img src="${product.imageUrl}" alt="${product.name}" loading="lazy">` : 
                        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 3rem; opacity: 0.3;">📦</div>'
                    }
                </div>
                <div class="product-info">
                    <h3 class="product-name">${escapeHtml(product.name)}</h3>
                    <div class="product-price">${formatCurrency(price)}</div>
                    <div class="product-stock-badge ${stockBadge.class}">
                        ${stockBadge.text}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getStockBadge(stock) {
    if (stock === 0) {
        return { class: 'out-of-stock', text: 'Rupture de stock' };
    } else if (stock <= 10) {
        return { class: 'low-stock', text: `⚠️ Stock faible (${stock})` };
    } else {
        return { class: 'in-stock', text: `✓ En stock (${stock})` };
    }
}

function updateProductsStats() {
    const productsCountEl = document.getElementById('productsCount');
    const inStockCountEl = document.getElementById('inStockCount');
    
    if (productsCountEl) {
        productsCountEl.textContent = products.length;
    }
    
    if (inStockCountEl) {
        const inStock = products.filter(p => (p.stock || 0) > 0).length;
        inStockCountEl.textContent = inStock;
    }
}

// ============================================
// FILTRES ET RECHERCHE
// ============================================

function populateCategoryFilter() {
    const filterEl = document.getElementById('categoryFilter');
    if (!filterEl) return;
    
    filterEl.innerHTML = '<option value="">Toutes les catégories</option>';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = `${category.icon || '🏷️'} ${category.name}`;
        filterEl.appendChild(option);
    });
}

function setupEventListeners() {
    // Recherche
    const searchInput = document.getElementById('productSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(applyFilters, 300));
    }
    
    // Filtres
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', applyFilters);
    }
    
    const sortFilter = document.getElementById('sortFilter');
    if (sortFilter) {
        sortFilter.addEventListener('change', applyFilters);
    }
    
    // Reset
    const resetBtn = document.getElementById('resetFilters');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetFilters);
    }
    
    // Panier
    const clearCartBtn = document.getElementById('clearCartBtn');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', clearCart);
    }
    
    // Checkout - gestionnaire d'événements isolé
    const checkoutBtn = document.getElementById('checkoutBtn');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:253',message:'Checkout button lookup',data:{found:!!checkoutBtn,disabled:checkoutBtn?.disabled},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (checkoutBtn) {
        // Fonction de gestionnaire isolée
        const handleCheckoutClick = function(e) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:257',message:'Checkout handler ENTRY',data:{targetId:e.target.id,targetTag:e.target.tagName,currentTargetId:e.currentTarget.id,disabled:e.currentTarget.disabled,phase:e.eventPhase},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            // Vérifier que c'est bien le bouton checkout ou un de ses enfants qui a été cliqué
            const clickedElement = e.target;
            const isCheckoutButton = clickedElement === checkoutBtn || 
                                    clickedElement.closest('#checkoutBtn') === checkoutBtn ||
                                    checkoutBtn.contains(clickedElement);
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:263',message:'Checkout button check',data:{isCheckoutButton},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            if (!isCheckoutButton) {
                return;
            }
            
            // Arrêter la propagation immédiatement AVANT toute autre action
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:270',message:'Checkout stopPropagation called',data:{defaultPrevented:e.defaultPrevented},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            
            // Empêcher la propagation vers d'autres gestionnaires
            if (e.cancelable) {
                e.preventDefault();
            }
            
            console.log('✅ Checkout button clicked - opening payment modal');
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:278',message:'Calling showConfirmModal',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            showConfirmModal();
            return false;
        };
        
        // Retirer tous les anciens listeners en remplaçant le gestionnaire
        checkoutBtn.onclick = null;
        // Attacher le nouveau listener avec capture pour intercepter en premier
        checkoutBtn.addEventListener('click', handleCheckoutClick, { capture: true });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:285',message:'Checkout listener attached',data:{capture:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
    } else {
        console.error('❌ Checkout button not found');
    }
    
    // Modal de paiement
    setupPaymentModal();
    
}

function applyFilters() {
    const searchTerm = document.getElementById('productSearch')?.value.toLowerCase() || '';
    const categoryId = document.getElementById('categoryFilter')?.value || '';
    const sortBy = document.getElementById('sortFilter')?.value || 'name';
    
    let filtered = products.filter(product => {
        // Filtre par stock
        if ((product.stock || 0) === 0) return false;
        
        // Filtre par recherche
        if (searchTerm) {
            const nameMatch = product.name?.toLowerCase().includes(searchTerm);
            if (!nameMatch) return false;
        }
        
        // Filtre par catégorie
        if (categoryId) {
            if (product.categoryId !== categoryId) return false;
        }
        
        return true;
    });
    
    // Tri
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return (a.name || '').localeCompare(b.name || '');
            case 'price-asc':
                return (parseFloat(a.price || 0) - parseFloat(b.price || 0));
            case 'price-desc':
                return (parseFloat(b.price || 0) - parseFloat(a.price || 0));
            case 'stock':
                return ((b.stock || 0) - (a.stock || 0));
            default:
                return 0;
        }
    });
    
    filteredProducts = filtered;
    displayProducts(filteredProducts);
}

function resetFilters() {
    const searchInput = document.getElementById('productSearch');
    const categoryFilter = document.getElementById('categoryFilter');
    const sortFilter = document.getElementById('sortFilter');
    
    if (searchInput) searchInput.value = '';
    if (categoryFilter) categoryFilter.value = '';
    if (sortFilter) sortFilter.value = 'name';
    
    applyFilters();
}

// ============================================
// GESTION DU PANIER
// ============================================

window.addToCart = function(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const stock = product.stock || 0;
    if (stock === 0) {
        showToast('Produit en rupture de stock', 'error');
        return;
    }
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        // Vérifier le stock disponible
        if (existingItem.quantity >= stock) {
            showToast('Stock insuffisant', 'warning');
            return;
        }
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: parseFloat(product.price || 0),
            quantity: 1,
            stock: stock
        });
    }
    
    updateCart();
    showToast('Produit ajouté au panier', 'success');
    animateAddToCart(productId);
    saveCartToStorage();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
    saveCartToStorage();
}

function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (!item) return;
    
    const newQuantity = item.quantity + change;
    
    if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
    }
    
    // Vérifier le stock disponible
    if (newQuantity > item.stock) {
        showToast('Stock insuffisant', 'warning');
        return;
    }
    
    item.quantity = newQuantity;
    updateCart();
    saveCartToStorage();
}

function clearCart() {
    if (cart.length === 0) return;
    
    if (confirm('Voulez-vous vider le panier ?')) {
        cart = [];
        updateCart();
        clearCartStorage();
        showToast('Panier vidé', 'info');
    }
}

function updateCart() {
    const cartItemsEl = document.getElementById('cartItems');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    if (!cartItemsEl) return;
    
    if (cart.length === 0) {
        cartItemsEl.innerHTML = `
            <div class="cart-empty">
                <div class="cart-empty-icon">🛒</div>
                <p>Votre panier est vide</p>
                <span>Ajoutez des produits pour commencer</span>
            </div>
        `;
        if (clearCartBtn) clearCartBtn.style.display = 'none';
        if (checkoutBtn) checkoutBtn.disabled = true;
    } else {
        cartItemsEl.innerHTML = cart.map(item => {
            const itemTotal = item.price * item.quantity;
            return `
                <div class="cart-item" data-item-id="${item.id}">
                    <div class="cart-item-header">
                        <div class="cart-item-name">${escapeHtml(item.name)}</div>
                        <button class="cart-item-remove" onclick="removeFromCart('${item.id}')" title="Supprimer">
                            ×
                        </button>
                    </div>
                    <div class="cart-item-details">
                        <div class="cart-item-price">${formatCurrency(item.price)} / unité</div>
                        <div class="cart-item-total">${formatCurrency(itemTotal)}</div>
                    </div>
                    <div class="cart-item-quantity">
                        <button 
                            class="quantity-btn" 
                            onclick="updateQuantity('${item.id}', -1)"
                            ${item.quantity <= 1 ? 'disabled' : ''}
                        >
                            −
                        </button>
                        <span class="quantity-value">${item.quantity}</span>
                        <button 
                            class="quantity-btn" 
                            onclick="updateQuantity('${item.id}', 1)"
                            ${item.quantity >= item.stock ? 'disabled' : ''}
                        >
                            +
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        if (clearCartBtn) clearCartBtn.style.display = 'block';
        if (checkoutBtn) checkoutBtn.disabled = false;
    }
    
    updateCartTotals();
}

function updateCartTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const tpsRate = settings?.taxes?.tps?.enabled ? (settings.taxes.tps.rate || 0) : 0;
    const tvqRate = settings?.taxes?.tvq?.enabled ? (settings.taxes.tvq.rate || 0) : 0;
    
    const tps = subtotal * tpsRate;
    const tvq = subtotal * tvqRate;
    const total = subtotal + tps + tvq;
    
    const currencySymbol = settings?.currencySymbol || '$';
    
    // Mettre à jour les affichages
    const subtotalEl = document.getElementById('cartSubtotal');
    const tpsEl = document.getElementById('cartTps');
    const tvqEl = document.getElementById('cartTvq');
    const totalEl = document.getElementById('cartTotal');
    const tpsRow = document.getElementById('tpsRow');
    const tvqRow = document.getElementById('tvqRow');
    const tpsLabel = document.getElementById('tpsLabel');
    const tvqLabel = document.getElementById('tvqLabel');
    
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (totalEl) totalEl.textContent = formatCurrency(total);
    
    // Afficher/masquer les taxes
    if (tpsRow && tpsRate > 0) {
        tpsRow.style.display = 'flex';
        if (tpsEl) tpsEl.textContent = formatCurrency(tps);
        if (tpsLabel) {
            const tpsName = settings?.taxes?.tps?.name || 'TPS';
            tpsLabel.textContent = `${tpsName} (${(tpsRate * 100).toFixed(2)}%)`;
        }
    } else if (tpsRow) {
        tpsRow.style.display = 'none';
    }
    
    if (tvqRow && tvqRate > 0) {
        tvqRow.style.display = 'flex';
        if (tvqEl) tvqEl.textContent = formatCurrency(tvq);
        if (tvqLabel) {
            const tvqName = settings?.taxes?.tvq?.name || 'TVQ';
            tvqLabel.textContent = `${tvqName} (${(tvqRate * 100).toFixed(3)}%)`;
        }
    } else if (tvqRow) {
        tvqRow.style.display = 'none';
    }
}

window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;

// ============================================
// CONFIRMATION DE VENTE
// ============================================

function showConfirmModal() {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:563',message:'showConfirmModal ENTRY',data:{cartLength:cart.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (cart.length === 0) {
        showToast('Le panier est vide', 'warning');
        return;
    }
    
    // Vérifier le stock avant confirmation
    const stockIssues = [];
    cart.forEach(item => {
        const product = products.find(p => p.id === item.id);
        if (!product || (product.stock || 0) < item.quantity) {
            stockIssues.push(item.name);
        }
    });
    
    if (stockIssues.length > 0) {
        showToast(`Stock insuffisant pour: ${stockIssues.join(', ')}`, 'error');
        // Recharger les produits pour mettre à jour les stocks
        loadProducts();
        updateCart();
        return;
    }
    
    // Calculer le total
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tpsRate = settings?.taxes?.tps?.enabled ? (settings.taxes.tps.rate || 0) : 0;
    const tvqRate = settings?.taxes?.tvq?.enabled ? (settings.taxes.tvq.rate || 0) : 0;
    const tps = subtotal * tpsRate;
    const tvq = subtotal * tvqRate;
    const total = subtotal + tps + tvq;
    
    // Afficher le total dans le modal
    const totalEl = document.getElementById('paymentTotalAmount');
    if (totalEl) {
        totalEl.textContent = formatCurrency(total);
    }
    
    // Mettre à jour le symbole de devise
    const currencySymbol = settings?.currencySymbol || '$';
    const currencySymbolEl = document.getElementById('cashCurrencySymbol');
    if (currencySymbolEl) {
        currencySymbolEl.textContent = currencySymbol;
    }
    
    // Réinitialiser le paiement
    selectedPaymentMethod = 'cash';
    cashAmountGiven = 0;
    const cashInput = document.getElementById('cashAmount');
    if (cashInput) {
        cashInput.value = '0.00';
        cashInput._buildingValue = '0'; // Réinitialiser la valeur en construction
    }
    updatePaymentMethodUI();
    updateCashChange();
    
    const modal = document.getElementById('confirmModal');
    console.log('🔧 [MODAL] showConfirmModal() - modal trouvé:', modal);
    // #region agent log
    const profileModal = document.getElementById('profileModal');
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:631',message:'Payment modal found - checking profile modal state BEFORE',data:{modalFound:!!modal,profileModalHasShow:profileModal?.classList.contains('show')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    if (modal) {
        modal.classList.add('show');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:638',message:'Payment modal shown - checking profile modal state AFTER',data:{hasShowClass:modal.classList.contains('show'),profileModalHasShow:profileModal?.classList.contains('show')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        console.log('🔧 [MODAL] Modal affiché, attente de 100ms avant setupVirtualKeyboard()');
        
        // Configurer le clavier virtuel une fois que le modal est visible
        setTimeout(() => {
            console.log('🔧 [MODAL] Timeout terminé, appel de setupVirtualKeyboard()');
            setupVirtualKeyboard();
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:648',message:'After timeout - checking profile modal state',data:{profileModalHasShow:profileModal?.classList.contains('show')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
        }, 100);
    } else {
        console.error('❌ [MODAL] Modal non trouvé!');
    }
}

function hideConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.classList.remove('show');
    }
    // Réinitialiser
    selectedPaymentMethod = 'cash';
    cashAmountGiven = 0;
    const cashInput = document.getElementById('cashAmount');
    if (cashInput) {
        cashInput.value = '0.00';
        cashInput._buildingValue = '0'; // Réinitialiser la valeur en construction
    }
}

function setupPaymentModal() {
    // Boutons de mode de paiement
    const paymentMethods = ['methodCash', 'methodCard', 'methodDebit', 'methodMobile'];
    paymentMethods.forEach(methodId => {
        const btn = document.getElementById(methodId);
        if (btn) {
            btn.addEventListener('click', () => {
                selectedPaymentMethod = btn.dataset.method;
                updatePaymentMethodUI();
                updateCashChange();
            });
        }
    });
    
    // Champ argent donné (readonly, utilise le clavier virtuel)
    const cashInput = document.getElementById('cashAmount');
    if (cashInput) {
        // Empêcher le clavier natif
        cashInput.addEventListener('focus', (e) => {
            e.target.blur();
        });
    }
    
    // Clavier numérique virtuel - sera configuré quand le modal s'ouvre
    // setupVirtualKeyboard() est appelé dans showConfirmModal()
    
    // Boutons rapides
    document.querySelectorAll('.quick-amount-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const amount = parseFloat(btn.dataset.amount);
            const cashInput = document.getElementById('cashAmount');
            if (cashInput) {
                const currentValue = parseFloat(cashInput.value.replace(/[^0-9.]/g, '')) || 0;
                const newValue = currentValue + amount;
                cashInput.value = formatCashInput(newValue.toString());
                cashInput._buildingValue = newValue.toString(); // Mettre à jour la valeur en construction
                cashAmountGiven = newValue;
                updateCashChange();
                updateConfirmButton();
            }
        });
    });
    
    // Annuler
    const cancelBtn = document.getElementById('cancelPaymentBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideConfirmModal);
    }
    
    // Confirmer
    const confirmBtn = document.getElementById('confirmPaymentBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmSale);
    }
    
    // Fermer avec X
    const closeBtn = document.getElementById('cancelConfirmBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', hideConfirmModal);
    }
}

function updatePaymentMethodUI() {
    // Mettre à jour les boutons
    document.querySelectorAll('.payment-method-btn').forEach(btn => {
        if (btn.dataset.method === selectedPaymentMethod) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Afficher/masquer la section comptant
    const cashSection = document.getElementById('cashPaymentSection');
    const nonCashSection = document.getElementById('nonCashPaymentSection');
    
    if (selectedPaymentMethod === 'cash') {
        if (cashSection) cashSection.style.display = 'block';
        if (nonCashSection) nonCashSection.style.display = 'none';
    } else {
        if (cashSection) cashSection.style.display = 'none';
        if (nonCashSection) {
            nonCashSection.style.display = 'block';
            
            // Mettre à jour les informations selon le mode de paiement
            const paymentInfo = {
                card: {
                    icon: '💳',
                    title: 'Paiement par Carte',
                    description: 'Le montant total sera traité via le terminal de paiement par carte.'
                },
                debit: {
                    icon: '🏦',
                    title: 'Paiement par Débit',
                    description: 'Le montant total sera traité via le terminal de paiement par débit.'
                },
                mobile: {
                    icon: '📱',
                    title: 'Paiement Mobile',
                    description: 'Le montant total sera traité via l\'application de paiement mobile.'
                }
            };
            
            const info = paymentInfo[selectedPaymentMethod] || paymentInfo.card;
            const iconEl = document.getElementById('paymentInfoIcon');
            const titleEl = document.getElementById('paymentInfoTitle');
            const descEl = document.getElementById('paymentInfoDescription');
            
            if (iconEl) iconEl.textContent = info.icon;
            if (titleEl) titleEl.textContent = info.title;
            if (descEl) descEl.textContent = info.description;
            
            // Mettre à jour le montant total
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const tpsRate = settings?.taxes?.tps?.enabled ? (settings.taxes.tps.rate || 0) : 0;
            const tvqRate = settings?.taxes?.tvq?.enabled ? (settings.taxes.tvq.rate || 0) : 0;
            const tps = subtotal * tpsRate;
            const tvq = subtotal * tvqRate;
            const total = subtotal + tps + tvq;
            
            const nonCashTotalEl = document.getElementById('nonCashTotalAmount');
            if (nonCashTotalEl) {
                nonCashTotalEl.textContent = formatCurrency(total);
            }
        }
    }
    
    updateConfirmButton();
}

function updateCashChange() {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:758',message:'updateCashChange called',data:{selectedPaymentMethod},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    if (selectedPaymentMethod !== 'cash') {
        const changeDisplay = document.getElementById('cashChangeDisplay');
        if (changeDisplay) {
            changeDisplay.style.display = 'none';
        }
        return;
    }
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tpsRate = settings?.taxes?.tps?.enabled ? (settings.taxes.tps.rate || 0) : 0;
    const tvqRate = settings?.taxes?.tvq?.enabled ? (settings.taxes.tvq.rate || 0) : 0;
    const tps = subtotal * tpsRate;
    const tvq = subtotal * tvqRate;
    const total = subtotal + tps + tvq;
    
    // Mettre à jour cashAmountGiven depuis l'input
    const cashInput = document.getElementById('cashAmount');
    if (cashInput) {
        const inputValue = cashInput.value.replace(/[^0-9.]/g, '');
        const oldCashAmountGiven = cashAmountGiven;
        cashAmountGiven = parseFloat(inputValue) || 0;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:775',message:'updateCashChange updating cashAmountGiven',data:{inputValue,cashInputValue:cashInput.value,oldValue:oldCashAmountGiven,newValue:cashAmountGiven},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
    }
    
    const change = cashAmountGiven - total;
    const changeDisplay = document.getElementById('cashChangeDisplay');
    const changeAmount = document.getElementById('changeAmount');
    
    if (changeDisplay && changeAmount) {
        const changeLabel = document.getElementById('changeLabel');
        // Afficher seulement si un montant a été saisi (même si c'est exact)
        if (cashAmountGiven > 0) {
            changeDisplay.style.display = 'flex';
            // Retirer les classes précédentes
            changeDisplay.classList.remove('negative', 'primary');
            
            if (change >= 0) {
                if (change === 0) {
                    // Montant exact
                    if (changeLabel) changeLabel.textContent = 'Montant exact';
                    changeAmount.textContent = 'Aucune monnaie à rendre';
                    changeDisplay.classList.add('primary');
                    changeAmount.className = 'change-amount positive';
                } else {
                    // Montant donné > total : il faut rendre de la monnaie
                    if (changeLabel) changeLabel.textContent = 'Monnaie à rendre';
                    changeAmount.textContent = formatCurrency(change);
                    changeDisplay.classList.remove('primary', 'negative');
                    changeAmount.className = 'change-amount positive';
                }
            } else {
                // Montant donné < total : il manque de l'argent
                if (changeLabel) changeLabel.textContent = 'Montant insuffisant';
                changeAmount.textContent = formatCurrency(Math.abs(change)) + ' manquant';
                changeAmount.className = 'change-amount negative';
                changeDisplay.classList.add('negative');
            }
        } else {
            changeDisplay.style.display = 'none';
        }
    }
    
    updateConfirmButton();
}

function canConfirmPayment() {
    if (cart.length === 0) return false;
    
    if (selectedPaymentMethod === 'cash') {
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tpsRate = settings?.taxes?.tps?.enabled ? (settings.taxes.tps.rate || 0) : 0;
        const tvqRate = settings?.taxes?.tvq?.enabled ? (settings.taxes.tvq.rate || 0) : 0;
        const tps = subtotal * tpsRate;
        const tvq = subtotal * tvqRate;
        const total = subtotal + tps + tvq;
        return cashAmountGiven >= total;
    }
    
    return true; // Pour les autres modes de paiement
}

function updateConfirmButton() {
    const confirmBtn = document.getElementById('confirmPaymentBtn');
    if (confirmBtn) {
        if (canConfirmPayment()) {
            confirmBtn.disabled = false;
        } else {
            confirmBtn.disabled = true;
        }
    }
}

function setupVirtualKeyboard() {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:841',message:'setupVirtualKeyboard called',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.log('🔧 [KEYBOARD] setupVirtualKeyboard() appelé');
    
    const cashInput = document.getElementById('cashAmount');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:845',message:'cashInput found',data:{found:!!cashInput,value:cashInput?.value},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.log('🔧 [KEYBOARD] cashInput trouvé:', cashInput);
    if (!cashInput) {
        console.error('❌ [KEYBOARD] cashInput non trouvé!');
        return;
    }
    
    // Utiliser event delegation sur le conteneur du clavier (chercher les deux variantes)
    const virtualKeyboard = document.querySelector('.virtual-keyboard-compact') || document.querySelector('.virtual-keyboard');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:852',message:'virtualKeyboard found',data:{found:!!virtualKeyboard,hasHandler:!!virtualKeyboard?._keyboardHandler},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (!virtualKeyboard) {
        console.error('❌ [KEYBOARD] .virtual-keyboard non trouvé!');
        return;
    }
    
    // Retirer l'ancien listener s'il existe
    if (virtualKeyboard._keyboardHandler) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:859',message:'removing old handler',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        virtualKeyboard.removeEventListener('click', virtualKeyboard._keyboardHandler);
    }
    
    // Créer un nouveau handler
    virtualKeyboard._keyboardHandler = (e) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:864',message:'keyboard click handler triggered',data:{targetTag:e.target.tagName,currentValue:cashInput.value},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        // Vérifier si le clic est sur une touche
        const keyButton = e.target.closest('.keyboard-key');
        if (!keyButton) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:866',message:'click not on keyboard key',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        const keyValue = keyButton.dataset.key;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:874',message:'keyboard key clicked',data:{keyValue,currentInputValue:cashInput.value},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        console.log(`🖱️ [KEYBOARD] CLIC DÉTECTÉ!`, {
            keyValue: keyValue,
            textContent: keyButton.textContent.trim(),
            element: keyButton
        });
        
        if (keyValue) {
            console.log(`✅ [KEYBOARD] Appel de handleKeyboardInput("${keyValue}")`);
            handleKeyboardInput(keyValue);
        } else {
            console.error(`❌ [KEYBOARD] Pas de data-key sur la touche!`, keyButton);
        }
    };
    
    // Ajouter le listener au conteneur
    virtualKeyboard.addEventListener('click', virtualKeyboard._keyboardHandler);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:890',message:'keyboard handler attached',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.log('✅ [KEYBOARD] Configuration du clavier terminée avec event delegation!');
}

function handleKeyboardInput(key) {
    console.log('⌨️ [HANDLE] handleKeyboardInput() appelé avec key:', key);
    
    const cashInput = document.getElementById('cashAmount');
    console.log('⌨️ [HANDLE] cashInput trouvé:', cashInput);
    
    if (!cashInput) {
        console.error('❌ [HANDLE] cashInput non trouvé!');
        return;
    }
    
    // Récupérer la valeur brute et la convertir en nombre
    const rawValue = cashInput.value.replace(/[^0-9.]/g, '') || '0';
    const numValue = parseFloat(rawValue) || 0;
    
    // Utiliser une variable interne pour stocker la valeur en cours de construction
    // Si on n'a pas encore de valeur en construction, utiliser la valeur actuelle
    if (!cashInput._buildingValue) {
        // Si c'est un entier, pas de point décimal dans la construction
        if (numValue % 1 === 0) {
            cashInput._buildingValue = numValue.toString();
        } else {
            // C'est un décimal, garder la représentation sans les zéros de fin
            const str = numValue.toString();
            const parts = str.split('.');
            if (parts.length === 2) {
                // Enlever les zéros de fin des décimales
                const decimals = parts[1].replace(/0+$/, '');
                if (decimals.length > 0) {
                    cashInput._buildingValue = parts[0] + '.' + decimals;
                } else {
                    cashInput._buildingValue = parts[0];
                }
            } else {
                cashInput._buildingValue = str;
            }
        }
    }
    
    let currentValue = cashInput._buildingValue || '0';
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:976',message:'currentValue extracted',data:{rawValue:cashInput.value,cleanedValue:currentValue,numValue},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.log('⌨️ [HANDLE] Valeur actuelle avant traitement:', currentValue);
    
    switch(key) {
        case 'backspace':
            console.log('⌨️ [HANDLE] Traitement: BACKSPACE');
            if (currentValue.length > 1) {
                currentValue = currentValue.slice(0, -1);
            } else {
                currentValue = '0';
            }
            cashInput._buildingValue = currentValue;
            break;
            
        case 'clear':
            console.log('⌨️ [HANDLE] Traitement: CLEAR');
            currentValue = '0';
            cashInput._buildingValue = '0';
            break;
            
        case 'enter':
            console.log('⌨️ [HANDLE] Traitement: ENTER');
            // Mettre à jour le montant et vérifier
            const cashInputForEnter = document.getElementById('cashAmount');
            if (cashInputForEnter) {
                const inputValue = cashInputForEnter.value.replace(/[^0-9.]/g, '');
                cashAmountGiven = parseFloat(inputValue) || 0;
            }
            updateCashChange();
            updateConfirmButton();
            // Ne pas confirmer automatiquement - le caissier doit cliquer sur "Confirmer le paiement"
            console.log('⌨️ [HANDLE] Montant mis à jour, attente de confirmation manuelle');
            return;
            
        case '.':
            console.log('⌨️ [HANDLE] Traitement: POINT');
            if (!currentValue.includes('.')) {
                currentValue += '.';
            }
            break;
            
        default:
            console.log('⌨️ [HANDLE] Traitement: DEFAULT (chiffre?)');
            // Chiffre (0-9)
            if (key >= '0' && key <= '9') {
                console.log(`⌨️ [HANDLE] C'est un chiffre: ${key}`);
                
                // Si la valeur est "0" (sans décimales), remplacer par le nouveau chiffre
                if (currentValue === '0' || (parseFloat(currentValue) === 0 && !currentValue.includes('.'))) {
                    currentValue = key;
                    console.log(`⌨️ [HANDLE] Valeur était 0, remplacée par: ${currentValue}`);
                } else {
                    // Construire le nouveau nombre en ajoutant le chiffre
                    const parts = currentValue.split('.');
                    
                    if (parts.length === 1) {
                        // Pas de décimales, on ajoute le chiffre à la partie entière
                        currentValue += key;
                        console.log(`⌨️ [HANDLE] Pas de décimales, ajout du chiffre: ${currentValue}`);
                    } else if (parts.length === 2) {
                        // Il y a des décimales
                        if (parts[1].length < 2) {
                            // Moins de 2 décimales, on peut ajouter
                            currentValue += key;
                            console.log(`⌨️ [HANDLE] Décimales < 2, ajout du chiffre: ${currentValue}`);
                        } else {
                            // Déjà 2 décimales, on ne fait rien (limite atteinte)
                            console.log(`⌨️ [HANDLE] Déjà 2 décimales, chiffre ignoré`);
                            return; // Sortir sans mettre à jour
                        }
                    }
                }
            } else {
                console.warn('⌨️ [HANDLE] Touche non reconnue:', key);
            }
            break;
    }
    
    console.log('⌨️ [HANDLE] Valeur après traitement:', currentValue);
    
    // Sauvegarder la valeur en construction
    cashInput._buildingValue = currentValue;
    
    // Formater et mettre à jour
    const formatted = formatCashInput(currentValue);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:1009',message:'formatting value',data:{beforeFormat:currentValue,afterFormat:formatted},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.log('⌨️ [HANDLE] Valeur formatée:', formatted);
    
    cashInput.value = formatted;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:1012',message:'input value set',data:{newValue:cashInput.value},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    cashAmountGiven = parseFloat(currentValue) || 0;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:1013',message:'cashAmountGiven updated',data:{cashAmountGiven},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    console.log('⌨️ [HANDLE] cashAmountGiven mis à jour:', cashAmountGiven);
    
    // Ne pas vérifier le montant à chaque touche, seulement mettre à jour l'affichage
    // La vérification se fera seulement sur Entrée ou lors de la confirmation
    // On met juste à jour la valeur, sans vérifier si c'est suffisant
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:1020',message:'handleKeyboardInput completed',data:{finalValue:cashInput.value},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.log('✅ [HANDLE] Traitement terminé!');
}

function formatCashInput(value) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:1023',message:'formatCashInput called',data:{inputValue:value},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    if (!value || value === '') return '0.00';
    
    // Enlever les caractères non numériques sauf le point
    let cleaned = value.toString().replace(/[^0-9.]/g, '');
    
    if (cleaned === '' || cleaned === '.') {
        cleaned = '0';
    }
    
    // S'assurer qu'il n'y a qu'un seul point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
        cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limiter à 2 décimales
    if (parts.length === 2 && parts[1].length > 2) {
        cleaned = parts[0] + '.' + parts[1].substring(0, 2);
    }
    
    // Formater avec 2 décimales
    const num = parseFloat(cleaned) || 0;
    const result = num.toFixed(2);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:1046',message:'formatCashInput result',data:{inputValue:value,cleaned,result},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    return result;
}

async function confirmSale() {
    if (cart.length === 0) {
        showToast('Le panier est vide', 'warning');
        hideConfirmModal();
        return;
    }
    
    // Afficher le loader
    showLoader();
    hideConfirmModal();
    
    try {
        // Vérifier à nouveau le stock (double vérification)
        const stockIssues = [];
        const itemsToUpdate = [];
        
        for (const item of cart) {
            const product = await getProductById(item.id);
            if (!product) {
                stockIssues.push(item.name);
                continue;
            }
            
            const currentStock = product.stock || 0;
            if (currentStock < item.quantity) {
                stockIssues.push(item.name);
                continue;
            }
            
            itemsToUpdate.push({
                product,
                item,
                newStock: currentStock - item.quantity
            });
        }
        
        if (stockIssues.length > 0) {
            hideLoader();
            showToast(`Stock insuffisant pour: ${stockIssues.join(', ')}`, 'error');
            await loadProducts();
            updateCart();
            return;
        }
        
        // Calculer les totaux
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tpsRate = settings?.taxes?.tps?.enabled ? (settings.taxes.tps.rate || 0) : 0;
        const tvqRate = settings?.taxes?.tvq?.enabled ? (settings.taxes.tvq.rate || 0) : 0;
        const tps = subtotal * tpsRate;
        const tvq = subtotal * tvqRate;
        const total = subtotal + tps + tvq;
        
        // Calculer la monnaie si comptant
        let change = 0;
        if (selectedPaymentMethod === 'cash') {
            change = cashAmountGiven - total;
        }
        
        // Créer la vente
        const saleData = {
            userId: currentUser.uid,
            userName: currentUser.name || currentUser.email,
            items: cart.map(item => ({
                productId: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity
            })),
            subtotal: subtotal,
            tps: tps,
            tvq: tvq,
            total: total,
            paymentMethod: selectedPaymentMethod,
            cashAmountGiven: selectedPaymentMethod === 'cash' ? cashAmountGiven : null,
            change: selectedPaymentMethod === 'cash' ? change : null,
            currencySymbol: settings?.currencySymbol || '$',
            currency: settings?.currency || 'CAD'
        };
        
        // Enregistrer la vente
        await createSale(saleData);
        
        // Mettre à jour les stocks
        for (const { product, newStock } of itemsToUpdate) {
            await updateProduct(product.id, { stock: newStock });
        }
        
        // Vider le panier
        cart = [];
        updateCart();
        clearCartStorage();
        
        // Recharger les produits
        await loadProducts();
        
        hideLoader();
        hideConfirmModal();
        
        // Afficher l'animation de succès
        showSuccessAnimation(selectedPaymentMethod, change);
        
    } catch (error) {
        console.error('Erreur lors de la confirmation de la vente:', error);
        hideLoader();
        showToast('Erreur lors de la confirmation de la vente: ' + (error.message || 'Une erreur est survenue'), 'error');
    }
}

// ============================================
// ANIMATIONS ET UX
// ============================================

function animateAddToCart(productId) {
    const productCard = document.querySelector(`[data-product-id="${productId}"]`);
    if (!productCard) return;
    
    productCard.style.transform = 'scale(0.95)';
    setTimeout(() => {
        productCard.style.transform = '';
    }, 150);
}

// ============================================
// UTILITAIRES
// ============================================

function displayUserInfo(user) {
    const headerNameEl = document.getElementById('headerUserName');
    const profileNameEl = document.getElementById('profileUserName');
    const profileEmailEl = document.getElementById('profileUserEmail');
    const profileRoleEl = document.getElementById('profileUserRole');
    
    if (headerNameEl) headerNameEl.textContent = user.name || user.email;
    if (profileNameEl) profileNameEl.textContent = user.name || user.email;
    if (profileEmailEl) profileEmailEl.textContent = user.email;
    if (profileRoleEl) profileRoleEl.textContent = user.role === 'admin' ? 'Administrateur' : 'Caissier';
}

function formatCurrency(amount) {
    const symbol = settings?.currencySymbol || '$';
    return `${symbol}${parseFloat(amount || 0).toFixed(2)}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || '✓'}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    
    // Animation d'entrée
    setTimeout(() => {
        toast.style.animation = 'toastSlideIn 0.3s ease';
    }, 10);
    
    // Supprimer après 3 secondes
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

function showLoader() {
    const loader = document.getElementById('loaderOverlay');
    if (loader) {
        loader.style.display = 'flex';
    }
}

function hideLoader() {
    const loader = document.getElementById('loaderOverlay');
    if (loader) {
        loader.style.display = 'none';
    }
}

// ============================================
// STOCKAGE LOCAL (OPTIONNEL)
// ============================================

function saveCartToStorage() {
    try {
        localStorage.setItem('pos_cart', JSON.stringify(cart));
    } catch (error) {
        console.warn('Impossible de sauvegarder le panier:', error);
    }
}

function loadCartFromStorage() {
    try {
        const saved = localStorage.getItem('pos_cart');
        if (saved) {
            const savedCart = JSON.parse(saved);
            // Vérifier que les produits existent toujours
            if (savedCart && Array.isArray(savedCart)) {
                cart = savedCart.filter(item => {
                    const product = products.find(p => p.id === item.id);
                    return product && (product.stock || 0) >= item.quantity;
                });
                updateCart();
            }
        }
    } catch (error) {
        console.warn('Impossible de charger le panier:', error);
    }
}

// Nettoyer le panier sauvegardé après une vente réussie
function clearCartStorage() {
    try {
        localStorage.removeItem('pos_cart');
    } catch (error) {
        console.warn('Impossible de nettoyer le panier:', error);
    }
}

// ============================================
// GESTION DU PROFIL
// ============================================

function setupProfile() {
    const profileBtn = document.getElementById('profileBtn');
    const profileModal = document.getElementById('profileModal');
    const closeProfileModal = document.getElementById('closeProfileModal');
    const profileLogoutBtn = document.getElementById('profileLogoutBtn');
    const goToAdminBtn = document.getElementById('goToAdminBtn');
    const exportTodayBtn = document.getElementById('exportTodayBtn');
    const exportAllBtn = document.getElementById('exportAllBtn');
    const exportTodayJSONBtn = document.getElementById('exportTodayJSONBtn');
    
    // Afficher/masquer le bouton admin selon le statut superadmin
    if (goToAdminBtn) {
        if (isSuperAdmin()) {
            goToAdminBtn.style.display = 'block';
        } else {
            goToAdminBtn.style.display = 'none';
        }
    }
    
    // Ouvrir le modal - gestionnaire d'événements isolé
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:1325',message:'Profile button lookup',data:{found:!!profileBtn},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (profileBtn) {
        // Fonction de gestionnaire isolée
        const handleProfileClick = function(e) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:1327',message:'Profile handler ENTRY',data:{targetId:e.target.id,targetTag:e.target.tagName,currentTargetId:e.currentTarget.id,phase:e.eventPhase,defaultPrevented:e.defaultPrevented},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            // IMPORTANT: Vérifier d'abord si le clic vient du bouton checkout
            const checkoutBtn = document.getElementById('checkoutBtn');
            if (checkoutBtn) {
                const clickedElement = e.target;
                const isCheckoutButton = clickedElement === checkoutBtn || 
                                        clickedElement.closest('#checkoutBtn') === checkoutBtn ||
                                        checkoutBtn.contains(clickedElement);
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:1335',message:'Profile checking if checkout button',data:{isCheckoutButton},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                if (isCheckoutButton) {
                    // Ce clic est pour le checkout, ne pas ouvrir le profil
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:1337',message:'Profile handler REJECTED - is checkout',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                    // #endregion
                    return;
                }
            }
            
            // Vérifier que c'est bien le bouton profile ou un de ses enfants qui a été cliqué
            const clickedElement = e.target;
            const isProfileButton = clickedElement === profileBtn || 
                                   clickedElement.closest('#profileBtn') === profileBtn ||
                                   profileBtn.contains(clickedElement);
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:1347',message:'Profile button check',data:{isProfileButton},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            if (!isProfileButton) {
                return;
            }
            
            // Arrêter la propagation immédiatement AVANT toute autre action
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:1361',message:'Profile opening modal',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            
            // Empêcher la propagation vers d'autres gestionnaires
            if (e.cancelable) {
                e.preventDefault();
            }
            
            console.log('✅ Profile button clicked - opening profile modal');
            loadProfileStats();
            // Vérifier à nouveau le statut superadmin à chaque ouverture
            if (goToAdminBtn && isSuperAdmin()) {
                goToAdminBtn.style.display = 'block';
            } else if (goToAdminBtn) {
                goToAdminBtn.style.display = 'none';
            }
            if (profileModal) {
                profileModal.classList.add('show');
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:1443',message:'Profile modal OPENED via handler',data:{hasShowClass:profileModal.classList.contains('show')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
            } else {
                console.error('❌ Profile modal not found');
            }
            return false;
        };
        
        // Retirer tous les anciens listeners en remplaçant le gestionnaire
        profileBtn.onclick = null;
        // Attacher le nouveau listener avec capture pour intercepter en premier
        profileBtn.addEventListener('click', handleProfileClick, { capture: true });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c746deba-63f3-4aa3-857f-fbcc815ec2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pos.js:1375',message:'Profile listener attached',data:{capture:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
    } else {
        console.error('❌ Profile button not found');
    }
    
    // Navigation vers admin
    if (goToAdminBtn) {
        goToAdminBtn.addEventListener('click', () => {
            window.location.href = '/admin.html';
        });
    }
    
    // Fermer le modal
    if (closeProfileModal) {
        closeProfileModal.addEventListener('click', () => {
            if (profileModal) {
                profileModal.classList.remove('show');
            }
        });
    }
    
    // Fermer en cliquant sur l'overlay
    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) {
                profileModal.classList.remove('show');
            }
        });
    }
    
    // Logout depuis le profil
    if (profileLogoutBtn) {
        profileLogoutBtn.addEventListener('click', async () => {
            if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
                await logout();
            }
        });
    }
    
    // Export
    if (exportTodayBtn) {
        exportTodayBtn.addEventListener('click', () => exportSales('today', 'csv'));
    }
    
    if (exportAllBtn) {
        exportAllBtn.addEventListener('click', () => exportSales('all', 'csv'));
    }
    
    if (exportTodayJSONBtn) {
        exportTodayJSONBtn.addEventListener('click', () => exportSales('today', 'json'));
    }
}

async function loadProfileStats() {
    try {
        const user = getCurrentUser();
        if (!user) return;
        
        // Charger les ventes de l'utilisateur
        const allSales = await getUserSales(user.uid);
        
        // Calculer les statistiques
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const salesToday = allSales.filter(sale => {
            const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
            return saleDate >= today;
        });
        
        const revenueToday = salesToday.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
        const totalRevenue = allSales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
        
        const currencySymbol = settings?.currencySymbol || '$';
        
        // Mettre à jour l'affichage
        const statSalesTodayEl = document.getElementById('statSalesToday');
        const statTotalSalesEl = document.getElementById('statTotalSales');
        const statRevenueTodayEl = document.getElementById('statRevenueToday');
        const statTotalRevenueEl = document.getElementById('statTotalRevenue');
        
        if (statSalesTodayEl) statSalesTodayEl.textContent = salesToday.length;
        if (statTotalSalesEl) statTotalSalesEl.textContent = allSales.length;
        if (statRevenueTodayEl) statRevenueTodayEl.textContent = formatCurrency(revenueToday);
        if (statTotalRevenueEl) statTotalRevenueEl.textContent = formatCurrency(totalRevenue);
        
    } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
        showToast('Erreur lors du chargement des statistiques', 'error');
    }
}

async function exportSales(period, format) {
    try {
        showLoader();
        
        const user = getCurrentUser();
        if (!user) return;
        
        const allSales = await getUserSales(user.uid);
        
        let salesToExport = [];
        
        if (period === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            salesToExport = allSales.filter(sale => {
                const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
                return saleDate >= today;
            });
        } else {
            salesToExport = allSales;
        }
        
        if (salesToExport.length === 0) {
            hideLoader();
            showToast('Aucune vente à exporter', 'warning');
            return;
        }
        
        if (format === 'csv') {
            exportToCSV(salesToExport, period);
        } else if (format === 'json') {
            exportToJSON(salesToExport, period);
        }
        
        hideLoader();
        showToast(`Export réussi : ${salesToExport.length} vente(s)`, 'success');
        
    } catch (error) {
        console.error('Erreur lors de l\'export:', error);
        hideLoader();
        showToast('Erreur lors de l\'export', 'error');
    }
}

function exportToCSV(sales, period) {
    const headers = [
        'ID Vente',
        'Date',
        'Article',
        'Quantité',
        'Prix unitaire',
        'Sous-total article',
        'Sous-total vente',
        'TPS',
        'TVQ',
        'Total vente'
    ];
    
    const rows = [];
    
    sales.forEach(sale => {
        const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
        const dateStr = saleDate.toLocaleDateString('fr-CA') + ' ' + saleDate.toLocaleTimeString('fr-CA');
        
        if (sale.items && sale.items.length > 0) {
            sale.items.forEach((item, index) => {
                const row = [
                    sale.id.substring(0, 8),
                    index === 0 ? dateStr : '',
                    item.name || 'N/A',
                    item.quantity || 0,
                    parseFloat(item.price || 0).toFixed(2),
                    (item.quantity * parseFloat(item.price || 0)).toFixed(2),
                    index === 0 ? parseFloat(sale.subtotal || 0).toFixed(2) : '',
                    index === 0 ? parseFloat(sale.tps || 0).toFixed(2) : '',
                    index === 0 ? parseFloat(sale.tvq || 0).toFixed(2) : '',
                    index === 0 ? parseFloat(sale.total || 0).toFixed(2) : ''
                ];
                rows.push(row);
            });
        }
    });
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const periodLabel = period === 'today' ? 'aujourdhui' : 'toutes';
    const filename = `ventes_${periodLabel}_${new Date().toISOString().split('T')[0]}.csv`;
    downloadFile(blob, filename);
}

function exportToJSON(sales, period) {
    const exportData = {
        periode: period === 'today' ? 'Aujourd\'hui' : 'Toutes les ventes',
        dateExport: new Date().toISOString(),
        nombreVentes: sales.length,
        totalRevenus: sales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0).toFixed(2),
        ventes: sales.map(sale => {
            const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
            return {
                id: sale.id,
                date: saleDate.toISOString(),
                dateFormatee: saleDate.toLocaleDateString('fr-CA') + ' ' + saleDate.toLocaleTimeString('fr-CA'),
                articles: sale.items || [],
                sousTotal: parseFloat(sale.subtotal || 0).toFixed(2),
                tps: parseFloat(sale.tps || 0).toFixed(2),
                tvq: parseFloat(sale.tvq || 0).toFixed(2),
                total: parseFloat(sale.total || 0).toFixed(2)
            };
        })
    };
    
    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    
    const periodLabel = period === 'today' ? 'aujourdhui' : 'toutes';
    const filename = `ventes_${periodLabel}_${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(blob, filename);
}

function downloadFile(blob, filename) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

function showSuccessAnimation(paymentMethod, change) {
    const successEl = document.getElementById('successAnimation');
    const successMessageEl = document.getElementById('successMessage');
    
    if (!successEl) return;
    
    const paymentMethodNames = {
        cash: 'Comptant',
        card: 'Carte',
        debit: 'Débit',
        mobile: 'Mobile'
    };
    
    let message = `Paiement: ${paymentMethodNames[paymentMethod] || paymentMethod}`;
    if (paymentMethod === 'cash' && change > 0) {
        message += ` • Monnaie: ${formatCurrency(change)}`;
    }
    
    if (successMessageEl) {
        successMessageEl.textContent = message;
    }
    
    successEl.style.display = 'flex';
    
    // Fermer après 2.5 secondes
    setTimeout(() => {
        successEl.style.display = 'none';
        showToast('Vente confirmée avec succès !', 'success');
    }, 2500);
}

