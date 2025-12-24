#!/usr/bin/env python3
"""
Serveur de développement simple pour SwiftPOS
Démarre un serveur HTTP pour servir les fichiers statiques
"""

import http.server
import socketserver
import os
import sys
from pathlib import Path

# Port par défaut
PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Handler personnalisé avec support CORS et logging"""
    
    def end_headers(self):
        # Ajouter les headers CORS pour le développement
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def log_message(self, format, *args):
        """Log personnalisé avec couleurs"""
        print(f"\033[92m[INFO]\033[0m {args[0]} - {args[1]}")

def main():
    # Changer vers le répertoire du script
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    # Vérifier si le port est disponible
    try:
        with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
            print("\n" + "="*60)
            print(f"\033[94m🚀 Serveur de développement SwiftPOS\033[0m")
            print("="*60)
            print(f"\033[92m✓\033[0m Serveur démarré sur http://localhost:{PORT}")
            print(f"\033[92m✓\033[0m Répertoire: {script_dir}")
            print(f"\033[92m✓\033[0m Appuyez sur Ctrl+C pour arrêter")
            print("="*60 + "\n")
            
            httpd.serve_forever()
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"\033[91m✗\033[0m Erreur: Le port {PORT} est déjà utilisé")
            print(f"   Essayez un autre port: python3 server.py {PORT + 1}")
            sys.exit(1)
        else:
            raise
    except KeyboardInterrupt:
        print("\n\n\033[93m⚠\033[0m Serveur arrêté par l'utilisateur")
        sys.exit(0)

if __name__ == "__main__":
    # Permettre de spécifier un port personnalisé
    if len(sys.argv) > 1:
        try:
            PORT = int(sys.argv[1])
        except ValueError:
            print(f"\033[91m✗\033[0m Erreur: Port invalide '{sys.argv[1]}'")
            sys.exit(1)
    
    main()


