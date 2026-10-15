# Clinic Booking System 1

Formulaire mobile en français pour demander un rendez-vous. Les demandes sont enregistrées avec le statut **PENDING** (en attente) ; envoyer le formulaire ne confirme jamais automatiquement un rendez-vous.

## Fichiers du projet

- `index.html`, `styles.css`, `app.js` : formulaire responsive, sans animation, avec une question par écran, retour/continuer, progression, validation, conservation des réponses, vérification et états de réussite/erreur.
- `config.js` : paramètres publics. L’adresse du service est vide jusqu’au déploiement Google Apps Script.
- `apps-script/Code.gs` : validation côté serveur, écriture dans Google Sheets, protection contre les doubles envois, notifications e-mail et confirmation manuelle avec vérification des conflits.
- `.gitignore` : exclut les fichiers locaux courants ; aucun secret ni dossier patient ne doit être commité.

## Publication du site avec GitHub Pages

1. Ouvrez le dépôt GitHub, puis **Settings → Pages**.
2. Dans **Build and deployment**, choisissez **Deploy from a branch**.
3. Sélectionnez la branche **main** et le dossier **/ (root)**.
4. Appuyez sur **Save**. Sur tablette, activez si nécessaire **⋮ → Site pour ordinateur** ou faites pivoter l’écran en mode paysage.
5. Attendez quelques minutes et revenez dans **Settings → Pages**. Utilisez uniquement l’adresse HTTPS affichée par GitHub comme URL publiée.
6. Le site statique peut fonctionner sans Google, mais le formulaire n’enverra aucune demande tant que l’adresse Apps Script n’est pas configurée.

GitHub Pages n’héberge pas le serveur Google Apps Script. Je ne peux pas affirmer que Pages est publié tant que GitHub ne montre pas l’URL et qu’elle n’a pas été vérifiée.

## Configuration Google Sheets / Apps Script (à faire une fois avec le compte Google de la clinique)

1. Dans Google Drive, créez un classeur Google Sheets vide. Ne partagez pas ce classeur publiquement.
2. Ouvrez le classeur puis **Extensions → Apps Script**.
3. Dans l’éditeur Apps Script, ouvrez le fichier `Code.gs`. Remplacez son contenu par le contenu du fichier `apps-script/Code.gs` de ce dépôt.
4. Dans Apps Script, ouvrez **Paramètres du projet** (icône engrenage) → **Propriétés du script** → **Ajouter une propriété de script**. Ajoutez :
   - `SPREADSHEET_ID` = la partie de l’adresse du classeur située entre `/d/` et `/edit`
   - `CLINIC_NAME` = le nom de la clinique
   - `ADMIN_EMAIL` = l’adresse e-mail qui doit recevoir les nouvelles demandes
5. Enregistrez les propriétés. Dans les paramètres du projet, choisissez le fuseau horaire **Africa/Algiers** si ce réglage est disponible.
6. Dans l’éditeur, choisissez la fonction `setup` dans la liste près du bouton **Exécuter**, puis cliquez sur **Exécuter**. Autorisez les permissions Google demandées. La fonction crée les onglets `Appointments`, `Settings` et `AuditLog), avec leurs en-têtes ; elle ne doit pas effacer les lignes existantes.
7. Cliquez sur **Déployer → Nouveau déploiement**. Choisissez le type **Application Web**.
8. Réglez **Exécuter en tant que** sur votre compte, puis choisissez l’accès adapté. Pour que les patients puissent envoyer une demande sans connexion Google, l’accès doit généralement être public. Cela rend le point d’entrée accessible depuis Internet : faites d’abord un essai et n’utilisez pas de vraies données médicales sensibles.
9. Cliquez sur **Déployer**, accordez les autorisations si Google le demande, puis copiez l’URL de l’application Web qui se termine par `/exec`.
10. Dans `config.js` sur GitHub, appuyez sur le crayon **Edit**, remplacez la valeur vide de `endpoint` par cette URL, puis enregistrez le changement avec un commit. L’URL n’est pas un mot de passe ; ne placez jamais d’identifiant de classeur, jeton secret ou donnée patient dans ce fichier.
11. Attendez que GitHub Pages se mette à jour. Ouvrez le site publié et faites un essai avec des coordonnées fictives. Vérifiez qu’une seule ligne apparaît dans `Appointments`, que le statut est `PENDING`, et que les e-mails sont bien reçus.

### Vérifier une demande avant de l’utiliser réellement

- La fonction `doGet` permet de vérifier si le point d’entrée répond, mais ne prouve pas que Google Sheets ou les e-mails fonctionnent.
- Un envoi réussi doit retourner un numéro de référence et afficher un état d’attente. Si l’URL n’est pas configurée, le site indique clairement que rien n’a été envoyé.
- Les notifications e-mail dépendent des autorisations et quotas Google. Consultez la colonne `Last Notification Status` dans `Appointments`.

## Confirmer un rendez-vous manuellement

Les demandes sont enregistrées comme **PENDING**. Le formulaire ne présente pas de calendrier de disponibilités réelles et ne réserve pas automatiquement de créneau.

Pour confirmer une demande après avoir vérifié le patient et les disponibilités :

1. Dans Apps Script, ouvrez **Paramètres du projet → Propriétés du script**.
2. Ajoutez `PENDING_BOOKING_ID` = le numéro de référence exact de la demande.
3. Ajoutez `PENDING_START_ISO` = la date et l’heure exactes au format local `AAAA-MM-JJTHH:MM`, par exemple `2026-11-03T10:30`. Utilisez l’heure locale de la clinique.
4. Enregistrez. Dans l’éditeur, choisissez `confirmPendingBooking`, puis cliquez sur **Exécuter**.
5. Si le créneau chevauche un autre rendez-vous confirmé, la fonction refuse la confirmation. Elle vérifie aussi les jours et horaires d’ouverture définis dans l’onglet `Settings`.
6. Après l’exécution, vérifiez la ligne dans `Appointments` : le statut doit être `CONFIRMED` et `Confirmed Start At` doit contenir l’heure exacte.
7. Supprimez les propriétés `PENDING_BOOKING_ID` et `PENDING_START_ISO` si elles n’ont pas été supprimées automatiquement.

Cette procédure est destinée au propriétaire connecté à Apps Script ; ne créez pas de mot de passe administrateur dans le JavaScript public. Pour l’instant, aucune interface d’administration publique, de reprogrammation ou d’annulation autonome n’est fournie.

## Limites et sécurité

- Le dépôt est public : ne commitez jamais de données patient, identifiants de compte, jetons, identifiant de classeur, ni URL contenant des secrets.
- Le classeur doit rester privé et accessible uniquement aux personnes autorisées.
- Le champ de message est limité à 300 caractères ; demandez aux patients de ne pas saisir d’informations médicales sensibles.
- Les demandes sont des demandes, pas des rendez-vous confirmés. Le formulaire ne consulte pas les disponibilités en direct.
- La prévention des chevauchements s’applique lors de la confirmation manuelle des rendez-vous, si les heures confirmées sont saisies correctement.
- Avant tout usage réel, le propriétaire de la clinique doit vérifier les exigences locales de protection des données, la politique de conservation et de suppression, les autorisations Google et les quotas Apps Script/MailApp.

## Tests et statut d’intégration

Le code source seul ne peut pas prouver que GitHub Pages est publié, que le classeur est autorisé, que l’application Web est déployée ou que les e-mails arrivent. Ces vérifications doivent être faites dans les comptes Google et GitHub concernés.