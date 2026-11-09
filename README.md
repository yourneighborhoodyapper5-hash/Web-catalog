# KairoPeer

I made KairoPeer for people who want a useful answer without losing sight of where it came from. Search a question, scan the source links, and let an Ollama Cloud summary help you get oriented. Google, Bing, and DuckDuckGo are always one click away when I want to explore beyond the included results.

## What I built

- A responsive search page with direct links to Google, Bing, and DuckDuckGo.
- Search results and short extracts from Wikipedia's public search API.
- Optional Ollama Cloud summaries grounded in the results, with numbered links back to their sources.
- A Firebase callable function that keeps the Ollama API key out of the browser.

## Connect Ollama Cloud through Firebase

1. In the [Firebase Console](https://console.firebase.google.com/), select the `api-holder-catalog` project. Make sure billing is enabled for the project; deploying Cloud Functions may require the Blaze plan.
2. In Firebase, open **Firestore Database → Data**. Create a collection named `settings`, then create a document with ID `ollama`. Add one field: `model` (type **string**) with the exact Ollama Cloud model name available to your account, such as `gemma3:latest` if that is the model you use. Do not add the API key or a `baseUrl` field to this document.
3. Create an Ollama Cloud API key in your Ollama account. Keep it private.
4. Install the Firebase CLI if needed (`npm install -g firebase-tools`), sign in (`firebase login`), and from this repository's directory store the key as a Firebase Functions secret:

   ```sh
   firebase functions:secrets:set OLLAMA_API_KEY --project api-holder-catalog
   ```

   Paste the key only into the CLI prompt. Do not commit it, put it in `app.js`, or store it in Firestore.
5. In Firebase Console, open **App Check**, register the web app with the reCAPTCHA v3 provider, and add your deployed site domain. Copy the **site key** (not the secret key) into `app.js`, replacing `REPLACE_WITH_FIREBASE_APP_CHECK_RECAPTCHA_V3_SITE_KEY`.
6. Deploy the callable function and Firestore rules from this repository:

   ```sh
   firebase deploy --only functions:ollamaChat,firestore:rules --project api-holder-catalog
   ```

   The function uses the fixed Ollama Cloud endpoint `https://ollama.com/api/chat`; its API key is injected server-side from Firebase Secret Manager. The client calls the function in `us-central1`.
7. In Firebase App Check, monitor requests and then enforce App Check for Cloud Functions. The function itself requires valid App Check tokens.

The website can still show its search sources if Ollama Cloud is unavailable. The AI answer uses the `model` value from Firestore and keeps the original links visible so I can check the sources myself.

## Notes

The built-in result list uses Wikipedia search, not a general-purpose index of the whole web. The Google, Bing, and DuckDuckGo links open full searches for the same query. AI answers can be incomplete or incorrect, so I keep the original sources visible alongside them.
