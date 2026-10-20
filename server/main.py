"""
Snapshot server for the workout app.

Runs on the home laptop and is reached from the phone over Tailscale.
Photos are passed to a local Ollama vision model; nothing goes to a paid or cloud AI.

  GET  /health  -> {"ok": true, "model": "...", "model_ready": bool}
  POST /label   (multipart "photo") -> {"kind": "label", "food": {...per 100 g...}}
  POST /meal    (multipart "photo", optional "hints" = JSON list of usual products)
                -> {"kind": "meal", "items": [{"name", "grams", "usda": {...} | null}]}

The meal route never lets the model guess calories: it only names foods and estimates grams.
Nutrition comes from USDA FoodData Central, per 100 g, and the app multiplies by grams.
"""

from __future__ import annotations

import base64
import json
import logging
import os
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel

load_dotenv()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5vl:7b")
# The coach can reuse the vision model (one download, less RAM) or use a separate text model.
OLLAMA_CHAT_MODEL = os.getenv("OLLAMA_CHAT_MODEL") or OLLAMA_MODEL
OLLAMA_THINK = os.getenv("OLLAMA_THINK", "false").lower() in ("1", "true", "yes")
OLLAMA_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "30m")
USDA_API_KEY = os.getenv("USDA_API_KEY") or "DEMO_KEY"
SNAPSHOT_TOKEN = os.getenv("SNAPSHOT_TOKEN", "")
MAX_PHOTO_BYTES = 15 * 1024 * 1024

log = logging.getLogger("snapshot")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI(title="Workout app snapshot server")


def check_token(x_token: str | None = Header(default=None)) -> None:
    if SNAPSHOT_TOKEN and x_token != SNAPSHOT_TOKEN:
        raise HTTPException(status_code=401, detail="Bad or missing token")


# ── Ollama ──

LABEL_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "serving_size_g": {"type": ["number", "null"]},
        "basis": {"type": "string", "enum": ["per_serving", "per_100g"]},
        "kcal": {"type": ["number", "null"]},
        "protein_g": {"type": ["number", "null"]},
        "carbs_g": {"type": ["number", "null"]},
        "fat_g": {"type": ["number", "null"]},
        "fiber_g": {"type": ["number", "null"]},
        "sugar_g": {"type": ["number", "null"]},
        "sat_fat_g": {"type": ["number", "null"]},
        "sodium_mg": {"type": ["number", "null"]},
    },
    "required": ["name", "serving_size_g", "basis", "kcal", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "sat_fat_g", "sodium_mg"],
}

LABEL_PROMPT = """You are reading a photo of a packaged food's nutrition facts label.
Copy the numbers exactly as printed. Do not estimate or invent values; use null if a value is not visible.
- name: the product name if visible on the photo, otherwise a short generic description.
- serving_size_g: the serving size in grams (convert ml to g 1:1 if only ml is shown), or null.
- basis: "per_100g" if the column you read is per 100 g/ml, otherwise "per_serving".
- kcal, protein_g, carbs_g (total carbohydrate), fat_g (total fat): from that column.
- fiber_g (dietary fiber), sugar_g (total sugars), sat_fat_g (saturated fat) in grams, sodium_mg in milligrams.
Prefer the per 100 g column when the label has one. Reply with JSON only."""

MEAL_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "grams": {"type": "number"},
                },
                "required": ["name", "grams"],
            },
        }
    },
    "required": ["items"],
}

MEAL_PROMPT = """List each distinct food visible in this meal photo.
For each, give a short, plain, generic name that would match a nutrition database
(e.g. "white rice, cooked", "grilled chicken breast", "broccoli, steamed", "olive oil")
and your best estimate of the weight in grams of the portion shown.
Do NOT give calories or any nutrition numbers. Reply with JSON only."""


async def ask_vision(prompt: str, image: bytes, schema: dict[str, Any]) -> dict[str, Any]:
    return await ask_images(prompt, [image], schema)


