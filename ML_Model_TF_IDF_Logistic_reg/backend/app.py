from fastapi import FastAPI
from pydantic import BaseModel
import joblib
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# @app.post("/predict_style")
# async def predict_style():
#     return {"message": "Success"}

from explanation import (
    generate_explanation,
    get_category
)

model = joblib.load(
    "clickbait_model.pkl"
)

vectorizer = joblib.load(
    "tfidf_vectorizer.pkl"
)

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

    vector = vectorizer.transform(
        [data.headline]
    )

    probability = model.predict_proba(
        vector
    )[0][1]

    score = round(
        probability * 100,
        2
    )

    return {
        "headline": data.headline,
        "score": score,
        "category": get_category(probability),
        "reasons": generate_explanation(
            data.headline
        )
    }
    
@app.get("/")
def home():
    return {
        "message":
        "Clickbait API Running"
    }
    
after_model = joblib.load(
    "after_click_model.pkl"
)

after_vectorizer = joblib.load(
    "after_vectorizer.pkl"
)

@app.post("/predict_consistency")
def predict_consistency(
    data: ConsistencyInput
):
    if len(data.headline.strip()) == 0:
        raise HTTPException(
        status_code=400,
        detail="Headline cannot be empty"
    )

    combined_text = (
        data.headline
        + " "
        + data.title
        + " "
        + data.description
        + " "
        + data.article_text
    )

    vector = after_vectorizer.transform(
        [combined_text]
    )

    probability = after_model.predict_proba(
        vector
    )[0][1]

    score = round(
        probability * 100,
        2
    )

    return {

        "headline": data.headline,

        "consistency_score": score,

        "category":
        get_category(probability),

        "reasons":
        generate_explanation(
            data.headline
        )
    }
    


# uvicorn app:app --reload