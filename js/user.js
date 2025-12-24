// Logique du dashboard caissier (Point de Vente)
import { logout, getCurrentUser } from './auth.js';
import { getAllProducts, createSale, updateProduct, getSettings } from './firestore.js';

let products = [];
let cart = [];
let settings = null;

// Vérifier l'authentification
window.addEventListener('DOMContentLoaded', async () => {
    const user = getCurrentUser();
    
    if (!user) {
        window.location.href = '/login.html';
        return;
    }
    
    // Afficher les infos utilisateur
    displayUserInfo(user);
    
    // Charger les paramètres
    await loadSettings();
    
    // Charger les produits
    loadProducts();
    
    // Charger le panier depuis localStorage
    loadCart();
    
    // Configurer le logout
    setupLogout();
    
    // Configurer le checkout
    setupCheckout();
});

async function loadSettings() {
    try {
        settings = await getSettings();
        updateTaxLabels();
    } catch (error) {
        console.error('Erreur lors du chargement des paramètres:', error);
        // Utiliser les valeurs par défaut
        settings = {
            currencySymbol: '$',
            taxes: {
                tps: { enabled: true, rate: 0.05, name: 'TPS' },
                tvq: { enabled: true, rate: 0.09975, name: 'TVQ' }
            }
        };
        updateTaxLabels();
    }
}

function updateTaxLabels() {
    if (!settings) return;
    
    const tpsRow = document.querySelector('#tps').parentElement;
    const tvqRow = document.querySelector('#tvq').parentElement;
    
    if (settings.taxes?.tps?.enabled) {
        const tpsRate = ((settings.taxes.tps.rate || 0) * 100).toFixed(4);
        tpsRow.querySelector('span').textContent = `${settings.taxes.tps.name || 'TPS'} (${tpsRate}%):`;
        tpsRow.style.display = 'flex';
    } else {
        tpsRow.style.display = 'none';
    }
    
    if (settings.taxes?.tvq?.enabled) {
        const tvqRate = ((settings.taxes.tvq.rate || 0) * 100).toFixed(4);
        tvqRow.querySelector('span').textContent = `${settings.taxes.tvq.name || 'TVQ'} (${tvqRate}%):`;
        tvqRow.style.display = 'flex';
    } else {
        tvqRow.style.display = 'none';
    }
}

function getCurrencySymbol() {
    return settings?.currencySymbol || '$';
}

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

async function loadProducts() {
    try {
        products = await getAllProducts();
        displayProducts(products);
    } catch (error) {
        console.error('Erreur lors du chargement des produits:', error);
        document.getElementById('productsGrid').innerHTML = 
            '<p style="color: var(--color-error); text-align: center; padding: 40px;">Erreur lors du chargement des produits</p>';
    }
}

function displayProducts(productsList) {
    const grid = document.getElementById('productsGrid');
    
    if (productsList.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: rgba(255, 255, 255, 0.5); padding: 40px;">Aucun produit disponible</p>';
        return;
    }
    
    const currencySymbol = getCurrencySymbol();
    grid.innerHTML = productsList.map(product => {
        const basePrice = parseFloat(product.price || 0);
        const finalPrice = calculatePromotionPrice(product);
        const hasPromotion = product.promotion && product.promotion.enabled && finalPrice < basePrice;
        
        const imageHtml = product.imageUrl 
            ? `<img src="${product.imageUrl}" alt="${product.name}">` 
            : '<div style="height: 150px; background: rgba(212, 175, 55, 0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: rgba(255, 255, 255, 0.3);">Pas d\'image</div>';
        const promoBadge = hasPromotion 
            ? '<div style="position: absolute; top: 10px; right: 10px; background: #ff6b6b; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; z-index: 10;">PROMO</div>' 
            : '';
        
        return `
        <div class="product-card" data-product-id="${product.id}" style="position: relative;">
            ${imageHtml}
            ${promoBadge}
            <div class="product-name">${product.name}</div>
            <div class="product-price">
                ${hasPromotion ? `
                    <span style="text-decoration: line-through; color: rgba(255, 255, 255, 0.5); font-size: 0.9em; margin-right: 8px;">
                        ${currencySymbol}${basePrice.toFixed(2)}
                    </span>
                    <span style="color: #51cf66; font-weight: bold; font-size: 1.1em;">
                        ${currencySymbol}${finalPrice.toFixed(2)}
                    </span>
                ` : `${currencySymbol}${basePrice.toFixed(2)}`}
            </div>
            <div class="product-stock">Stock: ${product.stock || 0}</div>
        </div>
    `;
    }).join('');
    
    // Ajouter les event listeners
    grid.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', () => {
            const productId = card.getAttribute('data-product-id');
            addToCart(productId);
        });
    });
}

