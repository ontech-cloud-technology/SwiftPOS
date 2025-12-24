// Gestion des rapports et analytics
import { logout, getCurrentUser, isAdmin } from './auth.js';
import { getAllSales, getAllProducts, getAllCategories } from './firestore.js';

let allSales = [];
let allProducts = [];
let allCategories = [];
let revenueChart = null;
let salesChart = null;
let productsChart = null;
let categoriesChart = null;

// Vérifier l'authentification
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
    
    // Charger les données
    await loadData();
    
    // Configurer les filtres
    setupFilters();
    
    // Configurer le logout
    setupLogout();
    
    // Initialiser les graphiques
    initializeCharts();
    
    // Afficher les rapports
    updateReports();
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

async function loadData() {
    try {
        [allSales, allProducts, allCategories] = await Promise.all([
            getAllSales(),
            getAllProducts(),
            getAllCategories()
        ]);
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        showMessage('Erreur lors du chargement des données', 'error');
    }
}

function setupFilters() {
    const applyBtn = document.getElementById('applyFilters');
    const periodType = document.getElementById('periodType');
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    
    // Définir les dates par défaut (30 derniers jours)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    dateFrom.value = thirtyDaysAgo.toISOString().split('T')[0];
    dateTo.value = today.toISOString().split('T')[0];
    
    applyBtn.addEventListener('click', () => {
        updateReports();
    });
    
    periodType.addEventListener('change', () => {
        updateReports();
    });
}

function getFilteredSales() {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    return allSales.filter(sale => {
        const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
        const saleDateStr = saleDate.toISOString().split('T')[0];
        
        if (dateFrom && saleDateStr < dateFrom) return false;
        if (dateTo && saleDateStr > dateTo) return false;
        
        return true;
    });
}

function updateReports() {
    const filteredSales = getFilteredSales();
    const periodType = document.getElementById('periodType').value;
    
    // Mettre à jour les statistiques
    updateStats(filteredSales);
    
    // Mettre à jour les graphiques
    updateRevenueChart(filteredSales, periodType);
    updateSalesChart(filteredSales, periodType);
    updateProductsChart(filteredSales);
    updateCategoriesChart(filteredSales);
}

function updateStats(sales) {
    const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
    const totalSales = sales.length;
    const averageCart = totalSales > 0 ? totalRevenue / totalSales : 0;
    const totalDiscounts = sales.reduce((sum, sale) => sum + parseFloat(sale.totalDiscount || 0), 0);
    
    document.getElementById('totalRevenue').textContent = `$${totalRevenue.toFixed(2)}`;
    document.getElementById('totalSales').textContent = totalSales;
    document.getElementById('averageCart').textContent = `$${averageCart.toFixed(2)}`;
    document.getElementById('totalDiscounts').textContent = `$${totalDiscounts.toFixed(2)}`;
}

function groupSalesByPeriod(sales, periodType) {
    const grouped = {};
    
    sales.forEach(sale => {
        const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
        let key;
        
        switch (periodType) {
            case 'day':
                key = saleDate.toISOString().split('T')[0];
                break;
            case 'week':
                const weekStart = new Date(saleDate);
                weekStart.setDate(saleDate.getDate() - saleDate.getDay());
                key = weekStart.toISOString().split('T')[0];
                break;
            case 'month':
                key = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
                break;
            case 'year':
                key = saleDate.getFullYear().toString();
                break;
            default:
                key = saleDate.toISOString().split('T')[0];
        }
        
        if (!grouped[key]) {
            grouped[key] = { revenue: 0, count: 0 };
        }
        
        grouped[key].revenue += parseFloat(sale.total || 0);
        grouped[key].count += 1;
    });
    
    return grouped;
}

