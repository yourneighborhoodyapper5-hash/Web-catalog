# KairoPeer

I made KairoPeer for people who want a useful answer without losing sight of where it came from. Search a question, scan the source links, and let the Ollama-powered summary help you get oriented. Google, Bing, and DuckDuckGo are always one click away when I want to explore beyond the included results.

## What I built

- A responsive search page with direct links to Google, Bing, and DuckDuckGo.
- Search results and short extracts from Wikipedia's public search API.
- Optional Ollama summaries grounded in the results, with numbered links back to their sources.
- Firebase Firestore configuration for the Ollama endpoint and model name.

## Connecting the AI

I use the Firebase project configuration in `app.js` and keep the Ollama connection settings in a Firestore document at `settings/ollama`. The document has two string fields: `baseUrl` for a browser-reachable Ollama URL and `model` for the model name. The app reads these settings when it prepares an answer. Because a browser loads this document, I only put non-secret configuration there; I do not store credentials or private keys in it.

The browser also needs network access to the configured Ollama URL, and that service needs to allow browser requests from the site's origin. Search works without an available Ollama service; the source links remain usable and the page explains when a summary cannot be loaded.

## Notes

The built-in result list uses Wikipedia search, not a general-purpose index of the whole web. The Google, Bing, and DuckDuckGo links open full searches for the same query. AI answers can be incomplete or incorrect, so I keep the original sources visible alongside them.