function calculatePromotionPrice(product) {
    const basePrice = parseFloat(product.price || 0);
    const promotion = product.promotion;
    
    if (!promotion || !promotion.enabled) {
        return basePrice;
    }
    
    // Vérifier si la promotion est active
    const now = new Date();
    const startDate = promotion.startDate ? new Date(promotion.startDate) : null;
    const endDate = promotion.endDate ? new Date(promotion.endDate) : null;
    
    const isActive = (!startDate || now >= startDate) && (!endDate || now <= endDate);
    
    if (!isActive) {
        return basePrice;
    }
    
    // Calculer le prix avec remise
    if (promotion.type === 'percentage') {
        return basePrice * (1 - promotion.value / 100);
    } else if (promotion.type === 'fixed') {
        return Math.max(0, basePrice - promotion.value);
    }
    
    return basePrice;
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    
    if (!product) return;
    
    // Vérifier le stock
    if (product.stock <= 0) {
        alert('Ce produit est en rupture de stock');
        return;
    }
    
    // Calculer le prix avec promotion
    const finalPrice = calculatePromotionPrice(product);
    
    // Vérifier si le produit est déjà dans le panier
    const cartItem = cart.find(item => item.id === productId);
    
    if (cartItem) {
        // Vérifier le stock disponible
        if (cartItem.quantity >= product.stock) {
            alert('Stock insuffisant');
            return;
        }
        cartItem.quantity++;
        // Mettre à jour le prix au cas où la promotion aurait changé
        cartItem.price = finalPrice;
        cartItem.originalPrice = parseFloat(product.price || 0);
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: finalPrice,
            originalPrice: parseFloat(product.price || 0),
            quantity: 1,
            stock: product.stock,
            hasPromotion: product.promotion && product.promotion.enabled
        });
    }
    
    saveCart();
    displayCart();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    displayCart();
}

function updateQuantity(productId, change) {
    const cartItem = cart.find(item => item.id === productId);
    if (!cartItem) return;
    
    const newQuantity = cartItem.quantity + change;
    
    if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
    }
    
    if (newQuantity > cartItem.stock) {
        alert('Stock insuffisant');
        return;
    }
    
    cartItem.quantity = newQuantity;
    saveCart();
    displayCart();
}

function displayCart() {
    const cartItemsEl = document.getElementById('cartItems');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p style="text-align: center; color: rgba(255, 255, 255, 0.5); padding: 40px;">Votre panier est vide</p>';
        checkoutBtn.disabled = true;
        updateTotals();
        return;
    }
    
    checkoutBtn.disabled = false;
    
    const currencySymbol = getCurrencySymbol();
    cartItemsEl.innerHTML = cart.map(item => {
        const hasDiscount = item.originalPrice && item.price < item.originalPrice;
        const discountAmount = hasDiscount ? (item.originalPrice - item.price) * item.quantity : 0;
        
        return `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">
                    ${hasDiscount ? `
                        <span style="text-decoration: line-through; color: rgba(255, 255, 255, 0.5); font-size: 0.9em; margin-right: 8px;">
                            ${currencySymbol}${item.originalPrice.toFixed(2)}
                        </span>
                        <span style="color: #51cf66; font-weight: 600;">
                            ${currencySymbol}${item.price.toFixed(2)}
                        </span>
                    ` : `${currencySymbol}${item.price.toFixed(2)}`}
                </div>
                ${hasDiscount ? `<div style="color: #51cf66; font-size: 0.85em; margin-top: 4px;">Économie: ${currencySymbol}${discountAmount.toFixed(2)}</div>` : ''}
                <div class="cart-item-quantity">
                    <button class="quantity-btn" onclick="window.updateQuantity('${item.id}', -1)">-</button>
                    <span style="color: var(--color-white); min-width: 30px; text-align: center;">${item.quantity}</span>
                    <button class="quantity-btn" onclick="window.updateQuantity('${item.id}', 1)">+</button>
                    <button class="btn btn-danger" style="margin-left: auto; padding: 5px 10px; font-size: 0.8em;" onclick="window.removeFromCart('${item.id}')">Supprimer</button>
                </div>
            </div>
        </div>
    `;
    }).join('');
    
    updateTotals();
}