async def ask_images(prompt: str, images: list[bytes], schema: dict[str, Any]) -> dict[str, Any]:
    out = await ollama_chat(
        [{"role": "user", "content": prompt, "images": [base64.b64encode(i).decode() for i in images]}],
        schema=schema,
    )
    try:
        return json.loads(out)
    except json.JSONDecodeError as e:
        log.warning("Model returned non-JSON: %s", out[:500])
        raise HTTPException(status_code=502, detail="Model did not return valid JSON") from e


async def ollama_chat(
    messages: list[dict[str, Any]],
    schema: dict[str, Any] | None = None,
    model: str | None = None,
    temperature: float = 0,
) -> str:
    """One non-streaming Ollama chat call; returns the reply text (JSON text when a schema is given)."""
    payload: dict[str, Any] = {
        "model": model or OLLAMA_MODEL,
        "stream": False,
        # Thinking models (e.g. qwen3.5) are far slower with it on, and it adds nothing to JSON extraction.
        "think": OLLAMA_THINK,
        # Keep the model in memory between requests so the next photo or question doesn't wait for a reload.
        "keep_alive": OLLAMA_KEEP_ALIVE,
        "options": {"temperature": temperature},
        "messages": messages,
    }
    if schema is not None:
        payload["format"] = schema
    async with httpx.AsyncClient(timeout=300) as client:
        try:
            r = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
        except httpx.HTTPError as e:
            raise HTTPException(status_code=503, detail=f"Ollama not reachable at {OLLAMA_URL}: {e}") from e
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Ollama error {r.status_code}: {r.text[:300]}")
    return r.json().get("message", {}).get("content", "")


# ── USDA ──

def _nutrient(nutrients: list[dict[str, Any]], number: str) -> float | None:
    for n in nutrients:
        if n.get("nutrientNumber") == number and (number != "208" or str(n.get("unitName", "")).upper() == "KCAL"):
            return n.get("value")
    if number == "208":
        for n in nutrients:
            if str(n.get("nutrientName", "")).startswith("Energy") and str(n.get("unitName", "")).upper() == "KCAL":
                return n.get("value")
    return None


async def usda_lookup(client: httpx.AsyncClient, query: str) -> dict[str, Any] | None:
    """Best generic match for a food name, per 100 g."""
    params = {
        "api_key": USDA_API_KEY,
        "query": query,
        "pageSize": 10,
        "dataType": "Survey (FNDDS),SR Legacy,Foundation",
    }
    try:
        r = await client.get("https://api.nal.usda.gov/fdc/v1/foods/search", params=params)
        r.raise_for_status()
    except httpx.HTTPError as e:
        hint = " (DEMO_KEY allows only ~10 requests/hour; set USDA_API_KEY in .env)" if USDA_API_KEY == "DEMO_KEY" else ""
        log.warning("USDA lookup failed for %r: %s%s", query, e, hint)
        return None
    for f in r.json().get("foods", []):
        nutrients = f.get("foodNutrients", [])
        kcal = _nutrient(nutrients, "208")
        if kcal is None:
            continue
        return {
            "fdc_id": f.get("fdcId"),
            "description": f.get("description"),
            "kcal_100g": kcal,
            "protein_100g": _nutrient(nutrients, "203"),
            "carbs_100g": _nutrient(nutrients, "205"),
            "fat_100g": _nutrient(nutrients, "204"),
            "fiber_100g": _nutrient(nutrients, "291"),
            "sugar_100g": _nutrient(nutrients, "269"),
            "sat_fat_100g": _nutrient(nutrients, "606"),
            "sodium_mg_100g": _nutrient(nutrients, "307"),
        }
    return None


# ── Routes ──

async def read_photo(photo: UploadFile) -> bytes:
    data = await photo.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty photo")
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Photo too large")
    return data


