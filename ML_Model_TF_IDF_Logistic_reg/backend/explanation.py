import re

CLICKBAIT_PATTERNS = {

    "Curiosity Gap": [
        "you won't believe",
        "what happened next",
        "the reason why",
        "this is what",
        "guess what"
    ],

    "Emotional Trigger": [
        "shocking",
        "amazing",
        "incredible",
        "unbelievable",
        "heartbreaking"
    ],

    "Information Withholding": [
        "this one thing",
        "this secret",
        "one simple trick",
        "what happened next"
    ],

    "Exaggeration": [
        "save your life",
        "change your life",
        "best ever",
        "never before",
        "ultimate"
    ],

    "Fear Appeal": [
        "dangerous",
        "warning",
        "could kill",
        "avoid",
        "risk"
    ]
}

def detect_listicle(text):
    return bool(re.search(r"\b\d+\b", text))

def generate_explanation(text):

    text = text.lower()

    detected = []

    for tactic, phrases in CLICKBAIT_PATTERNS.items():

        for phrase in phrases:

            if phrase in text:
                detected.append(tactic)
                break

    if detect_listicle(text):
        detected.append("Listicle Pattern")

    return list(set(detected))

def get_category(score):

    if score < 0.30:
        return "Likely Genuine"

    elif score < 0.70:
        return "Possibly Clickbait"

    return "Highly Clickbait"