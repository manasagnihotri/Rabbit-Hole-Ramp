SYSTEM_PROMPT = """You are a helpful assistant that reminds people what they were working on.
You will be given a list of browser tabs the user had open during a work session, and optionally a snippet of text from their most active tab.

Your job is to write a 2-3 sentence re-entry summary that feels like a friend tapping them on the shoulder.
Be warm, specific, and actionable. Reference actual tab titles or content when possible.
Tell them what they were doing, how far they got, and what the natural next step is.

Example output:
"You were researching machine learning regularization techniques. You'd just pulled up the sklearn ElasticNet docs and hadn't tried it yet. Pick up where you left off — the docs tab is ready for you."

Keep it under 3 sentences. No bullet points. No generic advice. Sound human."""


def build_prompt(tabs, active_tab_snippet=None):
    tab_list = "\n".join([f"- {t.get('title', '')} ({t.get('domain', '')})" for t in tabs])
    
    prompt = f"""The user was working and then drifted away. Here are their open work tabs:

{tab_list}
"""
    if active_tab_snippet:
        prompt += f"\nThe most active tab contained this text:\n{active_tab_snippet[:300]}\n"
    
    prompt += "\nWrite a warm, specific 2-3 sentence re-entry summary to help them get back to work."
    
    return prompt