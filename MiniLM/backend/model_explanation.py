"""
Model-based explanations using Captum's Integrated Gradients.

Unlike explanation.py (which matches text against a fixed list of known
clickbait phrases), this module asks the actual fine-tuned BERT model:
"which words in this specific input pushed you toward your prediction?"

This catches cases the keyword list can't, e.g. "Seven things you
shouldn't do..." — a listicle/advice-bait pattern the model learned
during training, even though no single fixed keyword matches it.
"""

import torch
from captum.attr import LayerIntegratedGradients

# Tokens we never want to surface as "key terms" even if they get a high
# attribution score — they carry no real meaning on their own.
IGNORE_TOKENS = {
    "the", "a", "an", "is", "are", "was", "were", "to", "of", "in",
    "on", "for", "and", "or", "it", "this", "that", "you", "your",
}


def _merge_subwords(tokens, scores):
    """
    BERT tokenizers split words into subword pieces, e.g.
    "unbelievable" -> ["un", "##believ", "##able"].
    This merges pieces back into whole words, summing their scores.
    """
    merged = []

    for tok, score in zip(tokens, scores):
        if tok.startswith("##") and merged:
            prev_tok, prev_score = merged[-1]
            merged[-1] = (prev_tok + tok[2:], prev_score + score)
        else:
            merged.append((tok, score))

    return merged


def get_key_terms(tokenizer, model, text, predicted_class_id, top_k=5):
    """
    Returns up to `top_k` words from `text` that most strongly pushed the
    model toward `predicted_class_id`, ordered by contribution strength.

    Returns an empty list if attribution fails for any reason (this is
    used as a fallback signal, not a critical path, so we fail quietly
    and let the caller fall back to something else).
    """

    try:
        model.eval()

        inputs = tokenizer(
            text,
            truncation=True,
            max_length=512,
            return_tensors="pt",
        )
        input_ids = inputs["input_ids"]
        attention_mask = inputs["attention_mask"]

        # Baseline = same-length sequence of [PAD] tokens, but keep the
        # real [CLS]/[SEP] tokens in place so we don't distort those
        # special positions.
        baseline_ids = torch.full_like(input_ids, tokenizer.pad_token_id)
        baseline_ids[0, 0] = input_ids[0, 0]
        baseline_ids[0, -1] = input_ids[0, -1]

        def forward_func(input_ids_inner, attention_mask_inner):
            return model(
                input_ids=input_ids_inner,
                attention_mask=attention_mask_inner,
            ).logits

        lig = LayerIntegratedGradients(
            forward_func, model.get_input_embeddings()
        )

        attributions, _ = lig.attribute(
            inputs=input_ids,
            baselines=baseline_ids,
            additional_forward_args=(attention_mask,),
            target=predicted_class_id,
            n_steps=30,
            return_convergence_delta=True,
        )

        # Collapse the embedding dimension, then normalize so scores are
        # comparable across different inputs/lengths.
        attributions = attributions.sum(dim=-1).squeeze(0)
        norm = torch.norm(attributions)
        if norm > 0:
            attributions = attributions / norm

        tokens = tokenizer.convert_ids_to_tokens(input_ids[0])

        special = {
            tokenizer.cls_token,
            tokenizer.sep_token,
            tokenizer.pad_token,
        }

        scored = [
            (tok, score.item())
            for tok, score in zip(tokens, attributions)
            if tok not in special
        ]

        merged = _merge_subwords(
            [t for t, s in scored], [s for t, s in scored]
        )

        # Only keep words that pushed TOWARD the predicted class
        # (positive attribution), ignore filler words, dedupe.
        seen = set()
        positive = []
        for word, score in merged:
            clean_word = word.lower().strip()
            if score <= 0:
                continue
            if clean_word in IGNORE_TOKENS:
                continue
            if len(clean_word) < 2:
                continue
            if clean_word in seen:
                continue
            seen.add(clean_word)
            positive.append((word, score))

        positive.sort(key=lambda x: x[1], reverse=True)

        return [word for word, _ in positive[:top_k]]

    except Exception as e:
        print("Captum explanation error:", e)
        return []