@app.get("/health")
async def health(_: None = Depends(check_token)) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            tags = (await client.get(f"{OLLAMA_URL}/api/tags")).json()
    except httpx.HTTPError:
        return {"ok": False, "model": OLLAMA_MODEL, "error": f"Server is up, but Ollama isn't running at {OLLAMA_URL}."}
    names = {m.get("name") for m in tags.get("models", [])}
    ready = OLLAMA_MODEL in names or f"{OLLAMA_MODEL}:latest" in names
    return {"ok": True, "model": OLLAMA_MODEL, "model_ready": ready}


@app.post("/label")
async def label(photo: UploadFile = File(...), _: None = Depends(check_token)) -> dict[str, Any]:
    out = await ask_vision(LABEL_PROMPT, await read_photo(photo), LABEL_SCHEMA)
    serving = out.get("serving_size_g")

    def per100(v: Any) -> float | None:
        if not isinstance(v, (int, float)):
            return None
        if out.get("basis") == "per_100g":
            return round(float(v), 1)
        if isinstance(serving, (int, float)) and serving > 0:
            return round(float(v) * 100 / serving, 1)
        return None  # per-serving values without a serving size can't be converted

    food = {
        "name": (out.get("name") or "Labelled food").strip(),
        "serving_g": serving if isinstance(serving, (int, float)) and serving > 0 else None,
        "kcal_100g": per100(out.get("kcal")),
        "protein_100g": per100(out.get("protein_g")),
        "carbs_100g": per100(out.get("carbs_g")),
        "fat_100g": per100(out.get("fat_g")),
        "fiber_100g": per100(out.get("fiber_g")),
        "sugar_100g": per100(out.get("sugar_g")),
        "sat_fat_100g": per100(out.get("sat_fat_g")),
        "sodium_mg_100g": per100(out.get("sodium_mg")),
    }
    log.info("label -> %s", food)
    return {"kind": "label", "food": food}


def meal_prompt(hints: str | None) -> str:
    """Adds the user's usual grocery products so the model reuses their names."""
    try:
        kinds = [str(k).strip() for k in json.loads(hints or "[]") if str(k).strip()][:80]
    except (json.JSONDecodeError, TypeError):
        kinds = []
    if not kinds:
        return MEAL_PROMPT
    return (
        MEAL_PROMPT
        + "\nThis person usually eats these products. When a food in the photo is one of them, "
        + "use exactly that name: "
        + ", ".join(kinds)
        + "."
    )


@app.post("/meal")
async def meal(
    photo: UploadFile = File(...),
    hints: str | None = Form(default=None),
    _: None = Depends(check_token),
) -> dict[str, Any]:
    out = await ask_vision(meal_prompt(hints), await read_photo(photo), MEAL_SCHEMA)
    items = []
    async with httpx.AsyncClient(timeout=20) as client:
        for it in out.get("items", [])[:12]:
            name = str(it.get("name", "")).strip()
            grams = it.get("grams")
            if not name or not isinstance(grams, (int, float)) or grams <= 0:
                continue
            match = await usda_lookup(client, name)
            items.append({"name": name, "grams": round(float(grams)), "usda": match})
    log.info("meal -> %s", [(i["name"], i["grams"], bool(i["usda"])) for i in items])
    return {"kind": "meal", "items": items}


# ── Nutrition tables: restaurant menus ──

NUTRITION_PROPS = {
    "kcal": {"type": ["number", "null"]},
    "protein_g": {"type": ["number", "null"]},
    "carbs_g": {"type": ["number", "null"]},
    "fat_g": {"type": ["number", "null"]},
    "fiber_g": {"type": ["number", "null"]},
    "sugar_g": {"type": ["number", "null"]},
    "sat_fat_g": {"type": ["number", "null"]},
    "sodium_mg": {"type": ["number", "null"]},
}

MENU_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"name": {"type": "string"}, "serving_g": {"type": ["number", "null"]}, **NUTRITION_PROPS},
                "required": ["name", *NUTRITION_PROPS.keys()],
            },
        }
    },
    "required": ["items"],
}

