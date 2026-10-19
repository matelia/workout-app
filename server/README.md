# Snapshot server (home laptop)

A small FastAPI server that runs on your spare Windows laptop. The phone sends it a photo over **Tailscale**. It asks a **local Ollama vision model** what's in it and sends back draft nutrition. The app always shows a review screen before anything is logged.

- **Label photo:** the model copies the numbers off the label, and the server converts them to per 100 g.
- **Meal photo:** the model only lists foods and estimated grams; it never guesses calories. The server looks each food up in **USDA FoodData Central**.
- **Barcodes and saved meals** never use this server.
- **If the laptop is off**, the app queues the photo and retries automatically when the app is opened again.

Everything here is free: Ollama, the model, Tailscale's personal plan, and the USDA API.

## 1. One-time setup on the laptop

1. **Install Python 3.11+** from https://www.python.org/downloads/. Tick "Add python.exe to PATH".
2. **Install Ollama** from https://ollama.com/download, then pull a vision model in a terminal:

   ```bash
   ollama pull qwen2.5vl:7b
   ```

   This needs about 8 GB of free RAM. On a weaker laptop, use `qwen2.5vl:3b` instead, and set `OLLAMA_MODEL` to match in step 4.
3. **Install Tailscale** from https://tailscale.com/download. Sign in with the same account as on your iPhone, and note the laptop's name or 100.x.y.z address.
4. **Set up the server.** Copy this `server` folder to the laptop, open a terminal in it, and run:

   ```bash
   python -m venv .venv
   .venv\Scripts\pip install -r requirements.txt
   copy .env.example .env
   ```

   Then edit `.env`:
   - `SNAPSHOT_TOKEN`: any long random string.
   - `USDA_API_KEY`: a free key from https://fdc.nal.usda.gov/api-key-signup. Strongly recommended: `DEMO_KEY` allows only about 10 lookups an hour, and each meal photo uses one per food.
5. **Allow port 8000 through Windows Firewall.** Run this once in an *administrator* terminal:

   ```bash
   netsh advfirewall firewall add rule name="Snapshot server" dir=in action=allow protocol=TCP localport=8000
   ```

## 2. Run it

Double-click `start.bat`, or run `.venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000`.

Check that it's up by opening http://localhost:8000/health in a browser on the laptop. It should say `"ok": true` and `"model_ready": true`. If you set a token, the browser shows "Bad or missing token" instead. That means the server is up.

**Start it automatically:** open Task Scheduler → Create Basic Task → "When I log on" → Start a program → choose `start.bat`.

**Keep the laptop awake:** go to Settings → System → Power and set sleep to "Never" while plugged in.

## 3. Connect the phone

1. Turn on Tailscale on the iPhone.
2. In the app, go to **Food → ⚙︎ Settings → Snapshot server**:
   - Address: `http://<laptop-name>:8000`, or `http://100.x.y.z:8000`
   - Shared token: the same value as `SNAPSHOT_TOKEN`
3. Tap **Test connection**. It should say "Connected. Model: …".

## API

| Route | Body | Returns |
| --- | --- | --- |
| `GET /health` | — | `{ok, model, model_ready}` |
| `POST /label` | multipart `photo` | `{kind:"label", food:{name, serving_g, kcal_100g, protein_100g, carbs_100g, fat_100g}}` |
| `POST /menu` | multipart `photos` (1–8 screenshots) | `{kind:"menu", items:[{name, serving_g, kcal, protein_g, …, sodium_mg}]}` |
| `POST /recipe` | multipart `photos` (1–8 screenshots) | `{kind:"recipe", recipe:{name, servings, ingredients, steps, nutrition_per_serving, estimated}}` |
| `POST /recipe/nutrition` | JSON `{ingredients, servings}` | `{per_serving, matched, missing}` (model → grams, USDA → nutrition) |
| `POST /chat` | JSON `{messages, context}` | `{reply}` (the coach; uses `OLLAMA_CHAT_MODEL`) |
| `POST /plan` | JSON `{goals, context, exercises}` | `{summary, routines:[{name, weekday, exercises:[{name, sets, reps}]}]}` |
| `POST /meal` | multipart `photo` | `{kind:"meal", items:[{name, grams, usda:{fdc_id, description, kcal_100g, …} \| null}]}` |

Every route requires the `X-Token` header when `SNAPSHOT_TOKEN` is set.

## Notes

- USDA matches are a best guess: "white rice, cooked" can come back as "Rice, white, cooked, glutinous". The review screen shows the matched name, so fix the numbers there if it looks wrong.
- Photos are not stored on the laptop. They're processed in memory and discarded.
- Mind data never goes to this server.
