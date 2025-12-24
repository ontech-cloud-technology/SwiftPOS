// Gestion des promotions
import { logout, getCurrentUser, isAdmin } from './auth.js';
import { getAllPromotions, createPromotion, updatePromotion, deletePromotion, getAllProducts, getAllCategories, getSettings } from './firestore.js';

let promotions = [];
let products = [];
let categories = [];
let settings = null;
let editingPromotionId = null;
let currentStep = 1;
const totalSteps = 4;

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
    
    // Charger les produits et catégories puis les promotions
    await Promise.all([loadProducts(), loadCategories()]);
    // Attendre un peu pour s'assurer que le DOM est prêt
    await new Promise(resolve => setTimeout(resolve, 100));
    await loadPromotions();
    
    // Configurer le modal
    setupModal();
    
    // Configurer le formulaire
    setupForm();
    
    // Configurer la recherche
    setupSearch();
    
    // Configurer le logout
    setupLogout();
});

async function loadSettings() {
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

function displayUserInfo(user) {
    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    
    if (nameEl) nameEl.textContent = user.name || user.email;
    if (emailEl) emailEl.textContent = user.email;
}

async function loadProducts() {
    try {
        products = await getAllProducts();
        console.log('Produits chargés:', products.length);
        populateProductSelect();
    } catch (error) {
        console.error('Erreur lors du chargement des produits:', error);
        showMessage('Erreur lors du chargement des produits: ' + (error.message || 'Une erreur est survenue'), 'error');
    }
}

async function loadCategories() {
    try {
        categories = await getAllCategories();
        console.log('Catégories chargées:', categories.length);
        populateCategorySelect();
    } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
        showMessage('Erreur lors du chargement des catégories: ' + (error.message || 'Une erreur est survenue'), 'error');
    }
}