MENU_PROMPT = """These are screenshots of a restaurant's nutrition information (a table or item pages).
List every menu item you can read, one entry per item, with its values for ONE item exactly as printed.
Use null for anything not shown. serving_g is the item weight in grams if listed. Do not estimate.
Reply with JSON only."""


async def read_photos(photos: list[UploadFile]) -> list[bytes]:
    if not photos or len(photos) > 8:
        raise HTTPException(status_code=400, detail="Send 1 to 8 photos")
    return [await read_photo(p) for p in photos]


@app.post("/menu")
async def menu(photos: list[UploadFile] = File(...), _: None = Depends(check_token)) -> dict[str, Any]:
    out = await ask_images(MENU_PROMPT, await read_photos(photos), MENU_SCHEMA)
    items = [i for i in out.get("items", []) if str(i.get("name", "")).strip() and isinstance(i.get("kcal"), (int, float))]
    log.info("menu -> %d items", len(items))
    return {"kind": "menu", "items": items[:80]}


# ── Recipes ──

RECIPE_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "servings": {"type": ["number", "null"]},
        "ingredients": {"type": "array", "items": {"type": "string"}},
        "steps": {"type": "array", "items": {"type": "string"}},
        "nutrition_per_serving": {"type": ["object", "null"], "properties": NUTRITION_PROPS},
    },
    "required": ["name", "servings", "ingredients", "steps", "nutrition_per_serving"],
}

RECIPE_PROMPT = """These screenshots show one recipe. Copy it out:
- name, servings (number of servings it makes, or null)
- ingredients: one string per ingredient line, exactly as written (amount + unit + item)
- steps: one string per instruction step
- nutrition_per_serving: only if the screenshots show nutrition facts, else null. Do not estimate.
Reply with JSON only."""

INGREDIENT_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"food": {"type": "string"}, "grams": {"type": "number"}},
                "required": ["food", "grams"],
            },
        }
    },
    "required": ["items"],
}

INGREDIENT_PROMPT = """Convert each recipe ingredient line into a plain generic food name that would match a
nutrition database (e.g. "chicken breast, raw", "olive oil", "white rice, uncooked") and its weight in grams
for the WHOLE recipe. Convert cups, tablespoons, pieces etc. to grams with typical values. Skip water, salt to
taste and optional garnishes. Reply with JSON only.

Ingredients:
"""

USDA_TO_NUTRITION = {
    "kcal": "kcal_100g",
    "protein_g": "protein_100g",
    "carbs_g": "carbs_100g",
    "fat_g": "fat_100g",
    "fiber_g": "fiber_100g",
    "sugar_g": "sugar_100g",
    "sat_fat_g": "sat_fat_100g",
    "sodium_mg": "sodium_mg_100g",
}


async def estimate_nutrition(ingredients: list[str], servings: float) -> dict[str, Any]:
    """Per-serving nutrition from ingredient lines: model -> grams, USDA -> per 100 g, then sum."""
    text = "\n".join(f"- {i}" for i in ingredients[:60])
    raw = await ollama_chat([{"role": "user", "content": INGREDIENT_PROMPT + text}], schema=INGREDIENT_SCHEMA)
    try:
        out = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail="Model did not return valid JSON") from e
    totals = {k: 0.0 for k in USDA_TO_NUTRITION}
    matched, missing = [], []
    async with httpx.AsyncClient(timeout=20) as client:
        for it in out.get("items", []):
            food, grams = str(it.get("food", "")).strip(), it.get("grams")
            if not food or not isinstance(grams, (int, float)) or grams <= 0:
                continue
            m = await usda_lookup(client, food)
            if not m:
                missing.append(food)
                continue
            matched.append({"food": food, "grams": round(grams), "usda": m["description"]})
            for k, col in USDA_TO_NUTRITION.items():
                v = m.get(col)
                if isinstance(v, (int, float)):
                    totals[k] += v * grams / 100
    per = {k: round(v / max(servings, 1), 1) for k, v in totals.items()}
    return {"per_serving": per, "matched": matched, "missing": missing}


