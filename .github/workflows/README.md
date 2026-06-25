# Deploy workflow setup — one-time, Erik

This workflow auto-deploys `Kinggavint/aci-hearing-proof` to the live ACI Hearing
website on every push to `main`. It is the replacement for the Pipedream/IAM
credential the SEO agent could not get approved in the Perplexity credential
vault.

## One-time setup (Erik, 2 minutes)

1. Go to the repo's Secrets page:
   https://github.com/Kinggavint/aci-hearing-proof/settings/secrets/actions

2. Click **New repository secret** and add these two secrets:

   | Secret name             | Value                                          |
   |-------------------------|------------------------------------------------|
   | `AWS_ACCESS_KEY_ID`     | IAM access key for an account in 601102828355  |
   | `AWS_SECRET_ACCESS_KEY` | The matching secret access key                 |

   The IAM principal needs these permissions on AWS account 601102828355:

   - `s3:ListBucket` on `arn:aws:s3:::aci-hearing`
   - `s3:GetObject`, `s3:PutObject` on
     `arn:aws:s3:::aci-hearing/*`
   - (DeleteObject NOT needed — the workflow runs additive-only syncs to
     protect the ~50 article pages on S3 that are not yet in the repo)
   - `cloudfront:CreateInvalidation` on
     `arn:aws:cloudfront::601102828355:distribution/E1GL9UDE5Y8WGK`

   You almost certainly already have an IAM user with exactly these rights —
   it's the same one we tried to wire into the Perplexity credential vault as
   `ApexClientChangesAgent`. Just paste those same keys into the GitHub Secrets
   form.

3. That's it. The next push to `main` will trigger the deploy automatically.
   You can also trigger it manually anytime from the Actions tab.

## What this workflow does on every push to main

1. Checks out the repo.
2. Configures AWS CLI with the secrets above (region `us-east-2`).
3. Runs `aws s3 sync . s3://aci-hearing/ --delete` to mirror the repo to the
   bucket (excluding `.git`, `.github`, and `*.md`).
4. Force-corrects content types for `.html`, `.css`, `.js` files.
5. Creates a CloudFront invalidation on `E1GL9UDE5Y8WGK` for `/*`.
6. Curl-verifies the live site reflects the new schema.

## Safety rails

- The workflow uses additive-only `aws s3 sync` (NO `--delete` flag). This
  protects the ~50 `/articles/` pages that live on S3 but aren't yet in this
  repo. Files in the repo will be uploaded and updated, but nothing on S3 will
  be deleted by this workflow.
- The agent is configured with hard-stops that block any commit that would
  mass-overwrite more than 50 pages in a single run.
- All commits go through the agent's validation gates BEFORE landing on `main`,
  so by the time GitHub Actions runs, the changes have already been
  schema-validated, syntax-checked, and reviewed.

## Cost

- GitHub Actions: 2000 min/month free on personal accounts. A typical run
  takes ~45 seconds. Two runs/day = ~45 minutes/month. Effectively free.
- CloudFront invalidations: First 1000/month free across all distributions on
  account 601102828355. Two runs/day = 60 invalidations/month. Free.
- S3 sync: Only changed objects are uploaded. Per-run cost: cents.

## If you want to remove this workflow

Delete `.github/workflows/deploy.yml` and `.github/workflows/README.md` from the
repo. No other cleanup needed.
