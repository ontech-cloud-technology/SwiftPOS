// Gestion de l'historique des ventes
import { logout, getCurrentUser, isAdmin } from './auth.js';
import { getAllSales, getUserSales, getSettings } from './firestore.js';
import { formatDate } from './utils.js';

let allSales = [];
let filteredSales = [];
let settings = null;

// Vérifier l'authentification
window.addEventListener('DOMContentLoaded', async () => {
    // Attendre un peu pour s'assurer que tous les éléments sont chargés
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const user = getCurrentUser();
    
    if (!user) {
        window.location.href = '/login.html';
        return;
    }
    
    // Afficher les infos utilisateur
    displayUserInfo(user);
    
    // Charger les paramètres
    await loadSettings();
    
    // Configurer les filtres
    setupFilters();
    
    // Configurer le logout
    setupLogout();
    
    // Configurer l'export
    setupExport();
    
    // Configurer le modal de détails
    setupSaleDetailsModal();
    
    // Charger les ventes (après avoir configuré tout le reste)
    loadSales();
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

function getCurrencySymbol(sale) {
    // Utiliser le symbole de la vente si disponible, sinon les paramètres actuels
    return sale?.currencySymbol || settings?.currencySymbol || '$';
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

async function loadSales() {
    try {
        const user = getCurrentUser();
        
        if (isAdmin()) {
            allSales = await getAllSales();
        } else {
            allSales = await getUserSales(user.uid);
        }
        
        filteredSales = [...allSales];
        // Mettre à jour allSales pour l'export PDF
        displaySales(filteredSales);
    } catch (error) {
        console.error('Erreur lors du chargement des ventes:', error);
        showMessage('Erreur lors du chargement des ventes', 'error');
    }
}

let currentSaleIndex = null; // Pour stocker l'index de la vente actuellement affichée dans le modal

function displaySales(salesList) {
    // Attendre que le DOM soit prêt
    const tbody = document.getElementById('salesTableBody');
    
    if (!tbody) {
        console.error('Element salesTableBody not found. Retrying in 100ms...');
        // Réessayer après un court délai
        setTimeout(() => {
            const retryTbody = document.getElementById('salesTableBody');
            if (retryTbody) {
                displaySales(salesList);
            } else {
                console.error('Element salesTableBody still not found after retry');
            }
        }, 100);
        return;
    }
    
    // Trier les ventes par date (plus récentes en premier)
    const sortedSales = [...salesList].sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA;
    });
    
    if (sortedSales.length === 0) {
        try {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 3rem; color: var(--color-text-tertiary);">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                        <p style="font-size: 1.125rem; font-weight: 500;">Aucune commande trouvée</p>
                        <p style="font-size: 0.9375rem; margin-top: 0.5rem;">Les commandes apparaîtront ici une fois effectuées</p>
                    </td>
                </tr>
            `;
        } catch (error) {
            console.error('Error setting innerHTML:', error);
        }
        return;
    }
    
    // Créer un mapping pour retrouver l'index original dans allSales
    const salesMap = new Map();
    sortedSales.forEach((sale, sortedIndex) => {
        const originalIndex = allSales.findIndex(s => s.id === sale.id);
        salesMap.set(sortedIndex, originalIndex >= 0 ? originalIndex : sortedIndex);
    });
    
    try {
        tbody.innerHTML = sortedSales.map((sale, sortedIndex) => {
            const originalIndex = salesMap.get(sortedIndex);
            const saleId = sale.id.substring(0, 8);
            const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
            const formattedDate = formatDate(saleDate);
            const currencySymbol = getCurrencySymbol(sale);
            
            return `
                <tr class="sale-table-row" data-sale-index="${originalIndex}">
                    <td class="sale-number-cell">
                        <span class="sale-number">Commande #${saleId}</span>
                    </td>
                    <td>${formattedDate}</td>
                    <td>${sale.userName || 'N/A'}</td>
                    <td><strong>${currencySymbol}${parseFloat(sale.total || 0).toFixed(2)}</strong></td>
                    <td class="sale-actions-cell">
                        <button class="table-arrow-btn" onclick="toggleSaleDetails(${originalIndex})" aria-expanded="false" id="arrow-btn-${originalIndex}" title="Voir les détails">
                            <span class="arrow-icon" id="arrow-icon-${originalIndex}">▶</span>
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="showSaleDetailsModal(${originalIndex})" title="Voir dans un popup">
                            <span>👁️</span>
                        </button>
                    </td>
                </tr>
                <tr class="sale-details-row" id="details-row-${originalIndex}" style="display: none;">
                    <td colspan="5" class="sale-details-cell">
                        ${generateSaleDetails(sale, originalIndex)}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error setting innerHTML in displaySales:', error);
        showMessage('Erreur lors de l\'affichage des ventes', 'error');
    }
}

function generateSaleDetails(sale, index) {
    const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
    const formattedDate = formatDate(saleDate);
    const currencySymbol = getCurrencySymbol(sale);
    const saleId = sale.id.substring(0, 8);
    
    return `
        <div class="sale-details-container">
            <div class="sale-details-header">
                <h3>Détails de la Commande #${saleId}</h3>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-sm btn-primary" onclick="showSaleDetailsModal(${index})" title="Voir dans un popup">
                        <span>👁️</span> Voir en popup
                    </button>
                    <button class="btn-export-pdf" onclick="exportSaleToPDF(${index})" title="Exporter en PDF">
                        <span>📄</span> Exporter en PDF
                    </button>
                </div>
            </div>
            
            <div class="sale-details-content">
                <div class="details-section">
                    <h4 class="section-title">📋 Informations</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Numéro de commande</span>
                            <span class="info-value">#${saleId}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Date et heure</span>
                            <span class="info-value">${formattedDate}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Vendeur</span>
                            <span class="info-value">${sale.userName || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Nombre d'articles</span>
                            <span class="info-value">${sale.items?.length || 0}</span>
                        </div>
                    </div>
                </div>
                
                <div class="details-section">
                    <h4 class="section-title">🛒 Articles</h4>
                    <div class="items-table">
                        <div class="items-header">
                            <div>Article</div>
                            <div>Quantité</div>
                            <div>Prix unitaire</div>
                            <div>Total</div>
                        </div>
                        ${(sale.items || []).map(item => {
                            const itemTotal = item.quantity * parseFloat(item.price || 0);
                            return `
                                <div class="item-row">
                                    <div class="item-name">${item.name}</div>
                                    <div class="item-qty">${item.quantity}</div>
                                    <div class="item-price">${currencySymbol}${parseFloat(item.price || 0).toFixed(2)}</div>
                                    <div class="item-total">${currencySymbol}${itemTotal.toFixed(2)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <div class="details-section">
                    <h4 class="section-title">💵 Résumé financier</h4>
                    <div class="summary-box">
                        <div class="summary-item">
                            <span class="summary-label">Sous-total</span>
                            <span class="summary-value">${currencySymbol}${parseFloat(sale.subtotal || 0).toFixed(2)}</span>
                        </div>
                        ${sale.tps > 0 ? `
                            <div class="summary-item">
                                <span class="summary-label">${settings?.taxes?.tps?.name || 'TPS'}</span>
                                <span class="summary-value">${currencySymbol}${parseFloat(sale.tps || 0).toFixed(2)}</span>
                            </div>
                        ` : ''}
                        ${sale.tvq > 0 ? `
                            <div class="summary-item">
                                <span class="summary-label">${settings?.taxes?.tvq?.name || 'TVQ'}</span>
                                <span class="summary-value">${currencySymbol}${parseFloat(sale.tvq || 0).toFixed(2)}</span>
                            </div>
                        ` : ''}
                        ${sale.totalDiscount > 0 ? `
                            <div class="summary-item discount">
                                <span class="summary-label">Remise</span>
                                <span class="summary-value">-${currencySymbol}${parseFloat(sale.totalDiscount || 0).toFixed(2)}</span>
                            </div>
                        ` : ''}
                        <div class="summary-item total">
                            <span class="summary-label">Total</span>
                            <span class="summary-value">${currencySymbol}${parseFloat(sale.total || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

window.toggleSaleDetails = function(index) {
    const detailsRow = document.getElementById(`details-row-${index}`);
    const arrowBtn = document.getElementById(`arrow-btn-${index}`);
    const arrowIcon = document.getElementById(`arrow-icon-${index}`);
    
    if (!detailsRow || !arrowBtn || !arrowIcon) {
        console.error('Elements not found for index:', index);
        return;
    }
    
    const isExpanded = arrowBtn.getAttribute('aria-expanded') === 'true';
    
    if (isExpanded) {
        // Fermer l'accordéon
        detailsRow.style.display = 'none';
        arrowBtn.setAttribute('aria-expanded', 'false');
        arrowIcon.textContent = '▶';
        arrowIcon.style.transform = 'rotate(0deg)';
        arrowBtn.classList.remove('expanded');
    } else {
        // Ouvrir l'accordéon
        detailsRow.style.display = 'table-row';
        arrowBtn.setAttribute('aria-expanded', 'true');
        arrowIcon.textContent = '▼';
        arrowIcon.style.transform = 'rotate(0deg)';
        arrowBtn.classList.add('expanded');
        
        // Animation d'ouverture
        detailsRow.style.opacity = '0';
        detailsRow.style.maxHeight = '0';
        setTimeout(() => {
            detailsRow.style.transition = 'opacity 0.3s ease, max-height 0.3s ease';
            detailsRow.style.opacity = '1';
            detailsRow.style.maxHeight = '2000px';
        }, 10);
    }
};

// Fonction pour afficher les détails dans un modal
window.showSaleDetailsModal = function(index) {
    const sale = allSales[index];
    if (!sale) return;
    
    currentSaleIndex = index;
    
    const modal = document.getElementById('saleDetailsModal');
    const modalTitle = document.getElementById('modalSaleTitle');
    const modalBody = document.getElementById('modalSaleBody');
    
    if (!modal || !modalTitle || !modalBody) {
        console.error('Modal elements not found');
        return;
    }
    
    const saleId = sale.id.substring(0, 8);
    modalTitle.textContent = `Détails de la Commande #${saleId}`;
    modalBody.innerHTML = generateSaleDetailsHTML(sale);
    
    modal.classList.add('show');
    
    // Mettre à jour le bouton d'export PDF dans le modal
    const exportPdfBtn = document.getElementById('exportSalePdfBtn');
    if (exportPdfBtn) {
        exportPdfBtn.onclick = () => {
            exportSaleToPDF(index);
        };
    }
};

// Fonction pour générer le HTML des détails (pour le modal)
function generateSaleDetailsHTML(sale) {
    const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
    const formattedDate = formatDate(saleDate);
    const currencySymbol = getCurrencySymbol(sale);
    const saleId = sale.id.substring(0, 8);
    
    return `
        <div class="sale-details-content">
            <div class="details-section">
                <h4 class="section-title">📋 Informations</h4>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Numéro de commande</span>
                        <span class="info-value">#${saleId}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Date et heure</span>
                        <span class="info-value">${formattedDate}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Vendeur</span>
                        <span class="info-value">${sale.userName || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Nombre d'articles</span>
                        <span class="info-value">${sale.items?.length || 0}</span>
                    </div>
                </div>
            </div>
            
            <div class="details-section">
                <h4 class="section-title">🛒 Articles</h4>
                <div class="items-table">
                    <div class="items-header">
                        <div>Article</div>
                        <div>Quantité</div>
                        <div>Prix unitaire</div>
                        <div>Total</div>
                    </div>
                    ${(sale.items || []).map(item => {
                        const itemTotal = item.quantity * parseFloat(item.price || 0);
                        return `
                            <div class="item-row">
                                <div class="item-name">${item.name}</div>
                                <div class="item-qty">${item.quantity}</div>
                                <div class="item-price">${currencySymbol}${parseFloat(item.price || 0).toFixed(2)}</div>
                                <div class="item-total">${currencySymbol}${itemTotal.toFixed(2)}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div class="details-section">
                <h4 class="section-title">💵 Résumé financier</h4>
                <div class="summary-box">
                    <div class="summary-item">
                        <span class="summary-label">Sous-total</span>
                        <span class="summary-value">${currencySymbol}${parseFloat(sale.subtotal || 0).toFixed(2)}</span>
                    </div>
                    ${sale.tps > 0 ? `
                        <div class="summary-item">
                            <span class="summary-label">${settings?.taxes?.tps?.name || 'TPS'}</span>
                            <span class="summary-value">${currencySymbol}${parseFloat(sale.tps || 0).toFixed(2)}</span>
                        </div>
                    ` : ''}
                    ${sale.tvq > 0 ? `
                        <div class="summary-item">
                            <span class="summary-label">${settings?.taxes?.tvq?.name || 'TVQ'}</span>
                            <span class="summary-value">${currencySymbol}${parseFloat(sale.tvq || 0).toFixed(2)}</span>
                        </div>
                    ` : ''}
                    ${sale.totalDiscount > 0 ? `
                        <div class="summary-item discount">
                            <span class="summary-label">Remise</span>
                            <span class="summary-value">-${currencySymbol}${parseFloat(sale.totalDiscount || 0).toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div class="summary-item total">
                        <span class="summary-label">Total</span>
                        <span class="summary-value">${currencySymbol}${parseFloat(sale.total || 0).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Fermer le modal de détails
function setupSaleDetailsModal() {
    const modal = document.getElementById('saleDetailsModal');
    const closeBtn = document.getElementById('closeSaleDetailsModal');
    const closeBtnFooter = document.getElementById('closeSaleDetailsBtn');
    
    const closeModal = () => {
        if (modal) {
            modal.classList.remove('show');
        }
        currentSaleIndex = null;
    };
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    if (closeBtnFooter) {
        closeBtnFooter.addEventListener('click', closeModal);
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
}

window.exportSaleToPDF = function(index) {
    // Trouver la vente dans filteredSales qui correspond à l'index dans allSales
    const sale = allSales[index];
    if (!sale) {
        console.error('Sale not found at index:', index);
        showMessage('Erreur: Commande introuvable', 'error');
        return;
    }
    
    // Vérifier que jsPDF est chargé
    if (!window.jspdf) {
        console.error('jsPDF library not loaded');
        showMessage('Erreur: La bibliothèque PDF n\'est pas chargée', 'error');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
        const currencySymbol = getCurrencySymbol(sale);
        const saleId = sale.id.substring(0, 8);
        
        // Couleurs premium
        const primaryColor = [59, 130, 246]; // Bleu
        const darkColor = [31, 41, 55];
        const lightGray = [243, 244, 246];
        const textGray = [107, 114, 128];
        
        let yPos = 20;
        
        // En-tête avec fond dégradé
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 50, 'F');
        
        // Logo/Titre
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont(undefined, 'bold');
        doc.text('⚡ SwiftPOS', 20, 25);
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text('Facture de Commande', 20, 35);
        
        // Numéro de commande à droite
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(`Commande #${saleId}`, 150, 25);
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(saleDate.toLocaleDateString('fr-CA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }), 150, 35);
        
        yPos = 65;
        
        // Informations de la commande
        doc.setTextColor(...darkColor);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Informations de la Commande', 20, yPos);
        
        yPos += 10;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...textGray);
        doc.text(`Vendeur: ${sale.userName || 'N/A'}`, 20, yPos);
        yPos += 7;
        doc.text(`Date: ${saleDate.toLocaleDateString('fr-CA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}`, 20, yPos);
        yPos += 7;
        doc.text(`Nombre d'articles: ${sale.items?.length || 0}`, 20, yPos);
        
        yPos += 15;
        
        // Tableau des articles
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...darkColor);
        doc.text('Articles', 20, yPos);
        
        yPos += 8;
        
        // En-tête du tableau
        doc.setFillColor(...lightGray);
        doc.rect(20, yPos - 5, 170, 8, 'F');
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...darkColor);
        doc.text('Article', 22, yPos);
        doc.text('Qté', 100, yPos);
        doc.text('Prix unit.', 125, yPos);
        doc.text('Total', 170, yPos, { align: 'right' });
        
        yPos += 8;
        
        // Lignes des articles
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...textGray);
        
        (sale.items || []).forEach((item, i) => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            
            const itemTotal = item.quantity * parseFloat(item.price || 0);
            
            // Ligne alternée
            if (i % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(20, yPos - 5, 170, 7, 'F');
            }
            
            doc.text(item.name.substring(0, 40), 22, yPos);
            doc.text(item.quantity.toString(), 100, yPos);
            doc.text(`${currencySymbol}${parseFloat(item.price || 0).toFixed(2)}`, 125, yPos);
            doc.text(`${currencySymbol}${itemTotal.toFixed(2)}`, 170, yPos, { align: 'right' });
            
            yPos += 7;
        });
        
        yPos += 10;
        
        // Résumé financier
        if (yPos > 220) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...darkColor);
        doc.text('Résumé Financier', 20, yPos);
        
        yPos += 10;
        
        // Box de résumé avec bordure
        const summaryStartY = yPos;
        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(0.5);
        doc.rect(20, summaryStartY - 5, 170, 40);
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...textGray);
        
        doc.text('Sous-total:', 25, yPos);
        doc.text(`${currencySymbol}${parseFloat(sale.subtotal || 0).toFixed(2)}`, 170, yPos, { align: 'right' });
        yPos += 7;
        
        if (sale.tps > 0) {
            doc.text(`${settings?.taxes?.tps?.name || 'TPS'}:`, 25, yPos);
            doc.text(`${currencySymbol}${parseFloat(sale.tps || 0).toFixed(2)}`, 170, yPos, { align: 'right' });
            yPos += 7;
        }
        
        if (sale.tvq > 0) {
            doc.text(`${settings?.taxes?.tvq?.name || 'TVQ'}:`, 25, yPos);
            doc.text(`${currencySymbol}${parseFloat(sale.tvq || 0).toFixed(2)}`, 170, yPos, { align: 'right' });
            yPos += 7;
        }
        
        if (sale.totalDiscount > 0) {
            doc.setTextColor(16, 185, 129); // Vert pour remise
            doc.text('Remise:', 25, yPos);
            doc.text(`-${currencySymbol}${parseFloat(sale.totalDiscount || 0).toFixed(2)}`, 170, yPos, { align: 'right' });
            yPos += 7;
            doc.setTextColor(...textGray);
        }
        
        // Ligne de séparation
        doc.setDrawColor(200, 200, 200);
        doc.line(25, yPos, 185, yPos);
        yPos += 5;
        
        // Total en gras et couleur
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('Total:', 25, yPos);
        doc.text(`${currencySymbol}${parseFloat(sale.total || 0).toFixed(2)}`, 170, yPos, { align: 'right' });
        
        // Pied de page
        const totalPages = doc.internal.pages.length - 1;
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(...textGray);
            doc.setFont(undefined, 'normal');
            doc.text(`Page ${i} / ${totalPages}`, 195, 285, { align: 'right' });
            doc.text('SwiftPOS - Système de Point de Vente', 20, 285);
        }
        
        // Télécharger
        const filename = `commande_${saleId}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
        
        // Notification
        showMessage('PDF exporté avec succès!', 'success');
        
    } catch (error) {
        console.error('Erreur lors de l\'export PDF:', error);
        showMessage('Erreur lors de l\'export PDF', 'error');
    }
};

function setupFilters() {
    const filterBtn = document.getElementById('filterBtn');
    const filterModal = document.getElementById('filterModal');
    const closeFilterModal = document.getElementById('closeFilterModal');
    const applyFiltersBtn = document.getElementById('applyFilters');
    const resetFiltersBtn = document.getElementById('resetFilters');
    const searchUserInput = document.getElementById('searchUser');
    
    // Ouvrir le modal
    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
            filterModal.classList.add('show');
        });
    }
    
    // Fermer le modal
    const closeModal = () => {
        filterModal.classList.remove('show');
    };
    
    if (closeFilterModal) {
        closeFilterModal.addEventListener('click', closeModal);
    }
    
    // Fermer en cliquant sur l'overlay
    if (filterModal) {
        filterModal.addEventListener('click', (e) => {
            if (e.target === filterModal) {
                closeModal();
            }
        });
    }
    
    // Appliquer les filtres
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            applyFilters();
            closeModal();
        });
    }
    
    // Réinitialiser les filtres
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            document.getElementById('dateFrom').value = '';
            document.getElementById('dateTo').value = '';
            if (searchUserInput) searchUserInput.value = '';
            filteredSales = [...allSales];
            displaySales(filteredSales);
            closeModal();
        });
    }
    
    // Appliquer les filtres avec Enter
    if (searchUserInput) {
        searchUserInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                applyFilters();
                closeModal();
            }
        });
    }
}

function applyFilters() {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const searchUser = document.getElementById('searchUser').value.toLowerCase();
    
    filteredSales = allSales.filter(sale => {
        // Filtre par date
        if (dateFrom || dateTo) {
            const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date();
            const saleDateStr = saleDate.toISOString().split('T')[0];
            
            if (dateFrom && saleDateStr < dateFrom) return false;
            if (dateTo && saleDateStr > dateTo) return false;
        }
        
        // Filtre par utilisateur
        if (searchUser) {
            const userName = (sale.userName || '').toLowerCase();
            if (!userName.includes(searchUser)) {
                return false;
            }
        }
        
        return true;
    });
    
    displaySales(filteredSales);
}

function setupExport() {
    const exportBtn = document.getElementById('exportBtn');
    const exportModal = document.getElementById('exportModal');
    const closeExportModal = document.getElementById('closeExportModal');
    const cancelExport = document.getElementById('cancelExport');
    const confirmExport = document.getElementById('confirmExport');
    
    if (!exportBtn) {
        console.warn('Export button not found, export functionality disabled');
        return;
    }
    
    if (!exportModal) {
        console.warn('Export modal not found, export functionality disabled');
        return;
    }
    
    // Ouvrir le modal
    exportBtn.addEventListener('click', () => {
        if (exportModal) {
            exportModal.classList.add('show');
            // Attendre un peu pour que le DOM soit mis à jour
            setTimeout(() => {
                if (typeof updateRadioStyles === 'function') {
                    updateRadioStyles();
                }
            }, 10);
        }
    });
    
    // Fermer le modal
    const closeModalFunc = () => {
        if (exportModal) {
            exportModal.classList.remove('show');
        }
    };
    
    if (closeExportModal) {
        closeExportModal.addEventListener('click', closeModalFunc);
    }
    
    if (cancelExport) {
        cancelExport.addEventListener('click', closeModalFunc);
    }
    
    // Fermer en cliquant sur l'overlay
    if (exportModal) {
        exportModal.addEventListener('click', (e) => {
            if (e.target === exportModal) {
                closeModalFunc();
            }
        });
    }
    
    // Mettre à jour les styles des radios quand ils changent
    const radioInputs = document.querySelectorAll('input[name="period"], input[name="format"]');
    if (radioInputs && radioInputs.length > 0) {
        radioInputs.forEach(radio => {
            if (radio) {
                radio.addEventListener('change', () => {
                    if (typeof updateRadioStyles === 'function') {
                        updateRadioStyles();
                    }
                });
            }
        });
    }
    
    // Confirmer l'export
    if (confirmExport) {
        confirmExport.addEventListener('click', () => {
            const periodRadio = document.querySelector('input[name="period"]:checked');
            const formatRadio = document.querySelector('input[name="format"]:checked');
            
            if (periodRadio && formatRadio) {
                const period = periodRadio.value;
                const format = formatRadio.value;
                
                exportSales(period, format);
                closeModalFunc();
            }
        });
    }
}

function updateRadioStyles() {
    document.querySelectorAll('.radio-option').forEach(option => {
        const radio = option.querySelector('input[type="radio"]');
        if (radio && radio.checked) {
            option.style.background = 'rgba(138, 43, 226, 0.25)';
            option.style.borderColor = 'var(--color-primary)';
        } else {
            option.style.background = 'rgba(138, 43, 226, 0.1)';
            option.style.borderColor = 'rgba(138, 43, 226, 0.3)';
        }
    });
}

function getSalesByPeriod(period) {
    const now = new Date();
    let startDate = null;
    
    switch (period) {
        case 'week':
            // Début de la semaine (lundi)
            startDate = new Date(now);
            startDate.setDate(now.getDate() - now.getDay() + 1);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'month':
            // Début du mois
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'all':
        default:
            // Toutes les ventes
            return allSales;
    }
    
    return allSales.filter(sale => {
        const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
        return saleDate >= startDate;
    });
}

function exportSales(period, format) {
    const salesToExport = getSalesByPeriod(period);
    
    if (salesToExport.length === 0) {
        showMessage('Aucune vente à exporter pour cette période', 'warning');
        return;
    }
    
    if (format === 'csv') {
        exportToCSV(salesToExport, period);
    } else if (format === 'excel') {
        exportToExcel(salesToExport, period);
    } else if (format === 'pdf') {
        exportToPDF(salesToExport, period);
    } else if (format === 'json') {
        exportToJSON(salesToExport, period);
    }
}

function exportToCSV(sales, period) {
    // En-têtes CSV
    const headers = [
        'ID Vente',
        'Date',
        'Vendeur',
        'Article',
        'Quantité',
        'Prix unitaire',
        'Sous-total article',
        'Sous-total vente',
        'TPS',
        'TVQ',
        'Total vente'
    ];
    
    // Préparer les lignes
    const rows = [];
    
    sales.forEach(sale => {
        const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
        const dateStr = saleDate.toLocaleDateString('fr-CA') + ' ' + saleDate.toLocaleTimeString('fr-CA');
        
        if (sale.items && sale.items.length > 0) {
            sale.items.forEach((item, index) => {
                const row = [
                    sale.id.substring(0, 8),
                    index === 0 ? dateStr : '', // Date seulement sur la première ligne
                    index === 0 ? (sale.userName || 'N/A') : '', // Vendeur seulement sur la première ligne
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
        } else {
            // Vente sans articles
            rows.push([
                sale.id.substring(0, 8),
                dateStr,
                sale.userName || 'N/A',
                'N/A',
                0,
                '0.00',
                '0.00',
                parseFloat(sale.subtotal || 0).toFixed(2),
                parseFloat(sale.tps || 0).toFixed(2),
                parseFloat(sale.tvq || 0).toFixed(2),
                parseFloat(sale.total || 0).toFixed(2)
            ]);
        }
    });
    
    // Créer le contenu CSV
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Ajouter BOM pour Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Télécharger
    const periodLabel = period === 'week' ? 'semaine' : period === 'month' ? 'mois' : 'toutes';
    const filename = `ventes_${periodLabel}_${new Date().toISOString().split('T')[0]}.csv`;
    downloadFile(blob, filename);
    
    showMessage(`Export CSV réussi : ${sales.length} vente(s) exportée(s)`, 'success');
}

function exportToJSON(sales, period) {
    // Préparer les données
    const exportData = {
        periode: period === 'week' ? 'Cette semaine' : period === 'month' ? 'Ce mois' : 'Toutes les ventes',
        dateExport: new Date().toISOString(),
        nombreVentes: sales.length,
        totalRevenus: sales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0).toFixed(2),
        ventes: sales.map(sale => {
            const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
            return {
                id: sale.id,
                date: saleDate.toISOString(),
                dateFormatee: saleDate.toLocaleDateString('fr-CA') + ' ' + saleDate.toLocaleTimeString('fr-CA'),
                vendeur: sale.userName || 'N/A',
                userId: sale.userId || 'N/A',
                articles: sale.items || [],
                sousTotal: parseFloat(sale.subtotal || 0).toFixed(2),
                tps: parseFloat(sale.tps || 0).toFixed(2),
                tvq: parseFloat(sale.tvq || 0).toFixed(2),
                total: parseFloat(sale.total || 0).toFixed(2)
            };
        })
    };
    
    // Créer le blob JSON
    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    
    // Télécharger
    const periodLabel = period === 'week' ? 'semaine' : period === 'month' ? 'mois' : 'toutes';
    const filename = `ventes_${periodLabel}_${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(blob, filename);
    
    showMessage(`Export JSON réussi : ${sales.length} vente(s) exportée(s)`, 'success');
}

function exportToExcel(sales, period) {
    try {
        // Préparer les données pour Excel
        const workbook = XLSX.utils.book_new();
        
        // Feuille 1: Détails des ventes
        const salesData = [];
        salesData.push([
            'ID Vente',
            'Date',
            'Vendeur',
            'Article',
            'Quantité',
            'Prix unitaire',
            'Prix original',
            'Remise',
            'Sous-total article',
            'Sous-total vente',
            'TPS',
            'TVQ',
            'Total vente'
        ]);
        
        sales.forEach(sale => {
            const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
            const dateStr = saleDate.toLocaleDateString('fr-CA') + ' ' + saleDate.toLocaleTimeString('fr-CA');
            
            if (sale.items && sale.items.length > 0) {
                sale.items.forEach((item, index) => {
                    salesData.push([
                        index === 0 ? sale.id.substring(0, 8) : '',
                        index === 0 ? dateStr : '',
                        index === 0 ? (sale.userName || 'N/A') : '',
                        item.name || 'N/A',
                        item.quantity || 0,
                        parseFloat(item.price || 0),
                        item.originalPrice ? parseFloat(item.originalPrice) : parseFloat(item.price || 0),
                        item.discount ? parseFloat(item.discount) : 0,
                        (item.quantity * parseFloat(item.price || 0)),
                        index === 0 ? parseFloat(sale.subtotal || 0) : '',
                        index === 0 ? parseFloat(sale.tps || 0) : '',
                        index === 0 ? parseFloat(sale.tvq || 0) : '',
                        index === 0 ? parseFloat(sale.total || 0) : ''
                    ]);
                });
            }
        });
        
        const salesSheet = XLSX.utils.aoa_to_sheet(salesData);
        XLSX.utils.book_append_sheet(workbook, salesSheet, 'Ventes');
        
        // Feuille 2: Résumé
        const summaryData = [
            ['Résumé des ventes'],
            [''],
            ['Période', period === 'week' ? 'Cette semaine' : period === 'month' ? 'Ce mois' : 'Toutes les ventes'],
            ['Date d\'export', new Date().toLocaleString('fr-CA')],
            [''],
            ['Nombre de ventes', sales.length],
            ['Sous-total', sales.reduce((sum, sale) => sum + parseFloat(sale.subtotal || 0), 0).toFixed(2)],
            ['Total remises', sales.reduce((sum, sale) => sum + parseFloat(sale.totalDiscount || 0), 0).toFixed(2)],
            ['TPS', sales.reduce((sum, sale) => sum + parseFloat(sale.tps || 0), 0).toFixed(2)],
            ['TVQ', sales.reduce((sum, sale) => sum + parseFloat(sale.tvq || 0), 0).toFixed(2)],
            ['Total revenus', sales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0).toFixed(2)]
        ];
        
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Résumé');
        
        // Générer le fichier
        const periodLabel = period === 'week' ? 'semaine' : period === 'month' ? 'mois' : 'toutes';
        const filename = `ventes_${periodLabel}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, filename);
        
        showMessage(`Export Excel réussi : ${sales.length} vente(s) exportée(s)`, 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export Excel:', error);
        showMessage('Erreur lors de l\'export Excel', 'error');
    }
}

function exportToPDF(sales, period) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // En-tête
        doc.setFontSize(18);
        doc.setTextColor(138, 43, 226);
        doc.text('Rapport des Ventes - SwiftPOS', 14, 20);
        
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        const periodLabel = period === 'week' ? 'Cette semaine' : period === 'month' ? 'Ce mois' : 'Toutes les ventes';
        doc.text(`Période: ${periodLabel}`, 14, 30);
        doc.text(`Date d'export: ${new Date().toLocaleString('fr-CA')}`, 14, 36);
        
        // Résumé
        let yPos = 50;
        doc.setFontSize(14);
        doc.text('Résumé', 14, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        const totalSales = sales.length;
        const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
        const totalDiscount = sales.reduce((sum, sale) => sum + parseFloat(sale.totalDiscount || 0), 0);
        const totalSubtotal = sales.reduce((sum, sale) => sum + parseFloat(sale.subtotal || 0), 0);
        
        doc.text(`Nombre de ventes: ${totalSales}`, 14, yPos);
        yPos += 7;
        doc.text(`Sous-total: $${totalSubtotal.toFixed(2)}`, 14, yPos);
        yPos += 7;
        if (totalDiscount > 0) {
            doc.setTextColor(81, 207, 102);
            doc.text(`Total remises: -$${totalDiscount.toFixed(2)}`, 14, yPos);
            yPos += 7;
            doc.setTextColor(0, 0, 0);
        }
        doc.text(`TPS: $${sales.reduce((sum, sale) => sum + parseFloat(sale.tps || 0), 0).toFixed(2)}`, 14, yPos);
        yPos += 7;
        doc.text(`TVQ: $${sales.reduce((sum, sale) => sum + parseFloat(sale.tvq || 0), 0).toFixed(2)}`, 14, yPos);
        yPos += 7;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Total revenus: $${totalRevenue.toFixed(2)}`, 14, yPos);
        yPos += 15;
        
        // Détails des ventes
        doc.setFontSize(14);
        doc.setFont(undefined, 'normal');
        doc.text('Détails des ventes', 14, yPos);
        yPos += 10;
        
        doc.setFontSize(8);
        let pageNum = 1;
        
        sales.forEach((sale, saleIndex) => {
            // Nouvelle page si nécessaire
            if (yPos > 270) {
                doc.addPage();
                pageNum++;
                yPos = 20;
            }
            
            const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
            const dateStr = saleDate.toLocaleDateString('fr-CA') + ' ' + saleDate.toLocaleTimeString('fr-CA');
            
            doc.setFont(undefined, 'bold');
            doc.text(`Vente #${sale.id.substring(0, 8)} - ${dateStr}`, 14, yPos);
            yPos += 6;
            doc.setFont(undefined, 'normal');
            doc.text(`Vendeur: ${sale.userName || 'N/A'}`, 14, yPos);
            yPos += 6;
            
            // Articles
            if (sale.items && sale.items.length > 0) {
                sale.items.forEach(item => {
                    if (yPos > 270) {
                        doc.addPage();
                        yPos = 20;
                    }
                    const itemTotal = item.quantity * parseFloat(item.price || 0);
                    const discount = item.discount || 0;
                    doc.text(`  • ${item.name} (x${item.quantity}) - $${parseFloat(item.price || 0).toFixed(2)} = $${itemTotal.toFixed(2)}${discount > 0 ? ` (Remise: -$${discount.toFixed(2)})` : ''}`, 20, yPos);
                    yPos += 5;
                });
            }
            
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.text(`Sous-total: $${parseFloat(sale.subtotal || 0).toFixed(2)}`, 20, yPos);
            yPos += 5;
            if (sale.totalDiscount > 0) {
                doc.setTextColor(81, 207, 102);
                doc.text(`Remises: -$${parseFloat(sale.totalDiscount || 0).toFixed(2)}`, 20, yPos);
                yPos += 5;
                doc.setTextColor(0, 0, 0);
            }
            doc.text(`TPS: $${parseFloat(sale.tps || 0).toFixed(2)}`, 20, yPos);
            yPos += 5;
            doc.text(`TVQ: $${parseFloat(sale.tvq || 0).toFixed(2)}`, 20, yPos);
            yPos += 5;
            doc.setFont(undefined, 'bold');
            doc.text(`Total: $${parseFloat(sale.total || 0).toFixed(2)}`, 20, yPos);
            yPos += 10;
            doc.setFont(undefined, 'normal');
        });
        
        // Pied de page
        const totalPages = doc.internal.pages.length - 1;
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(`Page ${i} / ${totalPages}`, 195, 285, { align: 'right' });
        }
        
        // Télécharger
        const periodLabel2 = period === 'week' ? 'semaine' : period === 'month' ? 'mois' : 'toutes';
        const filename = `ventes_${periodLabel2}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
        
        showMessage(`Export PDF réussi : ${sales.length} vente(s) exportée(s)`, 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export PDF:', error);
        showMessage('Erreur lors de l\'export PDF. Assurez-vous que la bibliothèque jsPDF est chargée.', 'error');
    }
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
    
    // Libérer l'URL
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

function showMessage(message, type = 'success') {
    // Créer un message temporaire
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