function updateTotals() {
    if (!settings) {
        // Valeurs par défaut si les paramètres ne sont pas encore chargés
        settings = {
            currencySymbol: '$',
            taxes: {
                tps: { enabled: true, rate: 0.05, name: 'TPS' },
                tvq: { enabled: true, rate: 0.09975, name: 'TVQ' }
            }
        };
    }
    
    const currencySymbol = getCurrencySymbol();
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const tps = settings.taxes?.tps?.enabled ? subtotal * (settings.taxes.tps.rate || 0) : 0;
    const tvq = settings.taxes?.tvq?.enabled ? subtotal * (settings.taxes.tvq.rate || 0) : 0;
    const total = subtotal + tps + tvq;
    
    document.getElementById('subtotal').textContent = `${currencySymbol}${subtotal.toFixed(2)}`;
    document.getElementById('tps').textContent = `${currencySymbol}${tps.toFixed(2)}`;
    document.getElementById('tvq').textContent = `${currencySymbol}${tvq.toFixed(2)}`;
    document.getElementById('total').textContent = `${currencySymbol}${total.toFixed(2)}`;
}

function saveCart() {
    localStorage.setItem('swiftpos_cart', JSON.stringify(cart));
}

function loadCart() {
    const savedCart = localStorage.getItem('swiftpos_cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        displayCart();
    }
}

function setupCheckout() {
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', async () => {
            if (cart.length === 0) return;
            
            const currencySymbol = getCurrencySymbol();
            const totalText = document.getElementById('total').textContent.replace(currencySymbol, '');
            if (!confirm(`Confirmer la vente de ${cart.length} article(s) pour un total de ${currencySymbol}${totalText}?`)) {
                return;
            }
            
            try {
                if (!settings) {
                    settings = await getSettings();
                }
                
                const user = getCurrentUser();
                const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                
                const tps = settings.taxes?.tps?.enabled ? subtotal * (settings.taxes.tps.rate || 0) : 0;
                const tvq = settings.taxes?.tvq?.enabled ? subtotal * (settings.taxes.tvq.rate || 0) : 0;
                const total = subtotal + tps + tvq;
                
                // Calculer les remises totales
                const totalDiscount = cart.reduce((sum, item) => {
                    if (item.originalPrice && item.price < item.originalPrice) {
                        return sum + ((item.originalPrice - item.price) * item.quantity);
                    }
                    return sum;
                }, 0);
                
                // Créer la vente
                const saleData = {
                    userId: user.uid,
                    userName: user.name || user.email,
                    items: cart.map(item => ({
                        productId: item.id,
                        name: item.name,
                        price: item.price,
                        originalPrice: item.originalPrice || item.price,
                        quantity: item.quantity,
                        discount: item.originalPrice && item.price < item.originalPrice ? 
                            (item.originalPrice - item.price) * item.quantity : 0
                    })),
                    subtotal: subtotal,
                    totalDiscount: totalDiscount,
                    tps: tps,
                    tvq: tvq,
                    total: total,
                    currency: settings.currency || 'CAD',
                    currencySymbol: settings.currencySymbol || '$'
                };
                
                await createSale(saleData);
                
                // Mettre à jour les stocks
                for (const item of cart) {
                    const product = products.find(p => p.id === item.id);
                    if (product) {
                        await updateProduct(item.id, {
                            stock: product.stock - item.quantity
                        });
                    }
                }
                
                // Vider le panier
                cart = [];
                saveCart();
                displayCart();
                
                // Recharger les produits pour mettre à jour les stocks
                await loadProducts();
                
                alert('Vente confirmée avec succès!');
            } catch (error) {
                console.error('Erreur lors de la vente:', error);
                alert('Erreur lors de la confirmation de la vente. Veuillez réessayer.');
            }
        });
    }
}

// Exposer les fonctions globalement pour les onclick
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;

