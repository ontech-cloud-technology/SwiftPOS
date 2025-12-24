// Gestion des produits
import { logout, getCurrentUser, isAdmin } from './auth.js';
import { getAllProducts, createProduct, updateProduct, deleteProduct, getAllCategories, getSettings } from './firestore.js';
import { uploadImage, generateFileName } from './storage.js';

let products = [];
let categories = [];
let editingProductId = null;
let settings = null;
let modalImageFile = null;
let filteredProducts = [];
let productsToAdd = []; // Liste des produits à ajouter
let currentSearchTerm = '';
let currentCategoryFilter = '';
let currentStockFilter = '';
// Wizard steps removed - using horizontal layout instead

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
    
    // Charger les catégories puis les produits
    await loadCategories();
    await loadProducts();
    
    // Configurer les modals de recherche et filtre
    setupSearchModal();
    setupFilterModal();
    
    // Configurer le logout
    setupLogout();
    
    // Configurer l'import CSV
    setupCsvImport();
    
    // Configurer le modal d'ajout de produits
    setupProductModal();
    
    // Mettre à jour les statistiques
    updateStats();
});

async function loadSettings() {
    try {
        settings = await getSettings();
    } catch (error) {
        console.error('Erreur lors du chargement des paramètres:', error);
        settings = {
            stockAlert: {
                enabled: true,
                threshold: 10
            }
        };
    }
}

function isLowStock(product) {
    if (!settings?.stockAlert?.enabled) return false;
    const threshold = settings.stockAlert.threshold || 10;
    return product.stock <= threshold;
}

function displayUserInfo(user) {
    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    
    if (nameEl) nameEl.textContent = user.name || user.email;
    if (emailEl) emailEl.textContent = user.email;
}

async function loadCategories() {
    try {
        categories = await getAllCategories();
        populateCategorySelects();
    } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
    }
}

function populateCategorySelects() {
    // Populer le select du modal
    const modalCategorySelect = document.getElementById('productCategory');
    if (modalCategorySelect) {
        modalCategorySelect.innerHTML = '<option value="">Sélectionner une catégorie...</option>';
        
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = `${category.icon || '🏷️'} ${category.name}`;
            modalCategorySelect.appendChild(option);
        });
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

