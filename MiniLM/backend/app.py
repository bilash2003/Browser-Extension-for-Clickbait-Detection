import time
import json
import pickle
import tempfile
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from transformers import AutoConfig, AutoModelForSequenceClassification, PreTrainedTokenizerFast
from sentence_transformers import SentenceTransformer

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from explanation import generate_explanation, get_category

app = FastAPI(
    title="Clickbait Detection API"
)

origins = [
    "chrome-extension://gngilmffajnjicoieppolibbibhegamf",
    "http://127.0.0.1",
    "http://localhost",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Friendly display names for the model's raw class labels.
LABEL_DISPLAY = {
    "low_clickbait": "Low Clickbait",
    "moderate_clickbait": "Moderate Clickbait",
    "high_clickbait": "High Clickbait",
}

# Used to blend the 3-class probabilities into a single 0-1 "clickbait-ness"
# score, so the UI still gets a smooth percentage/progress-bar instead of a
# hard 0 / 50 / 100 jump between classes.
LABEL_WEIGHTS = {
    "low_clickbait": 0.0,
    "moderate_clickbait": 0.5,
    "high_clickbait": 1.0,
}


def load_bundle(bundle_path: str):
    """
    Loads one of our merged .pkl bundles and reconstructs a ready-to-use
    (tokenizer, model) pair.

    Handles two bundle layouts, since different sessions produced
    different ones:
      Format A (numpy):  keys "config", "tokenizer_config", "tokenizer_json",
                          "model_state_dict" (numpy arrays)
      Format B (raw):    keys "config.json", "tokenizer_config.json",
                          "tokenizer.json", "model.safetensors" (raw bytes)
    """
    with open(bundle_path, "rb") as f:
        bundle = pickle.load(f)

    is_format_a = "config" in bundle

    config_dict = bundle["config"] if is_format_a else bundle["config.json"]
    tok_cfg = (
        bundle["tokenizer_config"]
        if is_format_a
        else bundle["tokenizer_config.json"]
    )
    tokenizer_json_dict = (
        bundle["tokenizer_json"] if is_format_a else bundle["tokenizer.json"]
    )

    tmp_dir = Path(tempfile.mkdtemp(prefix="clickbait_model_"))

    with open(tmp_dir / "config.json", "w") as f:
        json.dump(config_dict, f)

    tokenizer_json_path = tmp_dir / "tokenizer.json"
    with open(tokenizer_json_path, "w") as f:
        json.dump(tokenizer_json_dict, f)

    tokenizer = PreTrainedTokenizerFast(
        tokenizer_file=str(tokenizer_json_path),
        cls_token=tok_cfg.get("cls_token", "[CLS]"),
        sep_token=tok_cfg.get("sep_token", "[SEP]"),
        pad_token=tok_cfg.get("pad_token", "[PAD]"),
        mask_token=tok_cfg.get("mask_token", "[MASK]"),
        unk_token=tok_cfg.get("unk_token", "[UNK]"),
        do_lower_case=tok_cfg.get("do_lower_case", True),
    )

    config = AutoConfig.from_pretrained(tmp_dir)
    model = AutoModelForSequenceClassification.from_config(config)

    if is_format_a:
        # model_state_dict is already numpy arrays.
        state_dict = {
            key: torch.from_numpy(np.array(value))
            for key, value in bundle["model_state_dict"].items()
        }
    else:
        # model.safetensors is raw bytes — write it out and let
        # safetensors parse it directly into tensors.
        from safetensors.torch import load_file

        safetensors_path = tmp_dir / "model.safetensors"
        with open(safetensors_path, "wb") as f:
            f.write(bundle["model.safetensors"])

        state_dict = load_file(str(safetensors_path))

    missing, unexpected = model.load_state_dict(state_dict, strict=False)
    if missing or unexpected:
        print(
            f"[{bundle_path}] load_state_dict warning — "
            f"missing: {missing}, unexpected: {unexpected}"
        )

    model.eval()
    return tokenizer, model


print("Loading before-click model...")
before_tokenizer, before_model = load_bundle("before_click_model.pkl")

print("Loading after-click model...")
after_tokenizer, after_model = load_bundle("after_click_model.pkl")

print("Loading similarity model...")
# Separate, lightweight model used ONLY to measure how closely the
# headline's meaning matches the article's content (the "Headline <->
# content match" signal). This is independent of the fine-tuned
# before/after classifiers above.
similarity_model = SentenceTransformer("all-MiniLM-L6-v2")


def cosine_similarity(vec_a, vec_b):
    vec_a = vec_a.flatten()
    vec_b = vec_b.flatten()

    dot_product = np.dot(vec_a, vec_b)
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(dot_product / (norm_a * norm_b))


def score_text(tokenizer, model, text: str):
    """
    Runs a fine-tuned BERT sequence-classification model over `text`.
    Returns:
      weighted_score  -> single 0-1 clickbait-ness value
      predicted_label -> friendly name of the argmax class
      prob_breakdown  -> {friendly class name: percentage} for all classes
    """
    inputs = tokenizer(
        text,
        truncation=True,
        padding=True,
        max_length=512,
        return_tensors="pt",
    )

    with torch.no_grad():
        logits = model(**inputs).logits

    probs = F.softmax(logits, dim=-1)[0]
    id2label = {int(k): v for k, v in model.config.id2label.items()}

    weighted_score = sum(
        probs[idx].item() * LABEL_WEIGHTS.get(label, 0.0)
        for idx, label in id2label.items()
    )

    predicted_id = int(torch.argmax(probs).item())
    predicted_label = LABEL_DISPLAY.get(
        id2label[predicted_id], id2label[predicted_id]
    )

    prob_breakdown = {
        LABEL_DISPLAY.get(label, label): round(probs[idx].item() * 100, 2)
        for idx, label in id2label.items()
    }

    return weighted_score, predicted_label, prob_breakdown


class HeadlineInput(BaseModel):
    headline: str


class ConsistencyInput(BaseModel):
    headline: str
    title: str
    description: str
    article_text: str


@app.post("/predict_style")
def predict_style(data: HeadlineInput):

    if len(data.headline.strip()) == 0:
        raise HTTPException(
            status_code=400,
            detail="Headline cannot be empty"
        )

    print("Headline:", data.headline)

    start_time = time.time()

    try:
        score, predicted_label, prob_breakdown = score_text(
            before_tokenizer, before_model, data.headline
        )

    except Exception as e:
        print("Prediction error:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to analyze headline. Please try again."
        )

    score = max(0.0, min(score, 1.0))
    percentage = round(score * 100, 2)
    processing_time = round((time.time() - start_time) * 1000, 2)

    return {
        "headline": data.headline,
        "score": percentage,
        "processing_time_ms": processing_time,
        "category": get_category(score),
        "model_prediction": predicted_label,
        "confidence": prob_breakdown,
        "reasons": generate_explanation(data.headline)
    }


@app.get("/")
def home():
    return {
        "message": "Clickbait API Running"
    }


@app.post("/predict_consistency")
def predict_consistency(data: ConsistencyInput):

    if len(data.headline.strip()) == 0:
        raise HTTPException(
            status_code=400,
            detail="Headline cannot be empty"
        )

    start_time = time.time()

    # The after-click model was fine-tuned directly on
    # headline + title + description + first paragraphs (Dataset B in the
    # proposal), so we feed it the combined text and let it produce the
    # consistency classification in one pass.
    combined_text = (
        data.headline
        + " "
        + data.title
        + " "
        + data.description
        + " "
        + data.article_text
    )

    try:
        score, predicted_label, prob_breakdown = score_text(
            after_tokenizer, after_model, combined_text
        )

        # "Text pattern signal" — the fine-tuned model's own clickbait
        # score, based on the combined headline + article text it was
        # trained on.
        # text_pattern_score = round(score * 100, 2)

        # "Headline <-> content match" — an independent semantic check:
        # does the headline's meaning actually match the article's
        # content (title + description + body), regardless of wording?
        article_content = (
            data.title + " " + data.description + " " + data.article_text
        ).strip()

        headline_embedding = similarity_model.encode([data.headline])
        article_embedding = similarity_model.encode([article_content])

        similarity = cosine_similarity(headline_embedding, article_embedding)
        semantic_similarity = round(similarity * 100, 2)

    except Exception as e:
        print("Prediction error:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to analyze article consistency. Please try again."
        )

    score = max(0.0, min(score, 1.0))
    percentage = round(score * 100, 2)
    processing_time = round((time.time() - start_time) * 1000, 2)

    reasons = generate_explanation(data.headline)

    if similarity < 0.35:
        reasons.append("Low semantic match between headline and article content")

    return {
        "headline": data.headline,
        "consistency_score": percentage,
        # "classifier_score": text_pattern_score,
        "semantic_similarity": semantic_similarity,
        "model_prediction": predicted_label,
        "confidence": prob_breakdown,
        "processing_time_ms": processing_time,
        "category": get_category(score),
        "reasons": reasons
    }


# uvicorn app:app --reload
