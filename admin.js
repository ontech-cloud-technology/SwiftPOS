// Logique du dashboard admin
import { logout, getCurrentUser, isAdmin, isSuperAdmin } from './auth.js';
import { getAllUsers, getAllProducts, getAllSales, getSettings, createSale, updateProduct, getProductById } from './firestore.js';
import { formatDate } from './utils.js';

let allSales = [];
let allProducts = [];
let allUsers = [];
let settings = null;

// Variables pour la vente forcée
let forceSaleCart = [];
let forceSaleProducts = [];
let forceSaleFilteredProducts = [];
let forceSaleSelectedPaymentMethod = 'cash';

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
    
    // Afficher les infos utilisateur
    displayUserInfo(user);
    
    // Afficher le lien vers la caisse si superadmin
    setupSuperAdminNav();
    
    // Charger les données
    loadDashboardData();
    
    // Configurer le logout
    setupLogout();
    
    // Configurer la vente forcée
    setupForceSale();
});

function displayUserInfo(user) {
    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    
    if (nameEl) nameEl.textContent = user.name || user.email;
    if (emailEl) emailEl.textContent = user.email;
}

function setupSuperAdminNav() {
    // Afficher le lien vers la caisse dans la sidebar si superadmin
    const posNavItem = document.getElementById('posNavItem');
    if (posNavItem) {
        if (isSuperAdmin()) {
            posNavItem.style.display = 'block';
        } else {
            posNavItem.style.display = 'none';
        }
    }
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

async function loadDashboardData() {
    try {
        // Charger les paramètres
        try {
            settings = await getSettings();
        } catch (error) {
            console.error('Erreur lors du chargement des paramètres:', error);
            settings = {
                currencySymbol: '$',
                taxes: {
                    tps: { enabled: true, rate: 0.05, name: 'TPS' },
                    tvq: { enabled: true, rate: 0.09975, name: 'TVQ' }
                }
            };
        }
        
        // Charger toutes les données en parallèle
        [allSales, allProducts, allUsers] = await Promise.all([
            getAllSales(),
            getAllProducts(),
            getAllUsers()
        ]);
        
        // Afficher toutes les sections du dashboard
        displayStats();
        displayRecentSales();
        displayAlerts();
        displayLowStock();
        
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        showError('Erreur lors du chargement des données');
    }
}

function getCurrencySymbol() {
    return settings?.currencySymbol || '$';
}

function displayStats() {
    const currencySymbol = getCurrencySymbol();
    
    // Ventes aujourd'hui
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySales = allSales.filter(sale => {
        const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime();
    });
    
    const todaySalesEl = document.getElementById('todaySales');
    if (todaySalesEl) {
        todaySalesEl.textContent = todaySales.length;
    }
    
    // Revenus du mois
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthSales = allSales.filter(sale => {
        const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
        return saleDate >= firstDayOfMonth;
    });
    
    const monthRevenue = monthSales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
    const monthRevenueEl = document.getElementById('monthRevenue');
    if (monthRevenueEl) {
        monthRevenueEl.textContent = `${currencySymbol}${monthRevenue.toFixed(2)}`;
    }
    
    // Total produits
    const totalProductsEl = document.getElementById('totalProducts');
    if (totalProductsEl) {
        totalProductsEl.textContent = allProducts.length;
    }
    
    // Utilisateurs actifs
    const activeUsersEl = document.getElementById('activeUsers');
    if (activeUsersEl) {
        activeUsersEl.textContent = allUsers.length;
    }
}

function displayRecentSales() {
    const container = document.getElementById('recentSalesContainer');
    if (!container) return;
    
    const currencySymbol = getCurrencySymbol();
    const recentSales = allSales.slice(0, 5);
    
    if (recentSales.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p class="empty-state-title">Aucune vente récente</p>
                <p class="empty-state-message">Les ventes apparaîtront ici</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = recentSales.map(sale => {
        const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
        const formattedDate = formatDate(saleDate);
        const saleId = sale.id.substring(0, 8);
        
        return `
            <div class="recent-sale-item">
                <div class="sale-info">
                    <p class="sale-number">Commande #${saleId}</p>
                    <p class="sale-date">${formattedDate}</p>
                </div>
                <div class="sale-amount">${currencySymbol}${parseFloat(sale.total || 0).toFixed(2)}</div>
            </div>
        `;
    }).join('');
}

function displayAlerts() {
    const container = document.getElementById('alertsContainer');
    if (!container) return;
    
    const alerts = [];
    
    // Vérifier le stock faible
    const lowStockProducts = allProducts.filter(product => {
        const stock = parseFloat(product.stock || 0);
        return stock > 0 && stock <= 10;
    });
    
    if (lowStockProducts.length > 0) {
        alerts.push({
            type: 'warning',
            icon: '⚠️',
            title: 'Stock faible',
            message: `${lowStockProducts.length} produit(s) ont un stock faible (≤10 unités)`
        });
    }
    
    // Vérifier le stock critique
    const criticalStockProducts = allProducts.filter(product => {
        const stock = parseFloat(product.stock || 0);
        return stock === 0;
    });
    
    if (criticalStockProducts.length > 0) {
        alerts.push({
            type: 'error',
            icon: '🚨',
            title: 'Stock épuisé',
            message: `${criticalStockProducts.length} produit(s) sont en rupture de stock`
        });
    }
    
    // Vérifier les ventes aujourd'hui
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySales = allSales.filter(sale => {
        const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime();
    });
    
    if (todaySales.length === 0) {
        alerts.push({
            type: 'info',
            icon: 'ℹ️',
            title: 'Aucune vente aujourd\'hui',
            message: 'Aucune transaction n\'a été effectuée aujourd\'hui'
        });
    }
    
    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✅</div>
                <p class="empty-state-title">Tout va bien !</p>
                <p class="empty-state-message">Aucune alerte pour le moment</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = alerts.map(alert => `
        <div class="alert-item ${alert.type}">
            <div class="alert-icon">${alert.icon}</div>
            <div class="alert-content">
                <p class="alert-title">${alert.title}</p>
                <p class="alert-message">${alert.message}</p>
            </div>
        </div>
    `).join('');
}

function displayLowStock() {
    const container = document.getElementById('lowStockContainer');
    if (!container) return;
    
    const lowStockProducts = allProducts
        .filter(product => {
            const stock = parseFloat(product.stock || 0);
            return stock <= 10;
        })
        .sort((a, b) => parseFloat(a.stock || 0) - parseFloat(b.stock || 0))
        .slice(0, 5);
    
    // Mettre à jour l'alerte dans les stats
    const lowStockAlertEl = document.getElementById('lowStockAlert');
    if (lowStockAlertEl) {
        const criticalCount = allProducts.filter(p => parseFloat(p.stock || 0) === 0).length;
        const lowCount = allProducts.filter(p => {
            const stock = parseFloat(p.stock || 0);
            return stock > 0 && stock <= 10;
        }).length;
        
        if (criticalCount > 0) {
            lowStockAlertEl.textContent = `${criticalCount} en rupture`;
            lowStockAlertEl.style.color = 'var(--color-error)';
        } else if (lowCount > 0) {
            lowStockAlertEl.textContent = `${lowCount} stock faible`;
            lowStockAlertEl.style.color = 'var(--color-warning)';
        } else {
            lowStockAlertEl.textContent = 'Tout est en stock';
            lowStockAlertEl.style.color = 'var(--color-success)';
        }
    }
    
    if (lowStockProducts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✅</div>
                <p class="empty-state-title">Stock optimal</p>
                <p class="empty-state-message">Tous les produits ont un stock suffisant</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = lowStockProducts.map(product => {
        const stock = parseFloat(product.stock || 0);
        const badgeClass = stock === 0 ? 'critical' : 'low';
        const badgeText = stock === 0 ? 'Rupture' : 'Faible';
        
        return `
            <div class="low-stock-item">
                <div class="product-info">
                    <p class="product-name">${product.name}</p>
                    <p class="product-stock">Stock actuel: ${stock} unité(s)</p>
                </div>
                <div class="stock-badge ${badgeClass}">${badgeText}</div>
            </div>
        `;
    }).join('');
}

function showError(message) {
    const containers = [
        document.getElementById('alertsContainer'),
        document.getElementById('recentSalesContainer'),
        document.getElementById('lowStockContainer')
    ];
    
    containers.forEach(container => {
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">❌</div>
                    <p class="empty-state-title">Erreur</p>
                    <p class="empty-state-message">${message}</p>
                </div>
            `;
        }
    });
}

// ============================================
// FONCTIONNALITÉ FORCER UNE VENTE
// ============================================

function setupForceSale() {
    const forceSaleBtn = document.getElementById('forceSaleBtn');
    const forceSaleModal = document.getElementById('forceSaleModal');
    const closeForceSaleModal = document.getElementById('closeForceSaleModal');
    const cancelForceSaleBtn = document.getElementById('cancelForceSaleBtn');
    const confirmForceSaleBtn = document.getElementById('confirmForceSaleBtn');
    const productSearch = document.getElementById('forceSaleProductSearch');
    
    // Ouvrir le modal
    if (forceSaleBtn) {
        forceSaleBtn.addEventListener('click', () => {
            openForceSaleModal();
        });
    }
    
    // Fermer le modal
    const closeModal = () => {
        if (forceSaleModal) {
            forceSaleModal.classList.remove('show');
        }
        resetForceSale();
    };
    
    if (closeForceSaleModal) {
        closeForceSaleModal.addEventListener('click', closeModal);
    }
    
    if (cancelForceSaleBtn) {
        cancelForceSaleBtn.addEventListener('click', closeModal);
    }
    
    if (forceSaleModal) {
        forceSaleModal.addEventListener('click', (e) => {
            if (e.target === forceSaleModal) {
                closeModal();
            }
        });
    }
    
    // Recherche de produits
    if (productSearch) {
        productSearch.addEventListener('input', (e) => {
            filterForceSaleProducts(e.target.value);
        });
    }
    
    // Modes de paiement
    ['cash', 'card', 'debit', 'mobile'].forEach(method => {
        const btn = document.getElementById(`forceSaleMethod${method.charAt(0).toUpperCase() + method.slice(1)}`);
        if (btn) {
            btn.addEventListener('click', () => {
                forceSaleSelectedPaymentMethod = method;
                updateForceSalePaymentMethods();
                updateForceSaleConfirmButton();
            });
        }
    });
    
    // Confirmer la vente
    if (confirmForceSaleBtn) {
        confirmForceSaleBtn.addEventListener('click', confirmForceSale);
    }
}

async function openForceSaleModal() {
    const modal = document.getElementById('forceSaleModal');
    if (!modal) return;
    
    // Réinitialiser
    resetForceSale();
    
    // Charger les produits
    try {
        forceSaleProducts = await getAllProducts();
        forceSaleFilteredProducts = forceSaleProducts.filter(p => (p.stock || 0) > 0);
        displayForceSaleProducts(forceSaleFilteredProducts);
    } catch (error) {
        console.error('Erreur lors du chargement des produits:', error);
        showForceSaleError('Erreur lors du chargement des produits');
    }
    
    // Charger les paramètres si pas déjà chargés
    if (!settings) {
        try {
            settings = await getSettings();
        } catch (error) {
            console.error('Erreur lors du chargement des paramètres:', error);
            settings = {
                currencySymbol: '$',
                taxes: {
                    tps: { enabled: true, rate: 0.05, name: 'TPS' },
                    tvq: { enabled: true, rate: 0.09975, name: 'TVQ' }
                }
            };
        }
    }
    
    modal.classList.add('show');
}

function resetForceSale() {
    forceSaleCart = [];
    forceSaleSelectedPaymentMethod = 'cash';
    const productSearch = document.getElementById('forceSaleProductSearch');
    if (productSearch) productSearch.value = '';
    updateForceSaleCart();
    updateForceSalePaymentMethods();
}

function displayForceSaleProducts(productsList) {
    const container = document.getElementById('forceSaleProductsList');
    if (!container) return;
    
    if (productsList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Aucun produit trouvé</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = productsList.map(product => {
        const stock = product.stock || 0;
        const price = parseFloat(product.price || 0);
        const inCart = forceSaleCart.find(item => item.id === product.id);
        const cartQuantity = inCart ? inCart.quantity : 0;
        
        return `
            <div class="force-sale-product-item">
                <div class="product-info">
                    <h4>${escapeHtml(product.name)}</h4>
                    <p class="product-price">${getCurrencySymbol()}${price.toFixed(2)}</p>
                    <p class="product-stock">Stock: ${stock}</p>
                </div>
                <div class="product-actions">
                    ${cartQuantity > 0 ? `
                        <button class="btn btn-sm btn-secondary" onclick="removeFromForceSaleCart('${product.id}')">−</button>
                        <span class="quantity-badge">${cartQuantity}</span>
                        <button class="btn btn-sm btn-primary" onclick="addToForceSaleCart('${product.id}')" ${cartQuantity >= stock ? 'disabled' : ''}>+</button>
                    ` : `
                        <button class="btn btn-sm btn-primary" onclick="addToForceSaleCart('${product.id}')" ${stock === 0 ? 'disabled' : ''}>
                            Ajouter
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

function filterForceSaleProducts(searchTerm) {
    const term = searchTerm.toLowerCase();
    forceSaleFilteredProducts = forceSaleProducts.filter(product => {
        if ((product.stock || 0) === 0) return false;
        return product.name?.toLowerCase().includes(term);
    });
    displayForceSaleProducts(forceSaleFilteredProducts);
}

window.addToForceSaleCart = function(productId) {
    const product = forceSaleProducts.find(p => p.id === productId);
    if (!product) return;
    
    const stock = product.stock || 0;
    if (stock === 0) {
        showForceSaleMessage('Produit en rupture de stock', 'error');
        return;
    }
    
    const existingItem = forceSaleCart.find(item => item.id === productId);
    
    if (existingItem) {
        if (existingItem.quantity >= stock) {
            showForceSaleMessage('Stock insuffisant', 'warning');
            return;
        }
        existingItem.quantity += 1;
    } else {
        forceSaleCart.push({
            id: product.id,
            name: product.name,
            price: parseFloat(product.price || 0),
            quantity: 1,
            stock: stock
        });
    }
    
    updateForceSaleCart();
    displayForceSaleProducts(forceSaleFilteredProducts);
};

window.removeFromForceSaleCart = function(productId) {
    const item = forceSaleCart.find(item => item.id === productId);
    if (!item) return;
    
    if (item.quantity > 1) {
        item.quantity -= 1;
    } else {
        forceSaleCart = forceSaleCart.filter(item => item.id !== productId);
    }
    
    updateForceSaleCart();
    displayForceSaleProducts(forceSaleFilteredProducts);
};

function updateForceSaleCart() {
    const container = document.getElementById('forceSaleCartItems');
    if (!container) return;
    
    if (forceSaleCart.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Aucun article sélectionné</p>
            </div>
        `;
    } else {
        container.innerHTML = forceSaleCart.map(item => {
            const itemTotal = item.price * item.quantity;
            return `
                <div class="force-sale-cart-item">
                    <div class="cart-item-info">
                        <span class="cart-item-name">${escapeHtml(item.name)}</span>
                        <span class="cart-item-price">${getCurrencySymbol()}${item.price.toFixed(2)} × ${item.quantity}</span>
                    </div>
                    <div class="cart-item-total">${getCurrencySymbol()}${itemTotal.toFixed(2)}</div>
                    <button class="btn btn-sm btn-danger" onclick="removeFromForceSaleCart('${item.id}')" title="Retirer">×</button>
                </div>
            `;
        }).join('');
    }
    
    updateForceSaleTotals();
    updateForceSaleConfirmButton();
}

function updateForceSaleTotals() {
    const subtotal = forceSaleCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const tpsRate = settings?.taxes?.tps?.enabled ? (settings.taxes.tps.rate || 0) : 0;
    const tvqRate = settings?.taxes?.tvq?.enabled ? (settings.taxes.tvq.rate || 0) : 0;
    
    const tps = subtotal * tpsRate;
    const tvq = subtotal * tvqRate;
    const total = subtotal + tps + tvq;
    
    const currencySymbol = getCurrencySymbol();
    
    const subtotalEl = document.getElementById('forceSaleSubtotal');
    const tpsEl = document.getElementById('forceSaleTps');
    const tvqEl = document.getElementById('forceSaleTvq');
    const totalEl = document.getElementById('forceSaleTotal');
    const tpsRow = document.getElementById('forceSaleTpsRow');
    const tvqRow = document.getElementById('forceSaleTvqRow');
    const tpsLabel = document.getElementById('forceSaleTpsLabel');
    const tvqLabel = document.getElementById('forceSaleTvqLabel');
    
    if (subtotalEl) subtotalEl.textContent = `${currencySymbol}${subtotal.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `${currencySymbol}${total.toFixed(2)}`;
    
    if (tpsRow && tpsRate > 0) {
        tpsRow.style.display = 'flex';
        if (tpsEl) tpsEl.textContent = `${currencySymbol}${tps.toFixed(2)}`;
        if (tpsLabel) {
            const tpsName = settings?.taxes?.tps?.name || 'TPS';
            tpsLabel.textContent = `${tpsName} (${(tpsRate * 100).toFixed(2)}%)`;
        }
    } else if (tpsRow) {
        tpsRow.style.display = 'none';
    }
    
    if (tvqRow && tvqRate > 0) {
        tvqRow.style.display = 'flex';
        if (tvqEl) tvqEl.textContent = `${currencySymbol}${tvq.toFixed(2)}`;
        if (tvqLabel) {
            const tvqName = settings?.taxes?.tvq?.name || 'TVQ';
            tvqLabel.textContent = `${tvqName} (${(tvqRate * 100).toFixed(3)}%)`;
        }
    } else if (tvqRow) {
        tvqRow.style.display = 'none';
    }
}

function updateForceSalePaymentMethods() {
    ['cash', 'card', 'debit', 'mobile'].forEach(method => {
        const btn = document.getElementById(`forceSaleMethod${method.charAt(0).toUpperCase() + method.slice(1)}`);
        if (btn) {
            if (btn.dataset.method === forceSaleSelectedPaymentMethod) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
}

function updateForceSaleConfirmButton() {
    const btn = document.getElementById('confirmForceSaleBtn');
    if (btn) {
        btn.disabled = forceSaleCart.length === 0;
    }
}

async function confirmForceSale() {
    if (forceSaleCart.length === 0) {
        showForceSaleMessage('Le panier est vide', 'warning');
        return;
    }
    
    // Vérifier le stock
    const stockIssues = [];
    const itemsToUpdate = [];
    
    for (const item of forceSaleCart) {
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
        showForceSaleMessage(`Stock insuffisant pour: ${stockIssues.join(', ')}`, 'error');
        // Recharger les produits
        forceSaleProducts = await getAllProducts();
        forceSaleFilteredProducts = forceSaleProducts.filter(p => (p.stock || 0) > 0);
        displayForceSaleProducts(forceSaleFilteredProducts);
        return;
    }
    
    // Calculer les totaux
    const subtotal = forceSaleCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tpsRate = settings?.taxes?.tps?.enabled ? (settings.taxes.tps.rate || 0) : 0;
    const tvqRate = settings?.taxes?.tvq?.enabled ? (settings.taxes.tvq.rate || 0) : 0;
    const tps = subtotal * tpsRate;
    const tvq = subtotal * tvqRate;
    const total = subtotal + tps + tvq;
    
    const user = getCurrentUser();
    
    // Créer la vente
    const saleData = {
        userId: user.uid,
        userName: user.name || user.email,
        items: forceSaleCart.map(item => ({
            productId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        })),
        subtotal: subtotal,
        tps: tps,
        tvq: tvq,
        total: total,
        paymentMethod: forceSaleSelectedPaymentMethod,
        currencySymbol: settings?.currencySymbol || '$',
        currency: settings?.currency || 'CAD'
    };
    
    try {
        // Enregistrer la vente
        await createSale(saleData);
        
        // Mettre à jour les stocks
        for (const { product, newStock } of itemsToUpdate) {
            await updateProduct(product.id, { stock: newStock });
        }
        
        // Recharger les données du dashboard
        await loadDashboardData();
        
        // Fermer le modal
        const modal = document.getElementById('forceSaleModal');
        if (modal) {
            modal.classList.remove('show');
        }
        
        resetForceSale();
        
        // Afficher un message de succès
        showForceSaleMessage('Vente créée avec succès!', 'success');
        
        // Recharger les produits pour le modal
        forceSaleProducts = await getAllProducts();
        forceSaleFilteredProducts = forceSaleProducts.filter(p => (p.stock || 0) > 0);
        
    } catch (error) {
        console.error('Erreur lors de la création de la vente:', error);
        showForceSaleMessage('Erreur lors de la création de la vente: ' + (error.message || 'Une erreur est survenue'), 'error');
    }
}

function showForceSaleMessage(message, type = 'success') {
    // Créer un message temporaire
    const messageEl = document.createElement('div');
    messageEl.className = `alert alert-${type}`;
    messageEl.textContent = message;
    messageEl.style.position = 'fixed';
    messageEl.style.top = '20px';
    messageEl.style.right = '20px';
    messageEl.style.zIndex = '10000';
    messageEl.style.minWidth = '300px';
    messageEl.style.padding = '1rem';
    messageEl.style.borderRadius = '8px';
    messageEl.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    
    if (type === 'success') {
        messageEl.style.background = '#10b981';
        messageEl.style.color = 'white';
    } else if (type === 'error') {
        messageEl.style.background = '#ef4444';
        messageEl.style.color = 'white';
    } else if (type === 'warning') {
        messageEl.style.background = '#f59e0b';
        messageEl.style.color = 'white';
    }
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
        messageEl.remove();
    }, 3000);
}

function showForceSaleError(message) {
    const container = document.getElementById('forceSaleProductsList');
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <p class="empty-state-title">Erreur</p>
                <p class="empty-state-message">${message}</p>
            </div>
        `;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

