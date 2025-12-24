// Gestion des catégories
import { logout, getCurrentUser, isAdmin } from './auth.js';
import { getAllCategories, createCategory, updateCategory, deleteCategory } from './firestore.js';

let categories = [];
let editingCategoryId = null;

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
    
    // Charger les catégories
    loadCategories();
    
    // Configurer le formulaire
    setupForm();
    
    // Configurer la recherche
    setupSearch();
    
    // Configurer le logout
    setupLogout();
    
    // Configurer le modal
    setupModal();
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
        displayCategories(categories);
    } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
        showMessage('Erreur lors du chargement des catégories', 'error');
    }
}

function displayCategories(categoriesList) {
    const tbody = document.getElementById('categoriesTableBody');
    
    if (categoriesList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.5);">
                    Aucune catégorie trouvée. Créez votre première catégorie !
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = categoriesList.map(category => {
        const createdAt = category.createdAt?.toDate ? category.createdAt.toDate() : new Date(category.createdAt || 0);
        const dateStr = createdAt.toLocaleDateString('fr-CA');
        
        return `
            <tr>
                <td class="category-icon-cell">${category.icon || '🏷️'}</td>
                <td>${category.name}</td>
                <td>${category.description || '-'}</td>
                <td>${dateStr}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-secondary btn-icon" onclick="editCategory('${category.id}')">
                            ✏️ Modifier
                        </button>
                        <button class="btn btn-danger btn-icon" onclick="deleteCategoryConfirm('${category.id}')">
                            🗑️ Supprimer
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function setupForm() {
    const form = document.getElementById('categoryForm');
    const cancelBtn = document.getElementById('cancelBtn');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('name').value.trim(),
            icon: document.getElementById('icon').value.trim() || null,
            description: document.getElementById('description').value.trim() || null
        };
        
        // Validation
        if (!formData.name) {
            showMessage('Le nom de la catégorie est requis', 'error');
            return;
        }
        
        try {
            if (editingCategoryId) {
                // Mise à jour
                await updateCategory(editingCategoryId, formData);
                showMessage('Catégorie mise à jour avec succès', 'success');
            } else {
                // Vérifier si la catégorie existe déjà
                const existingCategory = categories.find(c => 
                    c.name.toLowerCase() === formData.name.toLowerCase()
                );
                
                if (existingCategory) {
                    showMessage('Une catégorie avec ce nom existe déjà', 'error');
                    return;
                }
                
                // Création
                await createCategory(formData);
                showMessage('Catégorie créée avec succès', 'success');
            }
            
            resetForm();
            await loadCategories();
            closeModal();
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur: ' + (error.message || 'Une erreur est survenue'), 'error');
        }
    });
}

function resetForm(closeModalAfterReset = true) {
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    editingCategoryId = null;
    document.getElementById('modalTitle').textContent = 'Créer une catégorie';
    document.getElementById('submitText').textContent = 'Créer';
    const messageEl = document.getElementById('formMessage');
    messageEl.textContent = '';
    messageEl.style.display = 'none';
    if (closeModalAfterReset) {
        closeModal();
    }
}

function setupModal() {
    const modal = document.getElementById('categoryModal');
    const addBtn = document.getElementById('addCategoryBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    
    console.log('setupModal called', { modal, addBtn, closeBtn, cancelBtn });
    
    // Ouvrir le modal pour ajouter
    if (addBtn) {
        addBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Add button clicked');
            resetForm(false); // Ne pas fermer le modal, on va l'ouvrir juste après
            openModal();
        });
    } else {
        console.error('addCategoryBtn not found!');
    }
    
    // Fermer le modal
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }
    
    // Fermer en cliquant sur l'overlay
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
    
    // Fermer avec la touche Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && (modal.classList.contains('active') || modal.classList.contains('show'))) {
            closeModal();
        }
    });
}

function openModal() {
    const modal = document.getElementById('categoryModal');
    console.log('openModal called', modal);
    if (modal) {
        modal.classList.add('active', 'show');
        console.log('Modal opened, classList:', modal.classList.toString());
        // Focus sur le premier input
        setTimeout(() => {
            const nameInput = document.getElementById('name');
            if (nameInput) {
                nameInput.focus();
            }
        }, 100);
    } else {
        console.error('categoryModal not found!');
    }
}

function closeModal() {
    const modal = document.getElementById('categoryModal');
    if (modal) {
        modal.classList.remove('active', 'show');
    }
}

window.editCategory = function(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;
    
    editingCategoryId = categoryId;
    document.getElementById('categoryId').value = categoryId;
    document.getElementById('name').value = category.name || '';
    document.getElementById('icon').value = category.icon || '';
    document.getElementById('description').value = category.description || '';
    document.getElementById('modalTitle').textContent = 'Modifier la catégorie';
    document.getElementById('submitText').textContent = 'Mettre à jour';
    
    const messageEl = document.getElementById('formMessage');
    messageEl.textContent = '';
    messageEl.style.display = 'none';
    
    openModal();
};

window.deleteCategoryConfirm = async function(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;
    
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la catégorie "${category.name}" ?\n\nNote: Les produits associés à cette catégorie ne seront pas supprimés, mais leur catégorie sera vide.`)) {
        return;
    }
    
    try {
        await deleteCategory(categoryId);
        showMessage('Catégorie supprimée avec succès', 'success');
        await loadCategories();
    } catch (error) {
        console.error('Erreur:', error);
        showMessage('Erreur lors de la suppression: ' + (error.message || 'Une erreur est survenue'), 'error');
    }
};

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const sortBy = document.getElementById('sortBy');
    
    const applyFilters = () => {
        const searchTerm = searchInput.value.toLowerCase();
        let filteredCategories = categories.filter(category => 
            (category.name && category.name.toLowerCase().includes(searchTerm)) ||
            (category.description && category.description.toLowerCase().includes(searchTerm))
        );
        
        // Trier les catégories
        const sortValue = sortBy.value;
        filteredCategories.sort((a, b) => {
            switch (sortValue) {
                case 'name-asc':
                    return (a.name || '').localeCompare(b.name || '');
                case 'name-desc':
                    return (b.name || '').localeCompare(a.name || '');
                case 'date-asc':
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                    return dateA - dateB;
                case 'date-desc':
                    const dateA2 = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                    const dateB2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                    return dateB2 - dateA2;
                default:
                    return 0;
            }
        });
        
        displayCategories(filteredCategories);
    };
    
    searchInput.addEventListener('input', applyFilters);
    sortBy.addEventListener('change', applyFilters);
}

function showMessage(message, type = 'success') {
    const messageEl = document.getElementById('formMessage');
    if (messageEl) {
        messageEl.className = `alert alert-${type}`;
        messageEl.textContent = message;
        messageEl.style.display = 'block';
        
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 5000);
    }
}

