# Cloudflare Workers AI

The Node backend calls Cloudflare Workers AI directly using its OpenAI-compatible endpoint. Groq and OpenRouter are not fallback providers. The fixed model is `@cf/google/gemma-4-26b-a4b-it`, which supports vision and function calls and is not a paid-billing-required frontier model. Web and Wikipedia tools still execute on the Slipstream backend.

Set both server-only environment variables:

```dotenv
CLOUDFLARE_API_TOKEN=your-workers-ai-token
CLOUDFLARE_ACCOUNT_ID=your-32-character-account-id
```

The token needs Workers AI access for that account. Find the Account ID in Cloudflare Dashboard → Workers AI → Use REST API. Never put either credential in public scripts, Git, or frontend-prefixed variables. Redeploy/restart after changing the server environment. These variables configure the existing Node backend, not a separately deployed Cloudflare Worker.

## Free usage only

Keep this Cloudflare account on **Workers Free**, without paid-plan or AI Gateway prepaid billing. Cloudflare includes 10,000 Neurons daily, shared across account usage, resetting at 00:00 UTC. On Free, requests fail after the allowance is exhausted. On Paid, overages can be billed even for this same model. Choosing the model alone does not prevent paid-account charges.

Slipstream does not upgrade plans, configure billing, use AI Gateway credits, select a paid-required model, or retry through another provider. It stops on provider limit/billing errors. It cannot inspect the account's plan or enforce the account-wide free allowance with an AI-only token. Free-only operation therefore requires the Free plan in Cloudflare's dashboard.

A request has a maximum of 1,500 output tokens and up to four research rounds. Images and research follow-up requests also consume the daily allowance. The app supports at most three images across a conversation.

Configuration tests and mocked provider/tool tests can run without credentials. A live completion requires both account ID and token. Do not report a live completion as tested when only token verification succeeded.

Official references: [pricing and free allowance](https://developers.cloudflare.com/workers-ai/platform/pricing/), [REST setup](https://developers.cloudflare.com/workers-ai/get-started/rest-api/), [Gemma model](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/).
