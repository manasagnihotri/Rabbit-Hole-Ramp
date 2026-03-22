# main.py — FastAPI summarization server

import os
from datetime import datetime, timezone

import anthropic
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE, format_tabs_for_prompt

app = FastAPI(title="Rabbit Hole Ramp API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # hackathon only — lock down in production
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)


class Tab(BaseModel):
    url: str
    title: str = ""
    snippet: str = ""
    domain: str = ""


class SummarizeRequest(BaseModel):
    tabs: list[Tab]
    drift_trigger: str


class SummarizeResponse(BaseModel):
    summary: str
    timestamp: str


@app.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest) -> SummarizeResponse:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")

    if not request.tabs:
        raise HTTPException(status_code=400, detail="No tabs provided")

    formatted_tabs = format_tabs_for_prompt([t.model_dump() for t in request.tabs])
    user_prompt = USER_PROMPT_TEMPLATE.format(formatted_tabs=formatted_tabs)

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=256,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        summary = message.content[0].text.strip()
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {str(e)}")

    return SummarizeResponse(
        summary=summary,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
