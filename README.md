# VSOP Poker Championship Tracker

Suivi de championnat de poker (saisons scolaires, journées, horloge de tournoi,
classement général et 7/2). Front **Vite + React + TypeScript**, back
**Supabase** (Postgres + Auth + Realtime), déploiement **Vercel**.

Thème tapis vert / doré, optimisé mobile pour la saisie en direct.

## Structure

```
/supabase            Schéma SQL (migrations), RLS, config locale
/web                 App front (Vite + React + TS)
  /src/domain        Logique métier pure + tests (points, ranking, payout, …)
  /src/api           Wrappers Supabase par entité
  /src/features      Écrans admin + public
vercel.json          Build + rewrites SPA
```

## Fonctionnement métier

- **Saison** = année scolaire (`2026/2027`). Config : cave, table de payouts (par
  total misé), répartition des jetons, barème de points, structure de blinds.
- **Journée** : sélection des participants, option « compte double », saisie en
  direct des recaves (R1, R2…), des mains 7/2 et des éliminations (rang attribué
  dans l'ordre d'élimination). Bouton **Annuler** (undo du dernier événement).
- **Classement journée** : non-recavers d'abord (vainqueur 1er, puis ordre
  inverse d'élimination), puis recavers en ordre **inverse** de recave (1er à
  recaver = dernier).
- **Payout** : résolu sur le total misé exact (= (participants + recaves) × cave).
- **Classement général & 7/2** : agrégés par la vue `season_standings`.
- **Horloge** : état serveur (`tournament_clock`) synchronisé en temps réel,
  visible via lien **public** sans login. Durée unique par saison pour tous les
  niveaux, chacun défini uniquement par SB et BB. Son + flash à chaque changement.

## Mise en route (local)

```bash
cd web
cp .env.example .env            # renseigner URL + anon key Supabase
npm install
npm run dev                     # http://localhost:5173
npm test                        # tests du domaine métier
```

### Base de données

Appliquer les migrations dans `supabase/migrations/` sur le projet Supabase
(via `supabase db push` ou l'éditeur SQL du dashboard).

### Compte admin

L'inscription publique est désactivée. Créer **un seul** utilisateur admin
depuis le dashboard Supabase (Authentication → Users → Add user, email +
password). Cet utilisateur a tous les droits d'écriture ; les visiteurs anonymes
n'ont qu'un accès lecture.

## Déploiement (Vercel)

1. Importer le repo dans Vercel.
2. Variables d'environnement : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. `vercel.json` gère le build (`web/`) et les rewrites SPA.

## Routes

| URL                                   | Accès   | Rôle                         |
| ------------------------------------- | ------- | ---------------------------- |
| `/c`                                  | public  | Choix de la saison           |
| `/c/:season`                          | public  | Classement général           |
| `/c/:season/seven-two`                | public  | Classement 7/2               |
| `/c/:season/results`                  | public  | Résultats des journées       |
| `/c/:season/clock/:gameday`           | public  | Horloge (lecture seule)      |
| `/admin/login`                        | public  | Connexion admin              |
| `/admin/seasons`                      | admin   | Saisons & config             |
| `/admin/players`                      | admin   | Membres                      |
| `/admin/gameday/:id/live`             | admin   | Saisie en direct (mobile)    |
| `/admin/gameday/:id/clock`            | admin   | Contrôles horloge            |
| `/admin/gameday/:id/validate`         | admin   | Payout & validation          |
