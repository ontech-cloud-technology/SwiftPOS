// Utilitaires pour SwiftPOS

/**
 * Formater un montant en devise
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD'
  }).format(amount);
}

/**
 * Formater une date
 */
export function formatDate(date) {
  if (!date) return '';
  
  const d = date.toDate ? date.toDate() : new Date(date);
  return new Intl.DateTimeFormat('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

/**
 * Valider un email
 */
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Valider un prix
 */
export function isValidPrice(price) {
  const num = parseFloat(price);
  return !isNaN(num) && num >= 0;
}

/**
 * Valider un stock
 */
export function isValidStock(stock) {
  const num = parseInt(stock);
  return !isNaN(num) && num >= 0;
}

/**
 * Afficher une notification
 */
export function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `alert alert-${type}`;
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.zIndex = '10000';
  notification.style.minWidth = '300px';
  notification.style.animation = 'fadeIn 0.3s ease';
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

/**
 * Confirmer une action
 */
export function confirmAction(message) {
  return confirm(message);
}

/**
 * Calculer les taxes (TPS/TVQ)
 */
export function calculateTaxes(subtotal) {
  const tps = subtotal * 0.05; // TPS 5%
  const tvq = subtotal * 0.09975; // TVQ 9.975%
  const total = subtotal + tps + tvq;
  
  return {
    subtotal,
    tps,
    tvq,
    total
  };
}


