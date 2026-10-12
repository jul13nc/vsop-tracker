# VSOP Tracker

Application web de suivi d’un championnat de poker scolaire. Frontend React/TypeScript/Vite, PostgreSQL/Auth/Realtime Supabase et hébergement Vercel.

## Développement local

Prérequis : Node.js 20.19+ et Docker.

```sh
npm --prefix web install
npx supabase start
```

Supabase local utilise ports alternatifs `55421` (API), `55432` (Postgres), `55423` (Studio) et `55424` (Mailpit), pour éviter collisions avec autres projets locaux. Copiez clés publiques imprimées par `npx supabase status --output env` dans `web/.env` :

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:55421
VITE_SUPABASE_ANON_KEY=<PUBLISHABLE_KEY>
```

Puis lancez frontend et vérifications :

```sh
npm --prefix web run dev
npm --prefix web test
npm --prefix web run lint
npm --prefix web run build
npx supabase test db
```

## Premier organisateur

1. Créez compte via Supabase Auth (local : Studio/Auth ou API Auth).
2. Depuis Supabase SQL Editor, promouvoir premier compte :

```sql
update public.profiles set role = 'organizer' where email = 'votre-email@example.com';
```

3. Connectez-vous, créez membres/saison, puis invitez lecteurs par adresse e-mail depuis onglet **Membres**. L’Edge Function `invite-reader` envoie e-mail d’invitation Supabase; invitation donne accès lecture à cette application et aucun droit d’écriture.

## Supabase hébergé

Créez un projet Supabase et appliquez `supabase/migrations/20261013090000_poker_championship.sql` via `npx supabase link --project-ref <ref>` puis `npx supabase db push`. Réglez répertoire racine du projet Vercel sur `web`, commande build `npm run build`, et variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (clé publishable). Configurez URL de production comme Site URL et redirect URL dans Auth. Déployez Edge Function avec `npx supabase functions deploy invite-reader`. Clé secrète/service-role ne doit jamais être ajoutée au frontend.

Les saisons terminées restent consultables. Ajouter configuration de saison est permis pour futures journées; chaque journée conserve son snapshot. Les changements de saison clôturée et toute édition d’une partie terminée sont refusés par base de données.
