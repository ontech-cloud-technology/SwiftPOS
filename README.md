# ⚡ SwiftPOS

Application Web Point de Vente (POS) Premium avec Firebase

## 🚀 Démarrage Rapide

### Prérequis
- Un compte Firebase
- Un projet Firebase configuré
- Python 3 (pour le serveur de développement)

### Installation

1. **Cloner ou télécharger le projet**

2. **Configurer Firebase**
   - Créez un projet sur [Firebase Console](https://console.firebase.google.com/)
   - Activez Authentication (Email/Password)
   - Activez Firestore Database
   - Activez Storage
   - Copiez votre configuration Firebase dans `js/firebase-config.js`

3. **Démarrer le serveur de développement**
   ```bash
   python3 server.py
   ```
   Ou sur un port spécifique :
   ```bash
   python3 server.py 3000
   ```

4. **Ouvrir dans le navigateur**
   - Accédez à `http://localhost:3000` (ou le port que vous avez choisi)

## 📁 Structure du Projet

```
SwiftPOS/
├── index.html              # Page de connexion
├── admin.html              # Dashboard administrateur
├── user.html               # Dashboard caissier (Point de vente)
├── css/
│   ├── style.css          # Styles globaux
│   ├── login.css          # Styles login
│   └── dashboard.css      # Styles dashboards
├── js/
│   ├── firebase-config.js # Configuration Firebase
│   ├── auth.js            # Gestion authentification
│   ├── firestore.js       # Opérations Firestore
│   ├── storage.js         # Gestion Storage
│   ├── admin.js           # Logique admin
│   ├── user.js            # Logique caissier
│   └── login.js           # Script login
├── firestore.rules        # Règles de sécurité Firestore
└── server.py              # Serveur de développement
```

## 🔥 Configuration Firebase

### Collections Firestore

#### `users`
```javascript
{
  name: string,
  email: string,
  role: 'admin' | 'user',
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### `products`
```javascript
{
  name: string,
  price: number,
  category: string,
  stock: number,
  imageUrl: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### `sales`
```javascript
{
  userId: string,
  userName: string,
  items: Array<{
    productId: string,
    name: string,
    price: number,
    quantity: number
  }>,
  subtotal: number,
  tps: number,
  tvq: number,
  total: number,
  createdAt: timestamp
}
```

### Règles de Sécurité

Les règles Firestore sont définies dans `firestore.rules` :
- **Admin** : Accès complet à toutes les collections
- **User** : Peut lire les produits, créer et lire ses propres ventes
- **Users** : Peut lire son propre profil

## 👥 Rôles Utilisateurs

### Admin
- Gestion des comptes utilisateurs
- Gestion des produits
- Consultation de toutes les ventes
- Statistiques globales

### User (Caissier)
- Point de vente (interface de caisse)
- Consultation de ses propres ventes
- Gestion du panier

## 🎨 Design

Le design utilise une palette de couleurs premium :
- **Noir** : `#0a0a0a`, `#1a1a1a`
- **Bleu/Mauve** : `#8a2be2` (BlueViolet), `#9370db` (MediumPurple), `#4169e1` (RoyalBlue)
- **Blanc** : `#ffffff`

Effets glassmorphism et animations fluides pour une expérience utilisateur premium.

## 📝 Fonctionnalités

- ✅ Authentification Firebase
- ✅ Dashboard Admin avec statistiques
- ✅ Point de vente (interface caissier)
- ✅ Gestion des produits
- ✅ Gestion des ventes
- ✅ Calcul automatique des taxes (TPS/TVQ)
- ✅ Gestion du stock
- ✅ Design responsive

## 🔒 Sécurité

- Règles Firestore pour protéger les données
- Vérification des rôles côté client et serveur
- Validation des formulaires
- Protection des routes

## 🚧 À Implémenter

- [ ] Page de gestion des comptes (accounts.html)
- [ ] Page de gestion des produits (products.html)
- [ ] Page d'historique des ventes (sales-history.html)
- [ ] Upload d'images pour les produits
- [ ] Export des ventes
- [ ] Recherche et filtres avancés

## 📄 Licence

Ce projet est un projet personnel de développement.

