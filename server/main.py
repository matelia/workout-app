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

load_dotenv()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5vl:7b")
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
    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "format": schema,
        "options": {"temperature": 0},
        "messages": [
            {"role": "user", "content": prompt, "images": [base64.b64encode(image).decode()]},
        ],
    }
    async with httpx.AsyncClient(timeout=300) as client:
        try:
            r = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
        except httpx.HTTPError as e:
            raise HTTPException(status_code=503, detail=f"Ollama not reachable at {OLLAMA_URL}: {e}") from e
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Ollama error {r.status_code}: {r.text[:300]}")
    content = r.json().get("message", {}).get("content", "")
    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        log.warning("Model returned non-JSON: %s", content[:500])
        raise HTTPException(status_code=502, detail="Model did not return valid JSON") from e


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