@app.post("/recipe")
async def recipe(photos: list[UploadFile] = File(...), _: None = Depends(check_token)) -> dict[str, Any]:
    out = await ask_images(RECIPE_PROMPT, await read_photos(photos), RECIPE_SCHEMA)
    raw_servings = out.get("servings")
    servings = raw_servings if isinstance(raw_servings, (int, float)) and raw_servings > 0 else 1
    result: dict[str, Any] = {
        "name": str(out.get("name") or "Recipe").strip(),
        "servings": servings,
        "ingredients": [str(i) for i in out.get("ingredients", []) if str(i).strip()],
        "steps": [str(s) for s in out.get("steps", []) if str(s).strip()],
        "nutrition_per_serving": out.get("nutrition_per_serving"),
        "estimated": False,
    }
    if not result["nutrition_per_serving"] and result["ingredients"]:
        est = await estimate_nutrition(result["ingredients"], servings)
        result.update(nutrition_per_serving=est["per_serving"], estimated=True, missing=est["missing"])
    log.info("recipe -> %s (%d ingredients, estimated=%s)", result["name"], len(result["ingredients"]), result["estimated"])
    return {"kind": "recipe", "recipe": result}


class NutritionRequest(BaseModel):
    ingredients: list[str]
    servings: float = 1


@app.post("/recipe/nutrition")
async def recipe_nutrition(body: NutritionRequest, _: None = Depends(check_token)) -> dict[str, Any]:
    if not body.ingredients:
        raise HTTPException(status_code=400, detail="No ingredients")
    return await estimate_nutrition(body.ingredients, body.servings)


# ── Coach ──

COACH_SYSTEM = """You are the coach inside the user's personal training app "Tend".
You help with training, nutrition and progress. Be practical, specific and brief (short paragraphs or bullets).
Base advice on the user's data in CONTEXT; say when something is a guess. You are not a doctor:
for pain, injury or medical issues, suggest seeing a professional. Never invent numbers that are not in CONTEXT."""


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: str = ""


@app.post("/chat")
async def chat(body: ChatRequest, _: None = Depends(check_token)) -> dict[str, Any]:
    msgs: list[dict[str, Any]] = [{"role": "system", "content": f"{COACH_SYSTEM}\n\nCONTEXT:\n{body.context[:12000]}"}]
    msgs += [
        {"role": m.role if m.role in ("user", "assistant") else "user", "content": m.content}
        for m in body.messages[-20:]
    ]
    reply = await ollama_chat(msgs, model=OLLAMA_CHAT_MODEL, temperature=0.4)
    return {"reply": reply.strip()}


PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "routines": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "weekday": {"type": "integer", "minimum": 0, "maximum": 6},
                    "exercises": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {"name": {"type": "string"}, "sets": {"type": "integer"}, "reps": {"type": "integer"}},
                            "required": ["name", "sets", "reps"],
                        },
                    },
                },
                "required": ["name", "weekday", "exercises"],
            },
        },
    },
    "required": ["summary", "routines"],
}


class PlanRequest(BaseModel):
    goals: str
    context: str = ""
    exercises: list[str]