async function loadProducts() {
    try {
        products = await getAllProducts();
        applyFilters(); // Appliquer les filtres actuels
        updateStats();
    } catch (error) {
        console.error('Erreur lors du chargement des produits:', error);
        showToast('Erreur lors du chargement des produits: ' + (error.message || 'Une erreur est survenue'), 'error');
        
        const tbody = document.getElementById('productsTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--color-error);">
                        Erreur lors du chargement des produits. Veuillez rafraîchir la page.
                    </td>
                </tr>
            `;
        }
    }
}

function displayProducts(productsList) {
    const tbody = document.getElementById('productsTableBody');
    
    if (!tbody) {
        console.error('Element productsTableBody not found');
        return;
    }
    
    if (productsList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 4rem 2rem;">
                    <div class="empty-state">
                        <div class="empty-state-icon">📦</div>
                        <div class="empty-state-text">Aucun produit trouvé</div>
                        <div class="empty-state-subtext">Commencez par ajouter votre premier produit</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = productsList.map(product => {
        const lowStock = isLowStock(product);
        const price = parseFloat(product.price || 0);
        
        let categoryName = 'Sans catégorie';
        let categoryIcon = '🏷️';
        if (product.categoryId) {
            const cat = categories.find(c => c.id === product.categoryId);
            if (cat) {
                categoryName = cat.name;
                categoryIcon = cat.icon || '🏷️';
            }
        } else if (product.category) {
            categoryName = product.category;
        }
        
        return `
            <tr>
                <td class="product-image-cell">
                    ${product.imageUrl ? 
                        `<img src="${product.imageUrl}" alt="${product.name}" class="product-image">` : 
                        '<div class="product-image-placeholder">📦</div>'
                    }
                </td>
                <td style="font-weight: 600; color: var(--color-text-primary);">${product.name}</td>
                <td class="price-cell">$${price.toFixed(2)}</td>
                <td>
                    <div class="category-cell">
                        <span class="category-icon">${categoryIcon}</span>
                        <span>${categoryName}</span>
                    </div>
                </td>
                <td>
                    <span class="stock-badge ${lowStock ? 'low' : 'normal'}">
                        ${product.stock || 0}${lowStock ? ' ⚠️' : ''}
                    </span>
                </td>
                <td style="text-align: right;">
                    <div class="table-actions">
                        <button class="btn btn-secondary btn-icon" onclick="editProduct('${product.id}')">
                            ✏️ Modifier
                        </button>
                        <button class="btn btn-danger btn-icon" onclick="deleteProductConfirm('${product.id}')">
                            🗑️ Supprimer
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function updateStats() {
    const totalProducts = products.length;
    const lowStockCount = products.filter(p => isLowStock(p)).length;
    const totalValue = products.reduce((sum, p) => sum + (parseFloat(p.price || 0) * (p.stock || 0)), 0);
    
    const totalProductsStat = document.getElementById('totalProductsStat');
    const lowStockStat = document.getElementById('lowStockStat');
    const totalValueStat = document.getElementById('totalValueStat');
    
    if (totalProductsStat) totalProductsStat.textContent = totalProducts;
    if (lowStockStat) lowStockStat.textContent = lowStockCount;
    if (totalValueStat) totalValueStat.textContent = `$${totalValue.toFixed(2)}`;
}

function applyFilters() {
    filteredProducts = products.filter(product => {
        // Recherche par nom ou catégorie
        const nameMatch = !currentSearchTerm || (product.name && product.name.toLowerCase().includes(currentSearchTerm));
        let categoryMatch = true;
        
        if (currentCategoryFilter) {
            categoryMatch = product.categoryId === currentCategoryFilter;
        }
        
        // Recherche dans les noms de catégories
        let categoryNameMatch = false;
        if (product.categoryId && currentSearchTerm) {
            const category = categories.find(c => c.id === product.categoryId);
            if (category && category.name.toLowerCase().includes(currentSearchTerm)) {
                categoryNameMatch = true;
            }
        }
        
        // Filtre de stock
        let stockMatch = true;
        if (currentStockFilter === 'low') {
            stockMatch = isLowStock(product);
        } else if (currentStockFilter === 'normal') {
            stockMatch = !isLowStock(product);
        }
        
        return (nameMatch || categoryNameMatch) && categoryMatch && stockMatch;
    });
    
    displayProducts(filteredProducts);
}

function setupSearchModal() {
    const searchBtn = document.getElementById('searchBtn');
    const searchModal = document.getElementById('searchModal');
    const closeBtn = document.getElementById('closeSearchModalBtn');
    const cancelBtn = document.getElementById('cancelSearchBtn');
    const applyBtn = document.getElementById('applySearchBtn');
    const searchInput = document.getElementById('searchInputModal');
    
    const openModal = () => {
        if (searchInput) {
            searchInput.value = currentSearchTerm;
        }
        if (searchModal) {
            searchModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };

    const closeModal = () => {
        if (searchModal) {
            searchModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    };
    
    const applySearch = () => {
        if (searchInput) {
            currentSearchTerm = searchInput.value.toLowerCase();
    }
        applyFilters();
        closeModal();
    };
    
    if (searchBtn) searchBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (applyBtn) applyBtn.addEventListener('click', applySearch);
    
    if (searchModal) {
        searchModal.addEventListener('click', (e) => {
            if (e.target === searchModal) closeModal();
        });
    }
    
    // Entrée pour chercher
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                applySearch();
            }
        });
    }
}

function setupFilterModal() {
    const filterBtn = document.getElementById('filterBtn');
    const filterModal = document.getElementById('filterModal');
    const closeBtn = document.getElementById('closeFilterModalBtn');
    const resetBtn = document.getElementById('resetFilterBtn');
    const applyBtn = document.getElementById('applyFilterBtn');
    const categoryFilter = document.getElementById('categoryFilterModal');
    const stockFilter = document.getElementById('stockFilterModal');
    
    // Populer le filtre de catégorie
    if (categoryFilter) {
        categoryFilter.innerHTML = '<option value="">Toutes les catégories</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = `${category.icon || '🏷️'} ${category.name}`;
            categoryFilter.appendChild(option);
        });
    }
    
    const openModal = () => {
        if (categoryFilter) {
            categoryFilter.value = currentCategoryFilter;
        }
        if (stockFilter) {
            stockFilter.value = currentStockFilter;
        }
        if (filterModal) {
            filterModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };
    
    const closeModal = () => {
        if (filterModal) {
            filterModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    };
    
    const resetFilters = () => {
        currentCategoryFilter = '';
        currentStockFilter = '';
        if (categoryFilter) categoryFilter.value = '';
        if (stockFilter) stockFilter.value = '';
        applyFilters();
        closeModal();
    };
    
    const applyFilter = () => {
        if (categoryFilter) {
            currentCategoryFilter = categoryFilter.value;
        }
        if (stockFilter) {
            currentStockFilter = stockFilter.value;
        }
        applyFilters();
        closeModal();
    };
    
    if (filterBtn) filterBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
    if (applyBtn) applyBtn.addEventListener('click', applyFilter);
    
    if (filterModal) {
        filterModal.addEventListener('click', (e) => {
            if (e.target === filterModal) closeModal();
        });
    }
}

function setupProductModal() {
    const modal = document.getElementById('productModal');
    const addBtn = document.getElementById('addProductBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const form = document.getElementById('productForm');
    const imageInput = document.getElementById('productImage');
    const imageUploadArea = document.getElementById('imageUploadArea');
    const imagePreview = document.getElementById('imagePreview');
    const imageUploadText = document.getElementById('imageUploadText');
    const removeImageBtn = document.getElementById('removeImageBtn');
    const saveProductBtn = document.getElementById('saveProductBtn');
    
    // Debug: vérifier que les éléments sont trouvés
    if (!imageInput || !imageUploadArea) {
        console.warn('Éléments d\'upload d\'image non trouvés. Vérifiez que le modal est dans le DOM.');
    }
    
    const resetForm = () => {
        if (form) form.reset();
        modalImageFile = null;
        
        if (imagePreview) {
            imagePreview.classList.remove('show');
            imagePreview.src = '';
        }
        
        if (imageUploadText) {
            imageUploadText.style.display = 'flex';
        }
        
        if (imageUploadArea) {
            imageUploadArea.classList.remove('has-image');
        }
        
        if (removeImageBtn) {
            removeImageBtn.style.display = 'none';
        }
    };
    
    const openModal = (product = null) => {
        editingProductId = product ? product.id : null;
        
        const modalTitle = document.getElementById('modalTitle');
        const modalSubtitle = document.getElementById('modalSubtitle');
        
        if (modalTitle) {
            modalTitle.textContent = product ? 'Modifier le produit' : 'Ajouter un produit';
        }
        if (modalSubtitle) {
            modalSubtitle.textContent = product ? 'Modifiez les informations étape par étape' : 'Remplissez les informations étape par étape';
        }
        
        resetForm();
        
        // Remplir le formulaire si on édite
        if (product) {
            const nameInput = document.getElementById('productName');
            const priceInput = document.getElementById('productPrice');
            const stockInput = document.getElementById('productStock');
            const categorySelect = document.getElementById('productCategory');
            
            if (nameInput) nameInput.value = product.name || '';
            if (priceInput) priceInput.value = product.price || '';
            if (stockInput) stockInput.value = product.stock || 0;
            if (categorySelect) categorySelect.value = product.categoryId || '';
            
            if (product.imageUrl && imagePreview) {
                imagePreview.src = product.imageUrl;
                imagePreview.classList.add('show');
                if (imageUploadText) imageUploadText.style.display = 'none';
                if (imageUploadArea) imageUploadArea.classList.add('has-image');
                if (removeImageBtn) removeImageBtn.style.display = 'block';
            }
        }
        
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };
    
    const closeModal = () => {
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
        editingProductId = null;
        modalImageFile = null;
        resetForm();
    };
    
    const validateForm = () => {
        const nameInput = document.getElementById('productName');
        const priceInput = document.getElementById('productPrice');
        const stockInput = document.getElementById('productStock');
        const categorySelect = document.getElementById('productCategory');
        const formMessage = document.getElementById('formMessage');
        
        if (!nameInput?.value.trim()) {
            showFormMessage('Veuillez entrer un nom de produit', 'error', formMessage);
            return false;
        }
        
        if (!priceInput?.value || parseFloat(priceInput.value) <= 0) {
            showFormMessage('Veuillez entrer un prix valide', 'error', formMessage);
            return false;
        }
        
        if (!stockInput?.value || parseInt(stockInput.value) < 0) {
            showFormMessage('Veuillez entrer un stock valide', 'error', formMessage);
            return false;
        }
        
        if (!categorySelect?.value) {
            showFormMessage('Veuillez sélectionner une catégorie', 'error', formMessage);
            return false;
        }
        
        return true;
    };
    
    if (addBtn) {
        addBtn.addEventListener('click', () => openModal());
    }
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    // Fermer avec Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
            closeModal();
        }
    });
    
    // Fermer en cliquant sur l'overlay
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }
    
    // Gestion de l'upload d'image
    if (imageInput && imageUploadArea) {
        imageUploadArea.addEventListener('click', (e) => {
            // Ne pas déclencher si on clique sur le bouton supprimer
            if (e.target === removeImageBtn || e.target.closest('.remove-image-btn-horizontal')) {
                return;
            }
            // Ne pas déclencher si on clique sur l'image preview
            if (e.target === imagePreview || e.target.closest('.image-preview-horizontal')) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            imageInput.click();
        });
        
        const handleImageSelect = (file) => {
            if (file) {
                modalImageFile = file;
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (imagePreview) {
                        imagePreview.src = e.target.result;
                        imagePreview.classList.add('show');
                    }
                    if (imageUploadText) {
                        imageUploadText.style.display = 'none';
                    }
                    if (imageUploadArea) {
                        imageUploadArea.classList.add('has-image');
                    }
                    if (removeImageBtn) {
                        removeImageBtn.style.display = 'block';
                    }
                    // Clear any form messages when image is added
                    const formMessage = document.getElementById('formMessage');
                    if (formMessage) formMessage.innerHTML = '';
                };
                reader.readAsDataURL(file);
            }
        };
        
        imageInput.addEventListener('change', (e) => {
            handleImageSelect(e.target.files[0]);
        });
        
        // Drag and drop
        imageUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            imageUploadArea.style.borderColor = 'var(--color-primary)';
        });
        
        imageUploadArea.addEventListener('dragleave', () => {
            imageUploadArea.style.borderColor = 'var(--color-gray-300)';
        });
        
        imageUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            imageUploadArea.style.borderColor = 'var(--color-gray-300)';
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                handleImageSelect(file);
            }
        });
        
        if (removeImageBtn) {
            removeImageBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Empêcher le clic de remonter à la zone d'upload
                modalImageFile = null;
                if (imageInput) imageInput.value = '';
                if (imagePreview) {
                    imagePreview.classList.remove('show');
                    imagePreview.src = '';
                }
                if (imageUploadText) {
                    imageUploadText.style.display = 'flex';
                }
                if (imageUploadArea) {
                    imageUploadArea.classList.remove('has-image');
                }
                if (removeImageBtn) {
                    removeImageBtn.style.display = 'none';
                }
            });
        }
    } else {
        console.error('Image upload elements not found:', { imageInput, imageUploadArea });
    }
    
    // Enregistrer le produit
    const saveProduct = async () => {
        if (!validateForm()) {
            return;
        }
        
        const nameInput = document.getElementById('productName');
        const priceInput = document.getElementById('productPrice');
        const stockInput = document.getElementById('productStock');
        const categorySelect = document.getElementById('productCategory');
        const formMessage = document.getElementById('formMessage');
        
        const name = nameInput?.value.trim();
        const price = parseFloat(priceInput?.value || 0);
        const stock = parseInt(stockInput?.value || 0);
        const categoryId = categorySelect?.value;
        
        if (saveProductBtn) {
            saveProductBtn.disabled = true;
            saveProductBtn.innerHTML = '<span>⏳</span> Enregistrement...';
        }
        
        try {
            const selectedCategory = categories.find(c => c.id === categoryId);
            
                const formData = {
                name,
                price,
                stock,
                categoryId,
                category: selectedCategory ? selectedCategory.name : ''
                };
                
                // Upload de l'image si présente
            if (modalImageFile) {
                const fileName = generateFileName(modalImageFile.name);
                    const imagePath = `products/${Date.now()}_${fileName}`;
                formData.imageUrl = await uploadImage(modalImageFile, imagePath);
            } else if (editingProductId) {
                // Conserver l'image existante si on édite et qu'on ne change pas l'image
                const existingProduct = products.find(p => p.id === editingProductId);
                if (existingProduct && existingProduct.imageUrl) {
                    formData.imageUrl = existingProduct.imageUrl;
                }
            }
            
            if (editingProductId) {
                await updateProduct(editingProductId, formData);
                showToast('Produit mis à jour avec succès', 'success');
            } else {
                await createProduct(formData);
                showToast('Produit ajouté avec succès', 'success');
            }
            
            await loadProducts();
            closeModal();
            } catch (error) {
            console.error('Erreur:', error);
            showFormMessage('Erreur: ' + (error.message || 'Une erreur est survenue'), 'error', formMessage);
        } finally {
            if (saveProductBtn) {
                saveProductBtn.disabled = false;
                saveProductBtn.innerHTML = '<span>💾</span> Enregistrer le produit';
            }
        }
    };
    
    if (saveProductBtn) {
        saveProductBtn.addEventListener('click', saveProduct);
    }
}

