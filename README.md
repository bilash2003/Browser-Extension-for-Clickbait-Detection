# Browser Extension for Clickbait Detection

## Overview

This project presents an AI-powered browser extension for detecting clickbait news headlines in real time. The system performs both **Before-Click Analysis** and **After-Click Analysis** to help users identify misleading, exaggerated, or low-quality news content while browsing the web.

The extension combines Natural Language Processing (NLP), Machine Learning, and Transformer-based language models to analyze headlines and article content and provide an understandable explanation of the prediction.

---

## Problem Statement

Clickbait headlines are designed to attract attention and encourage users to click on content by exploiting curiosity, exaggeration, or emotional triggers.

Examples:

* "You Won't Believe What Happened Next!"
* "This Simple Trick Changed His Life Forever!"
* "Doctors Hate This One Secret!"

Such headlines often fail to accurately represent the actual content of the article.

This project aims to detect such patterns automatically and provide users with a clickbait risk score.

---

## Key Features

### Before-Click Analysis

Analyzes a news headline before opening the article.

Provides:

* Clickbait score (%)
* Risk category
* Explanation of detected clickbait indicators

### After-Click Analysis

Analyzes both:

* Headline
* Article title
* Meta description
* Article content

Provides:

* Clickbait Risk After Reading
* Headline-content consistency estimation
* Additional explanation

### Real-Time Browser Integration

The extension works directly inside Google Chrome.

Features include:

* Automatic headline extraction
* Hover-based analysis tooltip
* Color-coded risk visualization
* Interactive popup interface

---

## Project Evolution

### Phase 1: Classical Machine Learning

Initial implementation used:

* TF-IDF Vectorization
* Logistic Regression Classifier

Pipeline:

Headline → TF-IDF → Logistic Regression → Prediction

Advantages:

* Fast
* Lightweight
* Easy to deploy

Limitations:

* Relies heavily on keywords
* Limited semantic understanding

---

### Phase 2: Transformer-Based NLP

The project was later upgraded to use:

### MiniLM (all-MiniLM-L6-v2)

Pipeline:

Headline → MiniLM Embeddings → Machine Learning Model → Prediction

MiniLM generates dense semantic embeddings that capture contextual meaning rather than simple keyword frequency.

Benefits:

* Better semantic understanding
* Improved generalization
* Better handling of unseen headlines
* More robust against wording variations

---

## Technologies Used

### Frontend

* HTML
* CSS
* JavaScript
* Chrome Extension API

### Backend

* Python
* FastAPI

### Machine Learning

* Scikit-Learn
* Sentence Transformers
* MiniLM (all-MiniLM-L6-v2)

### Data Processing

* NumPy
* Pandas
* Joblib

---

## Dataset

The project uses the Clickbait Challenge Dataset.

Important fields:

### instances.jsonl

Contains:

* postText
* targetTitle
* targetDescription
* targetParagraphs

### truth.jsonl

Contains:

* truthMean
* truthClass

Example:

truthClass = clickbait

truthMean = 1.0

The MiniLM version was trained using:

* Headline text (postText)
* truthMean as the target value

---

## Model Architecture

### Before-Click Detection

Input:

Headline

Process:

1. Headline embedding generation using MiniLM
2. Embedding passed to trained ML model
3. Clickbait score prediction
4. Explanation generation

Output:

* Clickbait Score
* Category
* Reasons

---

### After-Click Detection

Input:

* Headline
* Page Title
* Meta Description
* Article Content

Process:

1. Content extraction from webpage
2. Feature generation
3. Consistency prediction

Output:

* Clickbait Risk After Reading
* Consistency Score
* Explanation

---

## Categories

The system classifies content into:

### Likely Genuine

Low clickbait probability.

### Possibly Clickbait

Contains some clickbait characteristics.

### Highly Clickbait

Strong clickbait indicators detected.

---

## Explainable AI Features

The system provides simple explanations including:

* Curiosity Gap
* Information Withholding
* Emotional Trigger
* Sensational Language

This helps users understand why a headline was flagged.

---

## Browser Extension Workflow

1. User visits a news website.
2. Extension automatically extracts the headline.
3. Headline is sent to FastAPI backend.
4. MiniLM generates embeddings.
5. Model predicts clickbait probability.
6. Results are displayed in popup and tooltip.
7. User may run After-Click Analysis for deeper inspection.

---

## Future Improvements

Potential upgrades include:

* DistilBERT Fine-Tuning
* Multilingual Support (Hindi, Bengali, etc.)
* XGBoost-based prediction
* Explainable AI dashboards
* Fake News Detection Integration
* Online Learning and Continuous Model Updates
* News Source Credibility Scoring

---

## Project Structure

backend/

* app.py
* explanation.py
* clickbait_model_minilm.pkl
* after_click_model.pkl

extension/

* manifest.json
* popup.html
* popup.js
* content.js
* style.css

models/

* MiniLM Models
* TF-IDF + Logistic Regression Models

---