function initializeCharts() {
    // Graphique des revenus
    const revenueCtx = document.getElementById('revenueChart').getContext('2d');
    revenueChart = new Chart(revenueCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Revenus ($)',
                data: [],
                borderColor: 'rgb(138, 43, 226)',
                backgroundColor: 'rgba(138, 43, 226, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: 'rgba(255, 255, 255, 0.8)' }
                }
            },
            scales: {
                x: { ticks: { color: 'rgba(255, 255, 255, 0.7)' }, grid: { color: 'rgba(138, 43, 226, 0.1)' } },
                y: { ticks: { color: 'rgba(255, 255, 255, 0.7)' }, grid: { color: 'rgba(138, 43, 226, 0.1)' } }
            }
        }
    });
    
    // Graphique des ventes
    const salesCtx = document.getElementById('salesChart').getContext('2d');
    salesChart = new Chart(salesCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Nombre de ventes',
                data: [],
                backgroundColor: 'rgba(138, 43, 226, 0.6)',
                borderColor: 'rgb(138, 43, 226)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: 'rgba(255, 255, 255, 0.8)' }
                }
            },
            scales: {
                x: { ticks: { color: 'rgba(255, 255, 255, 0.7)' }, grid: { color: 'rgba(138, 43, 226, 0.1)' } },
                y: { ticks: { color: 'rgba(255, 255, 255, 0.7)' }, grid: { color: 'rgba(138, 43, 226, 0.1)' }, beginAtZero: true }
            }
        }
    });
    
    // Graphique des produits
    const productsCtx = document.getElementById('productsChart').getContext('2d');
    productsChart = new Chart(productsCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Quantité vendue',
                data: [],
                backgroundColor: 'rgba(81, 207, 102, 0.6)',
                borderColor: 'rgb(81, 207, 102)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    labels: { color: 'rgba(255, 255, 255, 0.8)' }
                }
            },
            scales: {
                x: { ticks: { color: 'rgba(255, 255, 255, 0.7)' }, grid: { color: 'rgba(138, 43, 226, 0.1)' }, beginAtZero: true },
                y: { ticks: { color: 'rgba(255, 255, 255, 0.7)' }, grid: { color: 'rgba(138, 43, 226, 0.1)' } }
            }
        }
    });
    
    // Graphique des catégories
    const categoriesCtx = document.getElementById('categoriesChart').getContext('2d');
    categoriesChart = new Chart(categoriesCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    'rgba(138, 43, 226, 0.8)',
                    'rgba(81, 207, 102, 0.8)',
                    'rgba(255, 107, 107, 0.8)',
                    'rgba(255, 206, 84, 0.8)',
                    'rgba(84, 206, 255, 0.8)',
                    'rgba(255, 159, 64, 0.8)',
                    'rgba(153, 102, 255, 0.8)',
                    'rgba(255, 99, 132, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: 'rgba(255, 255, 255, 0.8)' }
                }
            }
        }
    });
}

function updateRevenueChart(sales, periodType) {
    const grouped = groupSalesByPeriod(sales, periodType);
    const labels = Object.keys(grouped).sort();
    const data = labels.map(key => grouped[key].revenue);
    
    revenueChart.data.labels = labels;
    revenueChart.data.datasets[0].data = data;
    revenueChart.update();
}

function updateSalesChart(sales, periodType) {
    const grouped = groupSalesByPeriod(sales, periodType);
    const labels = Object.keys(grouped).sort();
    const data = labels.map(key => grouped[key].count);
    
    salesChart.data.labels = labels;
    salesChart.data.datasets[0].data = data;
    salesChart.update();
}

function updateProductsChart(sales) {
    const productSales = {};
    
    sales.forEach(sale => {
        if (sale.items) {
            sale.items.forEach(item => {
                if (!productSales[item.name]) {
                    productSales[item.name] = 0;
                }
                productSales[item.name] += item.quantity || 0;
            });
        }
    });
    
    const sorted = Object.entries(productSales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const labels = sorted.map(([name]) => name);
    const data = sorted.map(([, qty]) => qty);
    
    productsChart.data.labels = labels;
    productsChart.data.datasets[0].data = data;
    productsChart.update();
}

function updateCategoriesChart(sales) {
    const categoryRevenue = {};
    
    sales.forEach(sale => {
        if (sale.items) {
            sale.items.forEach(item => {
                const product = allProducts.find(p => p.id === item.productId);
                if (product && product.categoryId) {
                    const category = allCategories.find(c => c.id === product.categoryId);
                    const categoryName = category ? category.name : 'Sans catégorie';
                    
                    if (!categoryRevenue[categoryName]) {
                        categoryRevenue[categoryName] = 0;
                    }
                    categoryRevenue[categoryName] += parseFloat(item.price || 0) * (item.quantity || 0);
                }
            });
        }
    });
    
    const labels = Object.keys(categoryRevenue);
    const data = Object.values(categoryRevenue);
    
    categoriesChart.data.labels = labels;
    categoriesChart.data.datasets[0].data = data;
    categoriesChart.update();
}

function showMessage(message, type = 'success') {
    const messageEl = document.createElement('div');
    messageEl.className = `alert alert-${type}`;
    messageEl.textContent = message;
    messageEl.style.position = 'fixed';
    messageEl.style.top = '20px';
    messageEl.style.right = '20px';
    messageEl.style.zIndex = '10000';
    messageEl.style.minWidth = '300px';
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
        messageEl.remove();
    }, 3000);
}