@app.post("/plan")
async def plan(body: PlanRequest, _: None = Depends(check_token)) -> dict[str, Any]:
    prompt = (
        f"{COACH_SYSTEM}\n\nCONTEXT:\n{body.context[:8000]}\n\nGOALS AND PREFERENCES:\n{body.goals}\n\n"
        "Design a weekly training plan. weekday: 0=Sunday ... 6=Saturday. Use ONLY exercise names from this list, "
        "spelled exactly:\n" + "\n".join(body.exercises[:300]) + "\n\nsummary: 2-4 sentences explaining the plan. Reply with JSON only."
    )
    raw = await ollama_chat([{"role": "user", "content": prompt}], schema=PLAN_SCHEMA, model=OLLAMA_CHAT_MODEL, temperature=0.3)
    try:
        out = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail="Model did not return valid JSON") from e
    allowed = {e.lower(): e for e in body.exercises}
    routines = []
    for r in out.get("routines", []):
        ex = [
            {"name": allowed[str(e["name"]).lower()], "sets": max(1, min(10, int(e["sets"]))), "reps": max(1, min(50, int(e["reps"])))}
            for e in r.get("exercises", [])
            if str(e.get("name", "")).lower() in allowed
        ]
        if ex and 0 <= int(r.get("weekday", -1)) <= 6:
            routines.append({"name": str(r["name"]).strip()[:40], "weekday": int(r["weekday"]), "exercises": ex})
    return {"summary": out.get("summary", ""), "routines": routines}


# ── Instagram workout imports ──

WORKOUT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "exercises": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "library_match": {"type": ["string", "null"]},
                    "sets": {"type": ["integer", "null"]},
                    "reps": {"type": ["integer", "null"]},
                    "muscle_group": {"type": ["string", "null"]},
                    "equipment": {"type": ["string", "null"]},
                    "notes": {"type": ["string", "null"]},
                },
                "required": ["name", "library_match", "sets", "reps", "muscle_group", "equipment", "notes"],
            },
        },
    },
    "required": ["title", "summary", "exercises"],
}

WORKOUT_PROMPT = """This is a workout post from Instagram: its caption, and possibly images/screenshots from the video.
Work out what the workout is:
- title: a short name for the workout (e.g. "Delt builder").
- summary: one or two sentences on what it targets and how to do it.
- exercises: every exercise, in order. name: a clear standard name (e.g. "Cable Lateral Raise").
  library_match: if the exercise is the same movement as one in MY LIBRARY below, that library name exactly; else null.
  sets/reps: as given, else a sensible suggestion. muscle_group: one of Chest, Back, Shoulders, Traps, Biceps, Triceps,
  Forearms, Legs, Hamstrings, Glutes, Calves, Core, Full body, Cardio, Other. equipment: one of Barbell, Dumbbell, Cable,
  Machine, Bodyweight, Band, Landmine, Other. notes: form cues from the post, short.
If nothing in the caption or images describes exercises, return an empty exercises list. Reply with JSON only.

CAPTION:
"""


@app.post("/workout")
async def workout(
    caption: str = Form(default=""),
    library: str = Form(default="[]"),
    photos: list[UploadFile] | None = File(default=None),
    _: None = Depends(check_token),
) -> dict[str, Any]:
    try:
        names = [str(n) for n in json.loads(library)][:300]
    except json.JSONDecodeError:
        names = []
    prompt = WORKOUT_PROMPT + (caption.strip()[:4000] or "(no caption)") + "\n\nMY LIBRARY:\n" + "\n".join(names)
    images = [await read_photo(p) for p in (photos or [])[:8]]
    if images:
        out = await ask_images(prompt, images, WORKOUT_SCHEMA)
    else:
        raw = await ollama_chat([{"role": "user", "content": prompt}], schema=WORKOUT_SCHEMA)
        try:
            out = json.loads(raw)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=502, detail="Model did not return valid JSON") from e
    allowed = {n.lower(): n for n in names}
    exercises = []
    for e in out.get("exercises", []):
        name = str(e.get("name", "")).strip()
        if not name:
            continue
        match = e.get("library_match")
        e["library_match"] = allowed.get(str(match).lower()) if match else None
        e["name"] = name
        exercises.append(e)
    log.info("workout -> %s (%d exercises)", out.get("title"), len(exercises))
    return {"kind": "workout", "title": out.get("title", "Instagram workout"), "summary": out.get("summary", ""), "exercises": exercises}
