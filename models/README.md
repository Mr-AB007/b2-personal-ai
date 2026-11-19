# B2 model versions

Each version is a folder with a `Modelfile` (the "recipe"). Build one with:

```
build_model.bat v1
```

That creates `b2:v1` in Ollama and points the nickname **`b2:latest`** at it. The chat app always uses
`b2:latest`, so upgrading is: make a new folder, build it, done. To **roll back**, rebuild the old version.

| Version | Base brain | What's new | License of base |
|---|---|---|---|
| v1 | `llama3.2` 3B | Personality, identity and settings baked in (no training) | Llama 3.2 Community License |
| **v2** (now) | `qwen3:4b-instruct-2507-q4_K_M` | Apache 2.0 base (OK to rename and sell), smarter, Hindi/Hinglish. Uses the *Instruct* variant: plain `qwen3:4b` is the always-thinking version (slow) | Apache 2.0 |
| v3 | v2 + **my own LoRA fine-tune** | Trained on my own example chats (style, domain knowledge) | same as base |
| v4 | bigger base (7B–8B) on a rented GPU | Product quality, served to customers from a server | same as base |

## How to make a new version
1. Copy `models/v1` to `models/v2`
2. Edit `models/v2/Modelfile`: change `FROM`, the `SYSTEM` text, or the settings
3. Run `build_model.bat v2`, then test it in the app
4. Note what changed in the table above

## Fine-tuning (v3): teaching B2 with my own data
1. Write 200 to 1000+ example conversations in a `.jsonl` file (question → ideal B2 answer)
2. Fine-tune with **Unsloth** on a free Google Colab GPU (LoRA = only a small "add-on" is trained, fast and cheap)
3. Export the result as a `.gguf` file
4. New Modelfile: `FROM ./b2-v3.gguf`, then run `build_model.bat v3`

## Can I sell B2 as a product?
Short answer: **yes, but the base model's license decides the rules.** (This is not legal advice. Read the license before selling.)

- **Llama 3.2 (v1)**: commercial use is allowed, but if you distribute or offer a model built from it you must
  show "Built with Llama", follow Meta's Acceptable Use Policy, include the license, and **the model's name must start
  with "Llama"** (e.g. "Llama-B2"). Fine for personal use; awkward for a product called "B2".
- **Apache 2.0 / MIT models** (Qwen3, Mistral 7B, Phi-4-mini, IBM Granite, OLMo): you can rename, fine-tune and
  sell with **no naming rules**. Just keep their license/notice file. **Best choice for a product.**
- Your **app code** (the React UI, server, web search) is 100% yours either way.
- Your **training data** must be yours or properly licensed too.
