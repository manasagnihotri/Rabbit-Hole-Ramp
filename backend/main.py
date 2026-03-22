from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import anthropic
import os
from prompts import SYSTEM_PROMPT, build_prompt

app = FastAPI()

# Allow Chrome extension to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

class Tab(BaseModel):
    url: str
    title: str
    domain: str
    snippet: Optional[str] = None

class SummarizeRequest(BaseModel):
    tabs: List[Tab]
    active_tab_snippet: Optional[str] = None

@app.post("/summarize")
def summarize(request: SummarizeRequest):
    prompt = build_prompt(
        [t.dict() for t in request.tabs],
        request.active_tab_snippet
    )
    
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}]
    )
    
    summary = message.content[0].text.strip()
    return {"summary": summary}

@app.get("/health")
def health():
    return {"status": "ok"}