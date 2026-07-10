import re

CLICKBAIT_PATTERNS = {

    "Curiosity Gap": [
        "you won't believe",
        "what happened next",
        "the reason why",
        "this is what",
        "guess what",
        "what happens next will",
        "you'll never guess",
        "here's why",     
        "wait until you see"
    ],

    "Emotional Trigger": [
        "shocking",
        "amazing",
        "incredible",
        "unbelievable",
        "heartbreaking",
        "jaw dropping",
        "mind blowing",
        "stunning"
    ],

    "Information Withholding": [
        "this one thing",
        "this secret",
        "one simple trick",
        "what happened next",
        "the truth about",
        "what nobody tells you",
        "hidden truth"
    ],

    "Exaggeration": [
        "save your life",
        "change your life",
        "best ever",
        "never before",
        "ultimate",
        "will blow your mind",
        "changed everything",
        "you need to know"
    ],

    "Fear Appeal": [
        "dangerous",
        "warning",
        "could kill",
        "avoid",
        "risk",
        "before it's too late",
        "deadly"
    ]
}

def detect_listicle(text):
    return bool(re.search(r"\b\d+\b", text))

def generate_explanation(text):

    text = text.lower()

    detected = []

    for tactic, phrases in CLICKBAIT_PATTERNS.items():

        for phrase in phrases:

            # \b word-boundary matching avoids false positives like
            # "risk" matching inside "brisket"
            pattern = r"\b" + re.escape(phrase) + r"\b"

            if re.search(pattern, text):
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