window.removeProductFromList = function(index) {
    productsToAdd.splice(index, 1);
    const productsListContainer = document.getElementById('productsListContainer');
    const saveAllBtn = document.getElementById('saveAllBtn');
    
    if (productsToAdd.length === 0) {
        if (productsListContainer) productsListContainer.style.display = 'none';
        if (saveAllBtn) saveAllBtn.style.display = 'none';
    } else {
        const addedProductsList = document.getElementById('addedProductsList');
        if (addedProductsList) {
            const items = addedProductsList.querySelectorAll('.added-product-item');
            if (items[index]) {
                items[index].remove();
            }
        }
    }
};

function showFormMessage(message, type, container) {
    if (!container) return;
    
    container.innerHTML = `
        <div style="padding: 0.75rem 1rem; border-radius: var(--border-radius-md); background: ${type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'}; color: ${type === 'error' ? '#dc2626' : '#059669'}; border: 1px solid ${type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'};">
            ${message}
        </div>
    `;
    
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

window.editProduct = async function(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    // Ouvrir le modal avec le produit
    const modal = document.getElementById('productModal');
    if (!modal) return;
    
    const modalTitle = document.getElementById('modalTitle');
    const modalSubtitle = document.getElementById('modalSubtitle');
    
    if (modalTitle) {
        modalTitle.textContent = 'Modifier le produit';
    }
    if (modalSubtitle) {
        modalSubtitle.textContent = 'Modifiez les informations étape par étape';
    }
    
    editingProductId = product.id;
    
    const form = document.getElementById('productForm');
    if (form) form.reset();
    modalImageFile = null;
    
    const nameInput = document.getElementById('productName');
    const priceInput = document.getElementById('productPrice');
    const stockInput = document.getElementById('productStock');
    const categorySelect = document.getElementById('productCategory');
    const imagePreview = document.getElementById('imagePreview');
    const imageUploadText = document.getElementById('imageUploadText');
    const imageUploadArea = document.getElementById('imageUploadArea');
    const removeImageBtn = document.getElementById('removeImageBtn');
    
    if (nameInput) nameInput.value = product.name || '';
    if (priceInput) priceInput.value = product.price || '';
    if (stockInput) stockInput.value = product.stock || 0;
    if (categorySelect) categorySelect.value = product.categoryId || '';
    
    if (product.imageUrl && imagePreview) {
        imagePreview.src = product.imageUrl;
        imagePreview.classList.add('show');
        if (imageUploadText) imageUploadText.style.display = 'none';
        if (imageUploadArea) imageUploadArea.classList.add('has-image');
        if (removeImageBtn) removeImageBtn.style.display = 'block';
    } else {
        if (imagePreview) imagePreview.classList.remove('show');
        if (imageUploadText) imageUploadText.style.display = 'flex';
        if (imageUploadArea) imageUploadArea.classList.remove('has-image');
        if (removeImageBtn) removeImageBtn.style.display = 'none';
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.deleteProductConfirm = async function(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le produit "${product.name}" ?\n\nCette action est irréversible.`)) {
        return;
    }
    
    try {
        await deleteProduct(productId);
        showToast('Produit supprimé avec succès', 'success');
        await loadProducts();
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Erreur lors de la suppression: ' + (error.message || 'Une erreur est survenue'), 'error');
    }
};

function setupCsvImport() {
    const importBtn = document.getElementById('importCsvBtn');
    const fileInput = document.getElementById('csvFileInput');
    
    if (!importBtn || !fileInput) return;
    
    importBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            await importProductsFromCsv(text);
            fileInput.value = '';
        } catch (error) {
            console.error('Erreur lors de l\'import CSV:', error);
            showToast('Erreur lors de l\'import CSV: ' + (error.message || 'Une erreur est survenue'), 'error');
        }
    });
}

async function importProductsFromCsv(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        showToast('Le fichier CSV est vide ou invalide', 'error');
        return;
    }
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const requiredColumns = ['name', 'price'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
        showToast(`Colonnes manquantes: ${missingColumns.join(', ')}. Colonnes requises: name, price`, 'error');
        return;
    }
    
    const nameIndex = headers.indexOf('name');
    const priceIndex = headers.indexOf('price');
    const categoryIndex = headers.includes('category') ? headers.indexOf('category') : -1;
    const stockIndex = headers.includes('stock') ? headers.indexOf('stock') : -1;
    
    const productsToImport = [];
    const errors = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = parseCsvLine(line);
        
        if (values.length < 2) {
            errors.push(`Ligne ${i + 1}: Format invalide`);
            continue;
        }
        
        const name = values[nameIndex]?.trim();
        const price = parseFloat(values[priceIndex]?.trim());
        
        if (!name || !name.length) {
            errors.push(`Ligne ${i + 1}: Nom manquant`);
            continue;
        }
        
        if (isNaN(price) || price < 0) {
            errors.push(`Ligne ${i + 1}: Prix invalide`);
            continue;
        }
        
        let categoryId = '';
        if (categoryIndex >= 0 && values[categoryIndex]) {
            const categoryName = values[categoryIndex].trim();
            const category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
            if (category) {
                categoryId = category.id;
            } else if (categoryName) {
                errors.push(`Ligne ${i + 1}: Catégorie "${categoryName}" non trouvée`);
            }
        }
        
        if (!categoryId && categories.length > 0) {
            categoryId = categories[0].id;
        }
        
        if (!categoryId) {
            errors.push(`Ligne ${i + 1}: Aucune catégorie disponible. Veuillez créer une catégorie d'abord.`);
            continue;
        }
        
        const selectedCategory = categories.find(c => c.id === categoryId);
        
        productsToImport.push({
            name: name,
            price: price,
            categoryId: categoryId,
            category: selectedCategory ? selectedCategory.name : '',
            stock: stockIndex >= 0 && values[stockIndex] ? parseInt(values[stockIndex].trim()) || 0 : 0
        });
    }
    
    if (productsToImport.length === 0) {
        showToast('Aucun produit valide à importer', 'error');
        return;
    }
    
    const errorMsg = errors.length > 0 ? `\n\n${errors.length} erreur(s) détectée(s).` : '';
    if (!confirm(`Importer ${productsToImport.length} produit(s) ?${errorMsg}`)) {
        return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (const productData of productsToImport) {
        try {
            await createProduct(productData);
            successCount++;
        } catch (error) {
            console.error('Erreur lors de la création du produit:', error);
            failCount++;
        }
    }
    
    await loadProducts();
    
    if (failCount === 0) {
        showToast(`${successCount} produit(s) importé(s) avec succès`, 'success');
    } else {
        showToast(`${successCount} produit(s) importé(s), ${failCount} échec(s)`, 'warning');
    }
    
    if (errors.length > 0) {
        console.warn('Erreurs d\'import:', errors);
    }
}

function parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    values.push(current.trim());
    return values;
}

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
