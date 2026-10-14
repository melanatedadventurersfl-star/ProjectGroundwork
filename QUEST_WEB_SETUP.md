# QUEST Web Pilot | GitHub Pages

This isolated `quest-web-pilot` branch contains the standalone QUEST web pilot. It deliberately does not replace `main` or the Project Groundwork application.

## Publish on GitHub Pages

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select **quest-web-pilot** and **/(root)**, then **Save**.
4. Allow the GitHub Pages deployment to finish. The expected project Pages address is:
   `https://melanatedadventurersfl-star.github.io/ProjectGroundwork/`
   Only use it once GitHub reports the site as published.
5. In Supabase go to:
   `https://supabase.com/dashboard/project/hmamgesqnbfopcwfxubt/auth/url-configuration`
6. Set **Site URL** to the exact published HTTPS URL including `/ProjectGroundwork/`, and add that same exact URL in **Redirect URLs**.
7. Under Supabase **Authentication → Providers → Email**, ensure Email sign-in and email confirmation are enabled.
8. Open the published QUEST website, create an account, verify its email, and create the first workspace.

## Status and constraints

- Independent email/password login via Supabase Auth.
- Backed by the dedicated QUEST Improvement Workspace project and row-level security.
- This is a separate pilot, not a live migration of your original ChatGPT Site. Existing records will need an explicit export/import.
- The included Supabase key is a publishable public client key. Do not commit a service-role key.
- Invitations are created inside the workspace, not sent automatically as email.
- GitHub Pages is a static host and does not require a Node server.
- For long-term use, move these site files to a dedicated QUEST repository so GitHub Pages settings do not overlap with Groundwork.