function populateProductSelect() {
    const productSelect = document.getElementById('productId');
    if (!productSelect) {
        console.error('Le select productId n\'a pas été trouvé dans le DOM');
        return;
    }
    
    // Vider le select sauf l'option par défaut
    productSelect.innerHTML = '<option value="">Sélectionner un produit...</option>';
    
    if (!products || products.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Aucun produit disponible';
        option.disabled = true;
        productSelect.appendChild(option);
        console.warn('Aucun produit disponible');
        return;
    }
    
    // Ajouter les produits
    products.forEach(product => {
        if (product && product.id && product.name) {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.name} - $${parseFloat(product.price || 0).toFixed(2)}`;
            option.dataset.price = product.price || 0;
            productSelect.appendChild(option);
        }
    });
    
    console.log(`${products.length} produit(s) ajouté(s) au select`);
}

function populateCategorySelect() {
    const categorySelect = document.getElementById('categoryId');
    if (!categorySelect) {
        console.error('Le select categoryId n\'a pas été trouvé dans le DOM');
        return;
    }
    
    // Vider le select sauf l'option par défaut
    categorySelect.innerHTML = '<option value="">Sélectionner une catégorie...</option>';
    
    if (!categories || categories.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Aucune catégorie disponible';
        option.disabled = true;
        categorySelect.appendChild(option);
        console.warn('Aucune catégorie disponible');
        return;
    }
    
    // Ajouter les catégories
    categories.forEach(category => {
        if (category && category.id && category.name) {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = `${category.icon || '🏷️'} ${category.name}`;
            categorySelect.appendChild(option);
        }
    });
    
    console.log(`${categories.length} catégorie(s) ajoutée(s) au select`);
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

async function loadPromotions() {
    try {
        promotions = await getAllPromotions();
        console.log('Promotions chargées:', promotions.length);
        // S'assurer que les produits et catégories sont chargés avant d'afficher les promotions
        if (products.length === 0) {
            await loadProducts();
        }
        if (categories.length === 0) {
            await loadCategories();
        }
        displayPromotions(promotions);
    } catch (error) {
        console.error('Erreur lors du chargement des promotions:', error);
        showMessage('Erreur lors du chargement des promotions', 'error');
    }
}

function getPromotionStatus(promotion) {
    const now = new Date();
    const startDate = promotion.startDate ? new Date(promotion.startDate) : null;
    const endDate = promotion.endDate ? new Date(promotion.endDate) : null;
    
    if (!startDate && !endDate) return 'active';
    if (startDate && now < startDate) return 'upcoming';
    if (endDate && now > endDate) return 'expired';
    if ((!startDate || now >= startDate) && (!endDate || now <= endDate)) return 'active';
    return 'inactive';
}

function calculatePromotionPrice(product, promotion) {
    if (!product || !promotion) return 0;
    
    const originalPrice = parseFloat(product.price || 0);
    let discountedPrice = originalPrice;
    
    if (promotion.type === 'percentage') {
        discountedPrice = originalPrice * (1 - promotion.value / 100);
    } else {
        discountedPrice = Math.max(0, originalPrice - promotion.value);
    }
    
    // Ajouter les taxes si demandé
    if (promotion.includeTaxes && settings) {
        const tps = settings.taxes?.tps?.enabled ? discountedPrice * (settings.taxes.tps.rate || 0) : 0;
        const tvq = settings.taxes?.tvq?.enabled ? discountedPrice * (settings.taxes.tvq.rate || 0) : 0;
        discountedPrice = discountedPrice + tps + tvq;
    }
    
    return discountedPrice;
}

function displayPromotions(promotionsList) {
    const tbody = document.getElementById('promotionsTableBody');
    
    if (!tbody) {
        console.error('Le tbody promotionsTableBody n\'a pas été trouvé dans le DOM');
        return;
    }
    
    if (promotionsList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.5);">
                    Aucune promotion trouvée
                </td>
            </tr>
        `;
        return;
    }
    
    // S'assurer que les produits et catégories sont chargés
    if ((!products || products.length === 0) || (!categories || categories.length === 0)) {
        console.warn('Données manquantes, rechargement...');
        Promise.all([loadProducts(), loadCategories()]).then(() => {
            displayPromotions(promotionsList);
        });
        return;
    }
    
    // Afficher les promotions
    
    tbody.innerHTML = promotionsList.map(promotion => {
        const promotionType = promotion.categoryId ? 'category' : 'product';
        const product = promotion.productId ? products.find(p => p.id === promotion.productId) : null;
        const category = promotion.categoryId ? categories.find(c => c.id === promotion.categoryId) : null;
        
        const status = getPromotionStatus(promotion);
        const statusLabels = {
            active: 'Active',
            inactive: 'Inactive',
            upcoming: 'À venir',
            expired: 'Expirée'
        };
        
        let targetName = '';
        let typeLabel = '';
        let finalPrice = '';
        
        if (promotionType === 'category') {
            typeLabel = '<span style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; padding: 4px 8px; border-radius: 6px; font-size: 0.85em;">🏷️ Catégorie</span>';
            targetName = category ? `${category.icon || '🏷️'} ${category.name || 'Catégorie sans nom'}` : 'Catégorie supprimée';
            finalPrice = 'Tous les produits';
        } else {
            typeLabel = '<span style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 4px 8px; border-radius: 6px; font-size: 0.85em;">📦 Produit</span>';
            targetName = product ? (product.name || 'Produit sans nom') : 'Produit supprimé';
            const originalPrice = product ? parseFloat(product.price || 0) : 0;
            const calculatedPrice = calculatePromotionPrice(product, promotion);
            finalPrice = `$${calculatedPrice.toFixed(2)}${promotion.includeTaxes ? ' (avec taxes)' : ''}`;
        }
        
        const discountText = promotion.type === 'percentage' 
            ? `-${promotion.value}%`
            : `-$${promotion.value.toFixed(2)}`;
        
        const startDate = promotion.startDate ? new Date(promotion.startDate) : null;
        const endDate = promotion.endDate ? new Date(promotion.endDate) : null;
        const periodText = startDate && endDate
            ? `${startDate.toLocaleDateString('fr-CA')} - ${endDate.toLocaleDateString('fr-CA')}`
            : startDate
            ? `À partir du ${startDate.toLocaleDateString('fr-CA')}`
            : endDate
            ? `Jusqu'au ${endDate.toLocaleDateString('fr-CA')}`
            : 'Sans limite';
        
        return `
            <tr>
                <td>${typeLabel}</td>
                <td>${targetName}</td>
                <td>${promotion.name || 'Sans nom'}</td>
                <td>${discountText}</td>
                <td>${finalPrice}</td>
                <td>${periodText}</td>
                <td><span class="status-badge ${status}">${statusLabels[status]}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-secondary btn-icon" onclick="editPromotion('${promotion.id}')">
                            ✏️ Modifier
                        </button>
                        ${promotionType === 'product' ? `<button class="btn btn-primary btn-icon" onclick="printPromotionPDF('${promotion.id}')">
                            🖨️ PDF
                        </button>` : ''}
                        <button class="btn btn-danger btn-icon" onclick="deletePromotionConfirm('${promotion.id}')">
                            🗑️ Supprimer
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    console.log(`${promotionsList.length} promotion(s) affichée(s)`);
}

function setupModal() {
    const modal = document.getElementById('promotionModal');
    const openBtn = document.getElementById('openModalBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    
    // Animation du bouton
    if (openBtn) {
        openBtn.addEventListener('click', (e) => {
            // Animation du bouton
            openBtn.classList.add('animate');
            setTimeout(() => {
                openBtn.classList.remove('animate');
            }, 600);
            
            // Empêcher le scroll du body
            document.body.classList.add('modal-open');
            
            // Ouvrir le modal avec délai pour l'animation
            setTimeout(() => {
                resetForm();
                goToStep(1);
                modal.classList.add('active');
            }, 300);
        });
    }
    
    // Fermer le modal
    function closeModal() {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
        setTimeout(() => {
            resetForm();
        }, 500);
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    // Gérer le changement de type (produit/catégorie)
    const typeRadios = document.querySelectorAll('input[name="promotionType"]');
    const productFieldGroup = document.getElementById('productFieldGroup');
    const categoryFieldGroup = document.getElementById('categoryFieldGroup');
    const productSelect = document.getElementById('productId');
    const categorySelect = document.getElementById('categoryId');
    const selectionTitle = document.getElementById('selectionTitle');
    
    typeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'product') {
                productFieldGroup.classList.add('active');
                categoryFieldGroup.classList.remove('active');
                productSelect.required = true;
                categorySelect.required = false;
                categorySelect.value = '';
                if (selectionTitle) selectionTitle.textContent = 'Sélectionnez un produit';
            } else {
                productFieldGroup.classList.remove('active');
                categoryFieldGroup.classList.add('active');
                productSelect.required = false;
                categorySelect.required = true;
                productSelect.value = '';
                if (selectionTitle) selectionTitle.textContent = 'Sélectionnez une catégorie';
            }
        });
    });
}

// Gestion des étapes
window.nextStep = function() {
    // Valider l'étape actuelle
    if (currentStep === 1) {
        // Pas de validation nécessaire pour l'étape 1
    } else if (currentStep === 2) {
        const promotionType = document.querySelector('input[name="promotionType"]:checked').value;
        const productId = document.getElementById('productId').value;
        const categoryId = document.getElementById('categoryId').value;
        
        if (promotionType === 'product' && !productId) {
            showMessage('Veuillez sélectionner un produit', 'error');
            return;
        }
        
        if (promotionType === 'category' && !categoryId) {
            showMessage('Veuillez sélectionner une catégorie', 'error');
            return;
        }
    } else if (currentStep === 3) {
        const name = document.getElementById('name').value.trim();
        const discountValue = document.getElementById('discountValue').value;
        const promotionStart = document.getElementById('promotionStart').value;
        const promotionEnd = document.getElementById('promotionEnd').value;
        
        if (!name) {
            showMessage('Veuillez entrer un nom pour la promotion', 'error');
            return;
        }
        
        if (!discountValue || parseFloat(discountValue) <= 0) {
            showMessage('Veuillez entrer une valeur de remise valide', 'error');
            return;
        }
        
        if (promotionStart && promotionEnd && new Date(promotionStart) >= new Date(promotionEnd)) {
            showMessage('La date de fin doit être après la date de début', 'error');
            return;
        }
        
        // Générer le récapitulatif
        generateSummary();
    }
    
    if (currentStep < totalSteps) {
        goToStep(currentStep + 1);
    }
};

window.prevStep = function() {
    if (currentStep > 1) {
        goToStep(currentStep - 1);
    }
};

function goToStep(step) {
    currentStep = step;
    
    // Mettre à jour les étapes visuelles
    for (let i = 1; i <= totalSteps; i++) {
        const stepEl = document.getElementById(`step${i}`);
        const stepContent = document.getElementById(`stepContent${i}`);
        
        if (i < step) {
            stepEl.classList.remove('active');
            stepEl.classList.add('completed');
            if (stepContent) stepContent.classList.remove('active');
        } else if (i === step) {
            stepEl.classList.add('active');
            stepEl.classList.remove('completed');
            if (stepContent) stepContent.classList.add('active');
        } else {
            stepEl.classList.remove('active', 'completed');
            if (stepContent) stepContent.classList.remove('active');
        }
    }
    
    // Mettre à jour la barre de progression
    updateProgress();
}

function updateProgress() {
    const progress = (currentStep / totalSteps) * 100;
    const progressBarFill = document.getElementById('progressBarFill');
    if (progressBarFill) {
        progressBarFill.style.width = `${progress}%`;
    }
}

function generateSummary() {
    const promotionType = document.querySelector('input[name="promotionType"]:checked').value;
    const productId = document.getElementById('productId').value;
    const categoryId = document.getElementById('categoryId').value;
    const name = document.getElementById('name').value.trim();
    const discountType = document.getElementById('discountType').value;
    const discountValue = document.getElementById('discountValue').value;
    const promotionStart = document.getElementById('promotionStart').value;
    const promotionEnd = document.getElementById('promotionEnd').value;
    const includeTaxes = document.getElementById('includeTaxes').checked;
    
    let targetName = '';
    if (promotionType === 'product') {
        const product = products.find(p => p.id === productId);
        targetName = product ? `${product.name} - $${parseFloat(product.price || 0).toFixed(2)}` : 'Produit non trouvé';
    } else {
        const category = categories.find(c => c.id === categoryId);
        targetName = category ? `${category.icon || '🏷️'} ${category.name}` : 'Catégorie non trouvée';
    }
    
    const discountText = discountType === 'percentage' 
        ? `${discountValue}%`
        : `$${parseFloat(discountValue).toFixed(2)}`;
    
    const startDate = promotionStart ? new Date(promotionStart) : null;
    const endDate = promotionEnd ? new Date(promotionEnd) : null;
    const periodText = startDate && endDate
        ? `${startDate.toLocaleDateString('fr-CA')} ${startDate.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleDateString('fr-CA')} ${endDate.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}`
        : startDate
        ? `À partir du ${startDate.toLocaleDateString('fr-CA')} ${startDate.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}`
        : endDate
        ? `Jusqu'au ${endDate.toLocaleDateString('fr-CA')} ${endDate.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}`
        : 'Sans limite';
    
    const summaryContent = document.getElementById('summaryContent');
    if (summaryContent) {
        summaryContent.innerHTML = `
            <div style="display: grid; gap: 20px;">
                <div>
                    <strong style="color: var(--color-text-secondary); font-size: 14px;">Type:</strong>
                    <p style="margin: 5px 0 0 0; font-size: 16px;">${promotionType === 'product' ? '📦 Produit' : '🏷️ Catégorie'}</p>
                </div>
                <div>
                    <strong style="color: var(--color-text-secondary); font-size: 14px;">${promotionType === 'product' ? 'Produit:' : 'Catégorie:'}</strong>
                    <p style="margin: 5px 0 0 0; font-size: 16px;">${targetName}</p>
                </div>
                <div>
                    <strong style="color: var(--color-text-secondary); font-size: 14px;">Nom de la promotion:</strong>
                    <p style="margin: 5px 0 0 0; font-size: 16px;">${name}</p>
                </div>
                <div>
                    <strong style="color: var(--color-text-secondary); font-size: 14px;">Remise:</strong>
                    <p style="margin: 5px 0 0 0; font-size: 16px; color: var(--color-success); font-weight: 600;">${discountText}</p>
                </div>
                <div>
                    <strong style="color: var(--color-text-secondary); font-size: 14px;">Période:</strong>
                    <p style="margin: 5px 0 0 0; font-size: 16px;">${periodText}</p>
                </div>
                <div>
                    <strong style="color: var(--color-text-secondary); font-size: 14px;">Taxes:</strong>
                    <p style="margin: 5px 0 0 0; font-size: 16px;">${includeTaxes ? '✅ Incluses' : '❌ Non incluses'}</p>
                </div>
            </div>
        `;
    }
}

function setupForm() {
    const form = document.getElementById('promotionForm');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const promotionType = document.querySelector('input[name="promotionType"]:checked').value;
        const productId = document.getElementById('productId').value;
        const categoryId = document.getElementById('categoryId').value;
        
        if (promotionType === 'product' && !productId) {
            showMessage('Veuillez sélectionner un produit', 'error');
            return;
        }
        
        if (promotionType === 'category' && !categoryId) {
            showMessage('Veuillez sélectionner une catégorie', 'error');
            return;
        }
        
        const discountValue = parseFloat(document.getElementById('discountValue').value);
        if (!discountValue || discountValue <= 0) {
            showMessage('Veuillez entrer une valeur de remise valide', 'error');
            return;
        }
        
        const promotionStart = document.getElementById('promotionStart').value;
        const promotionEnd = document.getElementById('promotionEnd').value;
        
        if (promotionStart && promotionEnd && new Date(promotionStart) >= new Date(promotionEnd)) {
            showMessage('La date de fin doit être après la date de début', 'error');
            return;
        }
        
        const formData = {
            name: document.getElementById('name').value.trim(),
            type: document.getElementById('discountType').value,
            value: discountValue,
            startDate: promotionStart ? new Date(promotionStart).toISOString() : null,
            endDate: promotionEnd ? new Date(promotionEnd).toISOString() : null,
            includeTaxes: document.getElementById('includeTaxes').checked
        };
        
        // Ajouter productId ou categoryId selon le type
        if (promotionType === 'product') {
            formData.productId = productId;
            formData.categoryId = null;
        } else {
            formData.categoryId = categoryId;
            formData.productId = null;
        }
        
        try {
            // Désactiver le bouton de soumission
            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>⏳ Création en cours...</span>';
            }
            
            if (editingPromotionId) {
                // Mise à jour
                await updatePromotion(editingPromotionId, formData);
                showMessage('Promotion mise à jour avec succès', 'success');
            } else {
                // Création
                await createPromotion(formData);
                showMessage('Promotion créée avec succès', 'success');
            }
            
            // Animation de succès
            goToStep(4);
            updateProgress();
            
            // Fermer le modal après un délai
            setTimeout(async () => {
                const modal = document.getElementById('promotionModal');
                modal.classList.remove('active');
                document.body.classList.remove('modal-open');
                setTimeout(async () => {
                    resetForm();
                    await loadPromotions();
                }, 500);
            }, 1500);
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur: ' + (error.message || 'Une erreur est survenue'), 'error');
            
            // Réactiver le bouton
            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span id="submitText">Créer la promotion</span>';
            }
        }
    });
}

