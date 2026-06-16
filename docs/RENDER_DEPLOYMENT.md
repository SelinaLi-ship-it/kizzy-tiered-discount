# Render deployment guide

This app is ready to deploy as a Docker web service on Render's free tier for classroom/demo use.

## 1. Push the project to GitHub

Commit the project and push it to a GitHub repository that Render can access.

## 2. Create the Render service

In Render, create a new Blueprint from the repository. Render will read `render.yaml`.

The Blueprint creates:

- A Docker web service
- `DATABASE_URL=file:/tmp/dev.sqlite` for Shopify session storage

This free demo setup does not use a persistent disk. If Render restarts the service, Shopify session data can be lost and the app may need to be opened or reinstalled again.

## 3. Add secret environment variables

In the Render service settings, set these variables:

```text
SHOPIFY_API_KEY=<from Shopify Dev Dashboard>
SHOPIFY_API_SECRET=<from Shopify Dev Dashboard>
SHOPIFY_APP_URL=https://<your-render-service>.onrender.com
```

The following variables are already declared in `render.yaml`:

```text
NODE_ENV=production
DATABASE_URL=file:/tmp/dev.sqlite
SCOPES=read_discounts,write_discounts
```

## 4. Deploy

Trigger a Render deploy. The Docker image runs:

```text
npm run setup
npm run start
```

`npm run setup` generates Prisma Client and creates the local SQLite session table.

## 5. Update Shopify app URLs

After Render provides the production URL, update the Shopify app configuration.

In `shopify.app.toml`, set:

```toml
application_url = "https://<your-render-service>.onrender.com"

[auth]
redirect_urls = [
  "https://<your-render-service>.onrender.com/auth/callback"
]
```

Then deploy the app configuration:

```shell
shopify app deploy --allow-updates
```

## 6. Test on the dev store

Install or open the app on `kizzy-dev-store.myshopify.com`.

Verify:

- The app home loads from the Render URL
- Existing partner codes are listed
- A new partner code can be created
- The new code applies the shared tiered rule at checkout

## Shared tier rule

All partner codes use the same Shopify Function:

```text
tiered-order-discount
```

Discount tiers:

```text
Below 50: no discount
50 to 999.99: 5%
1000 to 4999.99: 10%
5000 and above: 15%
```
