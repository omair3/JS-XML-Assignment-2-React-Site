# Food Label Analyzer (Assignment 2)

A React + Node.js app that analyzes food label ingredients.  
You can type ingredients or upload a label image. The server uses:
- **OCR.space** to extract text from images
- **Open Food Facts** to help flag potentially risky ingredients
- **Gemini** to generate a short, friendly explanation

> This repo contains both the **client** (React) and **server** (Express) folders.  
> Deployment is optional; below are **local run** steps for grading.

---

## Features
- Flags suspicious terms (e.g., *palm oil, MSG, HFCS*), cross-checks with Open Food Facts
- AI summary via Gemini
- Recent scans list (in-memory)

---

## Tech Stack
- **Frontend:** React (Vite), React Router
- **Backend:** Node.js, Express, Multer, node-fetch, FormData
- **APIs:** OCR.space, Open Food Facts, Gemini
- **Styling:** Plain CSS


## Folder Structure