function resetForm() {
    document.getElementById('promotionForm').reset();
    document.getElementById('promotionId').value = '';
    editingPromotionId = null;
    document.getElementById('formTitle').textContent = 'Créer une promotion';
    document.getElementById('submitText').textContent = 'Créer la promotion';
    
    // Réinitialiser le type à "product"
    document.getElementById('typeProduct').checked = true;
    document.getElementById('productFieldGroup').classList.add('active');
    document.getElementById('categoryFieldGroup').classList.remove('active');
    document.getElementById('productId').required = true;
    document.getElementById('categoryId').required = false;
    
    // Réinitialiser les étapes
    currentStep = 1;
    goToStep(1);
}

window.editPromotion = function(promotionId) {
    const promotion = promotions.find(p => p.id === promotionId);
    if (!promotion) return;
    
    editingPromotionId = promotionId;
    document.getElementById('promotionId').value = promotionId;
    document.getElementById('name').value = promotion.name || '';
    document.getElementById('discountType').value = promotion.type || 'percentage';
    document.getElementById('discountValue').value = promotion.value || '';
    document.getElementById('includeTaxes').checked = promotion.includeTaxes || false;
    
    // Déterminer le type de promotion
    const promotionType = promotion.categoryId ? 'category' : 'product';
    if (promotionType === 'category') {
        document.getElementById('typeCategory').checked = true;
        document.getElementById('categoryId').value = promotion.categoryId || '';
        document.getElementById('productId').value = '';
        document.getElementById('productFieldGroup').classList.remove('active');
        document.getElementById('categoryFieldGroup').classList.add('active');
        document.getElementById('productId').required = false;
        document.getElementById('categoryId').required = true;
    } else {
        document.getElementById('typeProduct').checked = true;
        document.getElementById('productId').value = promotion.productId || '';
        document.getElementById('categoryId').value = '';
        document.getElementById('productFieldGroup').classList.add('active');
        document.getElementById('categoryFieldGroup').classList.remove('active');
        document.getElementById('productId').required = true;
        document.getElementById('categoryId').required = false;
    }
    
    if (promotion.startDate) {
        const startDate = new Date(promotion.startDate);
        document.getElementById('promotionStart').value = startDate.toISOString().slice(0, 16);
    }
    if (promotion.endDate) {
        const endDate = new Date(promotion.endDate);
        document.getElementById('promotionEnd').value = endDate.toISOString().slice(0, 16);
    }
    
    document.getElementById('formTitle').textContent = 'Modifier la promotion';
    document.getElementById('submitText').textContent = 'Mettre à jour';
    
    // Ouvrir le modal et aller directement à l'étape 3
    const modal = document.getElementById('promotionModal');
    goToStep(3);
    modal.classList.add('active');
};

