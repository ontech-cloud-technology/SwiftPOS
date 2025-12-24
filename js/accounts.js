// Gestion des comptes utilisateurs
import { logout, getCurrentUser, isAdmin } from './auth.js';
import { getAllUsers, createUser, updateUser, deleteUser } from './firestore.js';

let users = [];
let editingUserId = null;

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
    
    // Charger les utilisateurs
    loadUsers();
    
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

async function loadUsers() {
    try {
        users = await getAllUsers();
        displayUsers(users);
    } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        showMessage('Erreur lors du chargement des utilisateurs', 'error');
    }
}

// Fonction pour obtenir les initiales d'un nom
function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Fonction pour formater la date
function formatDate(date) {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function displayUsers(usersList) {
    const tbody = document.getElementById('usersTableBody');
    
    if (usersList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4">
                    <div class="empty-state">
                        <div class="empty-state-icon">👥</div>
                        <div class="empty-state-text">Aucun utilisateur trouvé</div>
                        <div class="empty-state-subtext">Essayez de modifier votre recherche</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = usersList.map(user => {
        const createdAt = user.createdAt ? formatDate(user.createdAt) : 'N/A';
        const initials = getInitials(user.name);
        const userName = user.name || 'Utilisateur';
        const userEmail = user.email || 'N/A';
        const isAdmin = user.role === 'admin';
        
        return `
            <tr>
                <td>
                    <div class="user-avatar">
                        <div class="avatar-circle ${isAdmin ? 'admin' : ''}">
                            ${initials}
                        </div>
                        <div class="user-info">
                            <div class="user-name">${userName}</div>
                            <div class="user-email">${userEmail}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="role-badge ${user.role || 'user'}">
                        ${isAdmin ? '👑' : '👤'} ${isAdmin ? 'Administrateur' : 'Caissier'}
                    </span>
                </td>
                <td>
                    <span class="date-cell">${createdAt}</span>
                </td>
                <td style="text-align: right;">
                    <div class="table-actions" style="justify-content: flex-end;">
                        <button class="btn btn-secondary btn-icon" onclick="editUser('${user.id}')" title="Modifier">
                            <span>✏️</span>
                            <span>Modifier</span>
                        </button>
                        <button class="btn btn-danger btn-icon" onclick="deleteUserConfirm('${user.id}')" title="Supprimer">
                            <span>🗑️</span>
                            <span>Supprimer</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function setupModal() {
    const modal = document.getElementById('userModal');
    const openBtn = document.getElementById('openModalBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    
    // Ouvrir le modal
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            resetForm();
            openModal();
        });
    }
    
    // Fermer le modal
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            closeModal();
            resetForm();
        });
    }
    
    // Fermer en cliquant sur l'overlay
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
                resetForm();
            }
        });
    }
    
    // Fermer avec la touche Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
            closeModal();
            resetForm();
        }
    });
}

function openModal() {
    const modal = document.getElementById('userModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Empêcher le scroll de la page
    }
}

function closeModal() {
    const modal = document.getElementById('userModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = ''; // Réactiver le scroll
    }
}

function setupForm() {
    const form = document.getElementById('userForm');
    const submitBtn = document.getElementById('submitBtn');
    
    // Gestionnaire pour le formulaire
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleFormSubmit();
    });
    
    // Gestionnaire pour le bouton submit (au cas où)
    if (submitBtn) {
        submitBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await handleFormSubmit();
        });
    }
}

async function handleFormSubmit() {
    const formData = {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        role: document.getElementById('role').value
    };
    
    try {
        if (editingUserId) {
            // Mise à jour
            await updateUser(editingUserId, formData);
            showMessage('Utilisateur mis à jour avec succès', 'success');
        } else {
            // Création
            await createUser(formData);
            showMessage('Utilisateur créé avec succès. N\'oubliez pas de créer le compte d\'authentification dans Firebase Console.', 'success');
        }
        
        // Fermer le modal après un court délai pour voir le message
        setTimeout(() => {
            closeModal();
            resetForm();
            loadUsers();
        }, 1500);
    } catch (error) {
        console.error('Erreur:', error);
        showMessage('Erreur: ' + (error.message || 'Une erreur est survenue'), 'error');
    }
}

function resetForm() {
    const form = document.getElementById('userForm');
    if (form) {
        form.reset();
    }
    const userIdInput = document.getElementById('userId');
    if (userIdInput) {
        userIdInput.value = '';
    }
    editingUserId = null;
    const formTitle = document.getElementById('formTitle');
    if (formTitle) {
        formTitle.textContent = 'Créer un compte';
    }
    const submitText = document.getElementById('submitText');
    if (submitText) {
        submitText.textContent = 'Créer';
    }
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
    const passwordGroup = document.getElementById('passwordGroup');
    if (passwordGroup) {
        passwordGroup.style.display = 'block';
    }
    // Réinitialiser le message
    const formMessage = document.getElementById('formMessage');
    if (formMessage) {
        formMessage.textContent = '';
        formMessage.className = '';
        formMessage.style.display = 'none';
    }
}

window.editUser = function(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    editingUserId = userId;
    document.getElementById('userId').value = userId;
    document.getElementById('name').value = user.name || '';
    document.getElementById('email').value = user.email || '';
    document.getElementById('role').value = user.role || 'user';
    document.getElementById('formTitle').textContent = 'Modifier le compte';
    document.getElementById('submitText').textContent = 'Mettre à jour';
    document.getElementById('cancelBtn').style.display = 'block';
    document.getElementById('passwordGroup').style.display = 'none';
    
    // Ouvrir le modal en mode édition
    openModal();
};

window.deleteUserConfirm = async function(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${user.name || user.email}" ?\n\nNote: Le compte d'authentification devra être supprimé manuellement dans Firebase Console.`)) {
        return;
    }
    
    try {
        await deleteUser(userId);
        showMessage('Utilisateur supprimé avec succès', 'success');
        await loadUsers();
    } catch (error) {
        console.error('Erreur:', error);
        showMessage('Erreur lors de la suppression: ' + (error.message || 'Une erreur est survenue'), 'error');
    }
};

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredUsers = users.filter(user => 
            (user.name && user.name.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm)) ||
            (user.role && user.role.toLowerCase().includes(searchTerm))
        );
        displayUsers(filteredUsers);
    });
}

function showMessage(message, type = 'success') {
    const messageEl = document.getElementById('formMessage');
    messageEl.className = `alert alert-${type}`;
    messageEl.textContent = message;
    messageEl.style.display = 'block';
    
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
}

