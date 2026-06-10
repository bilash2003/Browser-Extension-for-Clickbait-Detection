import time
from sentence_transformers import SentenceTransformer
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

embedding_model = SentenceTransformer(
    "all-MiniLM-L6-v2"
)

model = joblib.load(
    "clickbait_model_minilm.pkl"
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

    print("Headline:", data.headline)

    start_time = time.time()

    embedding = embedding_model.encode(
        [data.headline]
    )

    print(
        "Embedding shape:",
        embedding.shape
    )

    score = model.predict(
        embedding
    )[0]

    score = float(score)

    score = max(
        0,
        min(score, 1)
    )

    print(
        "Raw score:",
        score
    )

    percentage = round(
        score * 100,
        2
    )

    processing_time = round(
        (time.time() - start_time)
        * 1000,
        2
    )

    return {

        "headline":
        data.headline,

        "score":
        percentage,

        "processing_time_ms":
        processing_time,

        "category":
        get_category(score),

        "reasons":
        generate_explanation(
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
    start_time = time.time()

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
    processing_time = round(
    (time.time() - start_time)
    * 1000,
    2
)

    return {

        "headline": data.headline,

        "consistency_score": score,
        "processing_time_ms":
processing_time,

        "category":
        get_category(probability),

        "reasons":
        generate_explanation(
            data.headline
        )
    }
    


# uvicorn app:app --reload