window.deletePromotionConfirm = async function(promotionId) {
    const promotion = promotions.find(p => p.id === promotionId);
    if (!promotion) return;
    
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la promotion "${promotion.name}" ?`)) {
        return;
    }
    
    try {
        await deletePromotion(promotionId);
        showMessage('Promotion supprimée avec succès', 'success');
        await loadPromotions();
    } catch (error) {
        console.error('Erreur:', error);
        showMessage('Erreur lors de la suppression: ' + (error.message || 'Une erreur est survenue'), 'error');
    }
};

window.printPromotionPDF = function(promotionId) {
    const promotion = promotions.find(p => p.id === promotionId);
    if (!promotion) {
        showMessage('Promotion non trouvée', 'error');
        return;
    }
    
    const product = products.find(p => p.id === promotion.productId);
    if (!product) {
        showMessage('Produit associé non trouvé', 'error');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Dimensions du coupon
        const pageWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const margin = 15;
        const couponWidth = pageWidth - (margin * 2);
        const couponHeight = 100;
        
        // Couleur principale
        const primaryColor = [138, 43, 226];
        
        // Fond du coupon
        doc.setFillColor(...primaryColor);
        doc.roundedRect(margin, margin, couponWidth, couponHeight, 5, 5, 'F');
        
        // Texte blanc sur fond coloré
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont(undefined, 'bold');
        doc.text('PROMOTION', pageWidth / 2, margin + 15, { align: 'center' });
        
        // Nom de la promotion
        doc.setFontSize(18);
        doc.text(promotion.name || 'Promotion spéciale', pageWidth / 2, margin + 30, { align: 'center' });
        
        // Nom du produit
        doc.setFontSize(14);
        doc.setFont(undefined, 'normal');
        doc.text(product.name, pageWidth / 2, margin + 45, { align: 'center' });
        
        // Prix original
        const originalPrice = parseFloat(product.price || 0);
        doc.setFontSize(12);
        doc.text(`Prix régulier: $${originalPrice.toFixed(2)}`, pageWidth / 2, margin + 55, { align: 'center' });
        
        // Remise
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        const discountText = promotion.type === 'percentage' 
            ? `${promotion.value}% DE RABAIS`
            : `$${promotion.value.toFixed(2)} DE RABAIS`;
        doc.text(discountText, pageWidth / 2, margin + 68, { align: 'center' });
        
        // Prix final
        const finalPrice = calculatePromotionPrice(product, promotion);
        doc.setFontSize(20);
        doc.text(`Prix: $${finalPrice.toFixed(2)}`, pageWidth / 2, margin + 82, { align: 'center' });
        
        if (promotion.includeTaxes) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text('(Taxes incluses)', pageWidth / 2, margin + 90, { align: 'center' });
        }
        
        // Dates
        if (promotion.startDate || promotion.endDate) {
            doc.setFontSize(10);
            const startDate = promotion.startDate ? new Date(promotion.startDate) : null;
            const endDate = promotion.endDate ? new Date(promotion.endDate) : null;
            let dateText = '';
            if (startDate && endDate) {
                dateText = `Valide du ${startDate.toLocaleDateString('fr-CA')} au ${endDate.toLocaleDateString('fr-CA')}`;
            } else if (startDate) {
                dateText = `Valide à partir du ${startDate.toLocaleDateString('fr-CA')}`;
            } else if (endDate) {
                dateText = `Valide jusqu'au ${endDate.toLocaleDateString('fr-CA')}`;
            }
            if (dateText) {
                doc.text(dateText, pageWidth / 2, margin + 98, { align: 'center' });
            }
        }
        
        // Ligne de séparation (pour découper)
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.setLineDashPattern([5, 5], 0);
        doc.line(margin, margin + couponHeight + 5, pageWidth - margin, margin + couponHeight + 5);
        doc.setLineDashPattern([], 0);
        
        // Informations supplémentaires
        let yPos = margin + couponHeight + 15;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        
        if (promotion.includeTaxes && settings) {
            // Calculer le prix avant taxes
            const tpsRate = settings.taxes?.tps?.enabled ? (settings.taxes.tps.rate || 0) : 0;
            const tvqRate = settings.taxes?.tvq?.enabled ? (settings.taxes.tvq.rate || 0) : 0;
            const totalTaxRate = tpsRate + tvqRate;
            
            if (totalTaxRate > 0) {
                const priceBeforeTaxes = finalPrice / (1 + totalTaxRate);
                const tps = priceBeforeTaxes * tpsRate;
                const tvq = priceBeforeTaxes * tvqRate;
                
                doc.text('Détail des taxes:', margin, yPos);
                yPos += 7;
                doc.text(`Sous-total: $${priceBeforeTaxes.toFixed(2)}`, margin + 5, yPos);
                yPos += 7;
                if (tps > 0) {
                    doc.text(`${settings.taxes.tps.name || 'TPS'}: $${tps.toFixed(2)}`, margin + 5, yPos);
                    yPos += 7;
                }
                if (tvq > 0) {
                    doc.text(`${settings.taxes.tvq.name || 'TVQ'}: $${tvq.toFixed(2)}`, margin + 5, yPos);
                    yPos += 7;
                }
                doc.setFont(undefined, 'bold');
                doc.text(`Total: $${finalPrice.toFixed(2)}`, margin + 5, yPos);
                doc.setFont(undefined, 'normal');
                yPos += 7;
            }
        }
        
        // Code de promotion
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Code: ${promotion.id.substring(0, 8).toUpperCase()}`, pageWidth / 2, yPos + 10, { align: 'center' });
        
        // Télécharger
        const filename = `promotion_${promotion.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
        
        showMessage('PDF généré avec succès', 'success');
    } catch (error) {
        console.error('Erreur lors de la génération du PDF:', error);
        showMessage('Erreur lors de la génération du PDF. Assurez-vous que la bibliothèque jsPDF est chargée.', 'error');
    }
};

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredPromotions = promotions.filter(promotion => {
            const product = promotion.productId ? products.find(p => p.id === promotion.productId) : null;
            const category = promotion.categoryId ? categories.find(c => c.id === promotion.categoryId) : null;
            const productName = product ? product.name.toLowerCase() : '';
            const categoryName = category ? category.name.toLowerCase() : '';
            const promotionName = (promotion.name || '').toLowerCase();
            return productName.includes(searchTerm) || categoryName.includes(searchTerm) || promotionName.includes(searchTerm);
        });
        displayPromotions(filteredPromotions);
    });
}

function showMessage(message, type = 'success') {
    const messageEl = document.getElementById('formMessage');
    if (!messageEl) return;
    
    messageEl.className = `alert alert-${type}`;
    messageEl.textContent = message;
    messageEl.style.display = 'block';
    
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
}

